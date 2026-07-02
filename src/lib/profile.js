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