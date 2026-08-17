// Cliente Supabase — inicialização única.
// Sem variáveis de ambiente configuradas (ou em ambiente de teste), o cliente é
// null e o app roda em modo apresentação (mock + localStorage), preservando o
// comportamento atual. Todas as funções de sync em sync.js já guardam isso.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

// Em testes (Vitest), ignora as variáveis de ambiente e segue no modo
// apresentação (mock + localStorage), preservando o comportamento dos testes.
const MODE_TEST = import.meta.env.MODE === 'test';

export const isSupabaseConfigured = () => !MODE_TEST && Boolean(SUPABASE_URL && SUPABASE_KEY);

export const supabase = isSupabaseConfigured()
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

// Retorna o id do usuário logado, ou null quando não autenticado.
export async function currentUserId() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}
