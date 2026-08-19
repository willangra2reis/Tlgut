// ─── Camada de compras (Hotmart) ─────────────────────────────────────────────
// Consulta a tabela public.compras do usuário logado (RLS: só o próprio usuário
// lê as próprias linhas). O webhook (Edge Function) grava os status; aqui apenas
// decidimos se o conteúdo está liberado: somente status = 'PURCHASE_APPROVED'.

import { supabase } from './supabaseClient.js';

export const STATUS_APROVADO = 'PURCHASE_APPROVED';

/** Statuses que bloqueiam o acesso ao conteúdo (escritos pela Edge Function). */
export const STATUS_BLOQUEIO = [
  'PURCHASE_CANCELED',
  'PURCHASE_REFUNDED',
  'PURCHASE_PROTEST',
  'PURCHASE_BILLET_PRINTED',
  'SUBSCRIPTION_CANCELLATION',
];

/**
 * Lista as compras do usuário logado (via RLS). Retorna array vazio quando não
 * há sessão ou o Supabase não está configurado (modo apresentação/demo).
 */
export async function listarCompras() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('compras')
    .select('produto, status, updated_at')
    .order('updated_at', { ascending: false });
  if (error) return [];
  return data || [];
}

/**
 * Status da compra de um produto específico (ex.: 'tinobem').
 * Retorna null se o usuário nunca comprou aquele produto.
 */
export function statusDoProduto(compras, produto) {
  const linha = (compras || []).find((c) => c.produto === produto);
  return linha?.status ?? null;
}

/** True se o produto está liberado (status = PURCHASE_APPROVED). */
export function temAcesso(compras, produto) {
  return statusDoProduto(compras, produto) === STATUS_APROVADO;
}