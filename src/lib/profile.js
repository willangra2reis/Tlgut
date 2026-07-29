// Centraliza acesso ao perfil do paciente e ao estado de onboarding.
// Hoje persistidos em localStorage; quando o Supabase for integrado via
// Pages Functions, basta trocar a implementação interna destas funções
// por cache local + fetch a '/api/profile'. Todos os callers
// (App.jsx, RelatoriasIAScreen.jsx, etc.) permanecem inalterados.

export const CONDICOES_LABELS = {
  diabetes:    'Diabetes',
  hipertensao: 'Hipertensão',
  tireoide:    'Alterações na Tireoide',
  celiaca:     'Doença Celíaca',
  lactose:     'Intolerância à Lactose',
  gluten:      'Sensibilidade ao Glúten',
};

export function loadProfile() {
  try { return JSON.parse(localStorage.getItem('tlgut_profile') || '{}'); }
  catch { return {}; }
}

export function saveProfile(p) {
  localStorage.setItem('tlgut_profile', JSON.stringify(p));
}

export function isOnboarded() {
  return localStorage.getItem('tlgut_onboarded') === '1';
}

// Anonimiza um perfil para exportação (PDF/compartilhamento): remove o nome e
// substitui idade/peso/altura por faixas ±. Condições e "outros" são mantidos
// (categóricos/contextuais, baixo risco de re-identificação).
// Retorna um novo objeto; não muta o original. Aceita {} sem quebrar.
export function anonimizarPerfil(p) {
  if (!p || typeof p !== 'object') return {};
  const out = { ...p };
  out.nome = null;
  if (Number.isFinite(p.idade))  out.idade  = `${p.idade - 3}-${p.idade + 3} anos`;
  if (Number.isFinite(p.peso))   out.peso   = `${p.peso - 5}-${p.peso + 5} kg`;
  if (Number.isFinite(p.altura)) out.altura = `${p.altura - 5}-${p.altura + 5} cm`;
  return out;
}

// Substitui o nome do usuário por "paciente" no texto gerado pela IA (ex:
// "Olá, William!" → "Olá, paciente!"). Case-insensitive. Se nome vazio, retorna
// o texto inalterado. Não toca em outras palavras.
export function anonimizarTextoIA(texto, nome) {
  if (!texto || typeof texto !== 'string') return texto || '';
  if (!nome || typeof nome !== 'string') return texto;
  const n = nome.trim();
  if (!n) return texto;
  const re = new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  return texto.replace(re, 'paciente');
}