// Camada de persistência unificada de relatórios (Express + IA).
// Hoje localStorage; comentários TODO Supabase indicam onde trocar por chamadas
// ao banco quando a integração for feita.
//
// Estratégia FIFO: máximo MAX_REPORTS por usuário. Ao inserir o (N+1)-ésimo,
// o mais antigo é removido automaticamente.

const REPORTS_KEY = 'tlgut_reports';
const MAX_REPORTS = 10;

// ── Utilitário ──────────────────────────────────────────────────────────────
function generateId() {
  return 'r_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

function loadAllRaw() {
  try {
    const raw = localStorage.getItem(REPORTS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function persistAll(arr) {
  try {
    localStorage.setItem(REPORTS_KEY, JSON.stringify(arr));
  } catch {}
}

// ── API pública ─────────────────────────────────────────────────────────────

// TODO Supabase: trocar loadAllRaw / persistAll por supabase.from('reports')
//   .select('*').eq('user_id', uid).order('created_at', { ascending: false })

export function loadReports(type) {
  const all = loadAllRaw();
  return type ? all.filter(r => r.type === type) : all;
}

export function saveReport({ type, report, modelo, period_start, period_end }) {
  // Validação: não salvar relatórios inválidos/truncados
  if (!report
      || typeof report.resumo_executivo !== 'string'
      || !report.resumo_executivo.trim()
      || !Array.isArray(report.correlacoes)) {
    return { saved: null, removedId: null };
  }

  const all = loadAllRaw();
  const preview =
    report.resumo_executivo
      ? report.resumo_executivo.replace(/\n+/g, ' ').slice(0, 120)
      : '';

  const item = {
    id: generateId(),
    type,
    report,
    created_at: Date.now(),
    modelo: modelo || null,
    period_start: period_start || null,
    period_end: period_end || null,
    resumo_preview: preview,
  };

  const next = [item, ...all].slice(0, MAX_REPORTS);
  const removedId = next.length < all.length ? all[all.length - 1]?.id : null;

  persistAll(next);
  return { saved: item, removedId };
}

export function removeReport(id) {
  const all = loadAllRaw().filter(r => r.id !== id);
  persistAll(all);
  return all;
}

export function getReportCount(type) {
  const all = loadAllRaw();
  return type ? all.filter(r => r.type === type).length : all.length;
}

export { MAX_REPORTS };

// ── Migração única: converte relatórios Express antigos (tlgut_express_reports)
//    para o novo formato unificado. Executar uma vez na inicialização.
export function migrarExpressLegado() {
  try {
    const raw = localStorage.getItem('tlgut_express_reports');
    if (!raw) return;
    const antigos = JSON.parse(raw);
    if (!Array.isArray(antigos) || antigos.length === 0) return;
    const atuais = loadAllRaw();
    const idsAtuais = new Set(atuais.map(r => r.id));
    let novos = [...atuais];
    for (const item of antigos) {
      if (idsAtuais.has(item.id)) continue;
      novos.push({
        id: item.id || generateId(),
        type: 'express',
        report: item.report || item,
        created_at: item.created_at || Date.now(),
        modelo: null,
        period_start: null,
        period_end: null,
        resumo_preview:
          item.report?.resumo_executivo
            ? item.report.resumo_executivo.replace(/\n+/g, ' ').slice(0, 120)
            : '',
      });
    }
    novos = novos.slice(0, MAX_REPORTS);
    persistAll(novos);
    localStorage.removeItem('tlgut_express_reports');
  } catch {}
}
