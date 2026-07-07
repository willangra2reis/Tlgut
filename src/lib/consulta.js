// Camada de persistência de consultas — hoje localStorage, pronto para Supabase.
// Modelo array-based: [{ id, data, especialidade?, status, created_at }]
// A UI mostra apenas a próxima consulta (menor data futura), mas o schema
// comporta N consultas, evitando migration futuro.

const KEY = 'tlgut_consultas';
const LEGACY_KEY = 'tlgut_consulta_date'; // string única (formato antigo)

function safeRead() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : null;
  } catch {
    return null;
  }
}

function safeWrite(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}

// Migração one-time: converte `tlgut_consulta_date` (string) → array.
// Executada apenas se o formato novo estiver vazio e o formato antigo existir.
function maybeMigrate() {
  const arr = safeRead();
  if (arr && arr.length > 0) return arr;
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const migrated = [{
        id: 'migrated-' + Date.now(),
        data: legacy,
        especialidade: null,
        status: 'agendada',
        created_at: Date.now(),
      }];
      safeWrite(migrated);
      return migrated;
    }
  } catch {}
  return arr || [];
}

export function loadConsultas() {
  return maybeMigrate();
}

export function saveConsultas(list) {
  safeWrite(Array.isArray(list) ? list : []);
}

export function addConsulta({ data, especialidade = null }) {
  const list = loadConsultas();
  const item = {
    id: 'c-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    data,
    especialidade,
    status: 'agendada',
    created_at: Date.now(),
  };
  const next = [...list, item];
  saveConsultas(next);
  return next;
}

export function removeConsulta(id) {
  const list = loadConsultas().filter((c) => c.id !== id);
  saveConsultas(list);
  return list;
}

// Retorna a próxima consulta agendada (menor data futura), ou null.
export function proximaConsulta() {
  const agora = Date.now();
  const futuras = loadConsultas()
    .filter((c) => c.status === 'agendada' && c.data)
    .map((c) => ({ ...c, _ts: new Date(c.data + 'T00:00:00').getTime() }))
    .filter((c) => Number.isFinite(c._ts) && c._ts >= agora - 24 * 3600000) // tolera +24h após o dia da consulta
    .sort((a, b) => a._ts - b._ts);
  return futuras.length > 0 ? futuras[0] : null;
}

// Exporta todas as consultas agendadas futuras (ordenadas).
export function consultasAgendadas() {
  return loadConsultas()
    .filter((c) => c.status === 'agendada' && c.data)
    .map((c) => ({ ...c, _ts: new Date(c.data + 'T00:00:00').getTime() }))
    .filter((c) => Number.isFinite(c._ts))
    .sort((a, b) => a._ts - b._ts);
}