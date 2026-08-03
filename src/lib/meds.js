// Agrupamento de medicamentos para o Relatório IA.
// Cada registro de medicamento (type === 'medication') guarda o nome em
// meta.tags (ou title/description) e, opcionalmente, a finalidade em
// meta.finalidade e uma observação em meta.note. Agrupa por nome único,
// completando lacunas de finalidade/nota entre registros do mesmo remédio.
export function agruparMedicamentos(entries) {
  if (!Array.isArray(entries)) return [];
  const mapa = new Map();
  for (const e of entries) {
    if (!e || e.type !== 'medication') continue;
    const tags = Array.isArray(e.meta?.tags) ? e.meta.tags : [];
    const nome = tags.length
      ? tags.join(', ')
      : (String(e.title || '').trim() || 'Medicamento');
    if (!nome) continue;
    const atual = mapa.get(nome) || { nome, finalidade: '', nota: '' };
    if (!atual.finalidade && e.meta?.finalidade && String(e.meta.finalidade).trim()) {
      atual.finalidade = String(e.meta.finalidade).trim();
    }
    if (!atual.nota && e.meta?.note && String(e.meta.note).trim()) {
      atual.nota = String(e.meta.note).trim();
    }
    mapa.set(nome, atual);
  }
  return [...mapa.values()];
}
