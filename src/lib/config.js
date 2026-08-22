// ─── Configuração do app controlada pelo Supabase (tabela public.app_config) ──
// Key-value genérico: links (reativar_acesso_url), textos e feature flags
// (feature_* = '1'/'0'). Editável pelo dono no dashboard (Table Editor) sem
// mudança de código. Leitura pública via RLS (sem escrita pelo cliente).

import { supabase } from './supabaseClient.js';

/** Lê todas as chaves de app_config e devolve um mapa { chave: valor }. */
export async function carregarConfigApp() {
  try {
    if (!supabase) return {};
    const { data, error } = await supabase.from('app_config').select('key, value');
    if (error) return {};
    const mapa = {};
    (data || []).forEach((r) => {
      mapa[r.key] = r.value;
    });
    return mapa;
  } catch {
    return {};
  }
}

/** Feature flag: ativo quando o valor for '1' ou 'true'. Ausente/inválido = off. */
export function flagAtivo(configApp, key) {
  const v = (configApp || {})[key];
  return v === '1' || v === 'true';
}
