// ─── TinoBem — Webhook Hotmart → Supabase (Edge Function) ────────────────────
// A Hotmart faz POST na URL desta função (…/functions/v1/hotmart-webhook).
//
// Fluxo:
//   PURCHASE_APPROVED          → cria o usuário (sem senha, via convite) e grava
//                                compras.status = PURCHASE_APPROVED. O Supabase
//                                Auth envia o e-mail de convite (SMTP Brevo).
//   PURCHASE_CANCELED/REFUNDED/PROTEST/BILLET_PRINTED/CHARGEBACK/SUBSCRIPTION_CANCELLATION
//                              → atualiza compras.status (bloqueia conteúdo no app).
//
// Segurança:
//   - Valida o header X-Hotmart-Hottok contra o secret HOTMART_HOTTOK.
//   - Usa a service_role key via env (nunca exposta ao cliente).
//   - O app consulta compras via RLS (só o próprio usuário lê as próprias linhas).
//
// Secrets (Edge Functions → Secrets, no dashboard):
//   HOTMART_HOTTOK       → token configurado no painel da Hotmart
//   APP_URL              → https://tinobem.app (redirect_to do e-mail de convite)
//
// Teste sem gravar: envie o POST com o header "X-Dry-Run: 1".

import { createClient } from 'jsr:@supabase/supabase-js@2'

// ─── Configuração ─────────────────────────────────────────────────────────────

const PRODUCT_MAP: Record<string, string> = { 'TinoBem': 'tinobem' }

const ALLOWED_EVENTS = [
  'PURCHASE_APPROVED',
  'PURCHASE_CANCELED',
  'PURCHASE_REFUNDED',
  'PURCHASE_PROTEST',
  'PURCHASE_BILLET_PRINTED',
  'PURCHASE_CHARGEBACK',
  'SUBSCRIPTION_CANCELLATION',
] as const

const STATUS_APROVADO = 'PURCHASE_APPROVED'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Compras (PURCHASE_*):       data.buyer → { email, first_name, last_name, ... }
// Assinatura cancelada:       data.subscriber → { email, name, phone: {...} }
function normalizeBuyer(body: any) {
  const data = body?.data

  if (data?.subscriber) {
    const s = data.subscriber
    const ddd = s.phone?.dddCell || s.phone?.dddPhone || ''
    const phone = s.phone?.cell || s.phone?.phone || ''
    return { email: s.email, nome: s.name || '', telefone: `${ddd}${phone}` }
  }

  if (data?.buyer) {
    const b = data.buyer
    return {
      email: b.email,
      nome: `${b.first_name || ''} ${b.last_name || ''}`.trim(),
      telefone: `${b.checkout_phone_code || ''}${b.checkout_phone || ''}`,
    }
  }

  return null
}

