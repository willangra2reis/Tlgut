// Camada de persistência do Relatório Express — hoje localStorage, pronto para Supabase.
// - Draft (rascunho do textarea + mapa de dores) auto-salvo enquanto o usuário escreve.
// - Reports (relatórios gerados persistidos para histórico de preparação).

const DRAFT_KEY = 'tlgut_express_draft';
const REPORTS_KEY = 'tlgut_express_reports';

// ── Draft ──────────────────────────────────────────────────────────────────
export function loadExpressDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return { narrative: '', pain_map: { clouds: [], intensity: 5 }, updated_at: 0 };
    const obj = JSON.parse(raw);
    return {
      narrative: typeof obj.narrative === 'string' ? obj.narrative : '',
      pain_map: obj.pain_map && Array.isArray(obj.pain_map.clouds)
        ? { clouds: obj.pain_map.clouds, intensity: Number.isFinite(obj.pain_map.intensity) ? obj.pain_map.intensity : 5 }
        : { clouds: [], intensity: 5 },
      updated_at: Number.isFinite(obj.updated_at) ? obj.updated_at : 0,
    };
  } catch {
    return { narrative: '', pain_map: { clouds: [], intensity: 5 }, updated_at: 0 };
  }
}

export function saveExpressDraft({ narrative, pain_map }) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      narrative: narrative || '',
      pain_map: pain_map || { clouds: [], intensity: 5 },
      updated_at: Date.now(),
    }));
  } catch {}
}

export function clearExpressDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {}
}

// ── Reports (histórico) ─────────────────────────────────────────────────────
export function loadExpressReports() {
  try {
    const raw = localStorage.getItem(REPORTS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveExpressReport(report) {
  const list = loadExpressReports();
  const item = {
    id: 'r-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    report,
    created_at: Date.now(),
  };
  const next = [item, ...list].slice(0, 20); // cap histórico em 20
  try {
    localStorage.setItem(REPORTS_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

export function removeExpressReport(id) {
  const list = loadExpressReports().filter((r) => r.id !== id);
  try {
    localStorage.setItem(REPORTS_KEY, JSON.stringify(list));
  } catch {}
  return list;
}