// ─── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Health check simples (útil para confirmar que a função está no ar).
  if (req.method === 'GET') {
    return json({ ok: true, service: 'hotmart-webhook', ts: Date.now() })
  }
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  // 1. Valida autenticidade via Hottok.
  const hottok = req.headers.get('X-Hotmart-Hottok')
  const esperado = Deno.env.get('HOTMART_HOTTOK')
  if (!esperado || hottok !== esperado) {
    return json({ ok: false, error: 'Unauthorized' }, 401)
  }

  // 2. Parseia o corpo.
  let body: any
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, error: 'JSON inválido' }, 400)
  }

  const event: string | undefined = body?.event
  const productName: string | undefined = body?.data?.product?.name
  const buyer = normalizeBuyer(body)

  // 3. Valida evento e produto.
  if (!ALLOWED_EVENTS.includes(event as any)) {
    return json({ ok: true, skipped: true, reason: `Evento '${event}' ignorado` })
  }

  const produto = PRODUCT_MAP[productName ?? '']
  if (!produto) {
    // Produto desconhecido (ex: "Produto test postback2" do modo teste da
    // Hotmart). Ignora com 200 para o teste de conexão passar sem erro.
    console.warn(`[hotmart-webhook] Produto não mapeado ignorado: ${productName}`)
    return json({ ok: true, skipped: true, reason: `Produto não mapeado: ${productName}` })
  }

  const email = String(buyer?.email || '').toLowerCase().trim()
  if (!email) {
    return json({ ok: false, error: 'E-mail do comprador não encontrado no webhook' }, 400)
  }

  // Cliente admin (service_role): ignora RLS, usado apenas no servidor.
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) {
    return json({ ok: false, error: 'configuracao_invalida' }, 500)
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  // 4. Dry-run: responde o plano sem gravar nada.
  if (req.headers.get('X-Dry-Run') === '1') {
    const existente = await acharUsuarioPorEmail(admin, email)
    return json({
      ok: true,
      dryRun: true,
      plano: {
        email,
        nome: buyer.nome || '',
        telefone: buyer.telefone || '',
        produto,
        evento: event,
        acao: existente ? 'updated' : event === STATUS_APROVADO ? 'created' : 'ignored',
        convite: !existente && event === STATUS_APROVADO,
      },
    })
  }

  // 5. Fluxo real.
  try {
    if (event === STATUS_APROVADO) {
      const result = await processarAprovacao(admin, {
        email, nome: buyer.nome || '', telefone: buyer.telefone || '', produto,
      })
      return json({ ok: true, ...result })
    }

    const result = await processarBloqueio(admin, { email, produto, evento: event! })
    return json({ ok: true, ...result })
  } catch (err) {
    console.error('[hotmart-webhook] Erro:', err instanceof Error ? err.message : err)
    return json({ ok: false, error: 'Erro ao processar webhook' }, 500)
  }
})

// ─── Lógica ───────────────────────────────────────────────────────────────────

/** Busca o usuário pelo e-mail (coluna profiles.email, mantida pelo app). */
async function acharUsuarioPorEmail(admin: ReturnType<typeof createClient>, email: string) {
  const { data, error } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()
  if (error) throw error
  return data ?? null
}

/**
 * PURCHASE_APPROVED: se o usuário ainda não existe, cria via convite (sem senha)
 * e dispara o e-mail de convite (SMTP Brevo). Depois grava a compra.
 * Se já existe, apenas grava/atualiza a compra (sem novo convite).
 */
async function processarAprovacao(
  admin: ReturnType<typeof createClient>,
  { email, nome, telefone, produto }: { email: string; nome: string; telefone: string; produto: string },
) {
  let existente = await acharUsuarioPorEmail(admin, email)

  if (!existente) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: Deno.env.get('APP_URL') || '',
      data: { nome, telefone, convidado: true },
    })
    if (error) throw error

    const userId = data?.user?.id
    if (!userId) throw new Error('Falha ao criar usuário via convite')

    // O trigger on_auth_user_created já cria a linha do perfil (só com id).
    // Upsert preenche email/nome/telefone sem conflito de chave primária.
    const { error: profErr } = await admin.from('profiles').upsert(
      { id: userId, nome, email, telefone },
      { onConflict: 'id' },
    )
    if (profErr) throw profErr

    existente = { id: userId }
  }

  await gravarCompra(admin, existente.id, produto, STATUS_APROVADO)
  return { action: existente.id ? 'created' : 'updated', userId: existente.id, email, produto }
}

/**
 * Eventos de bloqueio: só atualiza compras.status (o app decide o acesso).
 * Se o usuário não existe (nunca teve conta), ignora sem erro.
 */
async function processarBloqueio(
  admin: ReturnType<typeof createClient>,
  { email, produto, evento }: { email: string; produto: string; evento: string },
) {
  const existente = await acharUsuarioPorEmail(admin, email)
  if (!existente) {
    return { action: 'ignored', reason: 'usuário sem conta', email, produto, evento }
  }
  await gravarCompra(admin, existente.id, produto, evento)
  return { action: 'updated', userId: existente.id, email, produto, evento }
}

/** Upsert em compras: uma linha por (user_id, produto), atualizando status. */
async function gravarCompra(admin: ReturnType<typeof createClient>, userId: string, produto: string, status: string) {
  const { error } = await admin
    .from('compras')
    .upsert(
      { user_id: userId, produto, status, evento: status, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,produto' },
    )
  if (error) throw error
}