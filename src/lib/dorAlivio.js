// Alívio/intervenções de dor para a linha do tempo e o Relatório IA.
// Cada registro de dor (type === 'pain') pode carregar em meta.intervencoes
// um histórico cronológico { ts, acao, nota, nivel } do momento em que o
// usuário fez algo para aliviar. Uma dor é considerada ALIVIADA quando algum
// item registra nivel === 'total'. Dores sem intervenções permanecem "ativas".
// Tudo é função pura sobre o array de entries (mesmo padrão de meds.js).

export const NIVEIS_ALIVIO = [
  { id: 'nenhum', label: 'Sem mudança' },
  { id: 'pouco',  label: 'Pouco alívio' },
  { id: 'parcial', label: 'Alívio parcial' },
  { id: 'total',  label: 'Alívio total' },
];

export const ACOES_ALIVIO = [
  'Soltar gases',
  'Bolsa térmica no abdômen',
  'Chá de hortelã',
  'Chá de camomila',
  'Tomei remédio',
  'Evacuar',
  'Massagem',
  'Posição/deitar',
];

export function labelNivel(id) {
  const n = NIVEIS_ALIVIO.find((x) => x.id === id);
  return n ? n.label : (id || '');
}

// Intervenções válidas do registro (ordem cronológica, com ts numérico).
export function obterIntervencoes(entry) {
  if (!entry || !Array.isArray(entry.meta?.intervencoes)) return [];
  return entry.meta.intervencoes
    .filter((i) => i && typeof i === 'object')
    .map((i) => ({ ...i }))
    .sort((a, b) => (a.ts || 0) - (b.ts || 0));
}

// Duração do episódio em minutos (dor → intervenção com nível total).
// Sem nível total, retorna null. Timezone-safe: apenas diferença de ts.
export function duracaoDorMin(entry) {
  const ts = Number(entry?.ts ?? entry?.timestamp);
  if (!Number.isFinite(ts)) return null;
  const intervs = obterIntervencoes(entry);
  const alivio = intervs.find((i) => i.nivel === 'total');
  if (!alivio || !Number.isFinite(Number(alivio.ts))) return null;
  return Math.max(0, Math.round((Number(alivio.ts) - ts) / 60000));
}

export function formatarDuracao(min) {
  if (!Number.isFinite(min)) return null;
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h:${String(m).padStart(2, '0')}m` : `${h}h`;
}

export function dorAliviada(entry) {
  return obterIntervencoes(entry).some((i) => i.nivel === 'total');
}

// Relatório IA — agrega só dores ALIVIADAS (com nível total). Cada episódio
// preserva intensidade, regiões, intervenções e duração; também calcula
// frequência das ações mais usadas e a duração média até o alívio.
export function agruparAliviosDor(entries) {
  if (!Array.isArray(entries)) return { episodios: [], maisFrequentes: [], alivioMedioMin: null, n: 0 };
  const episodios = [];
  const acaoCount = new Map();
  const duracoes = [];

  for (const e of entries) {
    if (!e || e.type !== 'pain' || !dorAliviada(e)) continue;
    const intervs = obterIntervencoes(e);
    const regioes = [];
    (e.meta?.clouds || []).forEach((c) => {
      const label = c.regionLabel || c.region || c.organ;
      if (label && !regioes.includes(label)) regioes.push(label);
    });
    if (e.meta?.regionLabel && !regioes.includes(e.meta.regionLabel)) regioes.push(e.meta.regionLabel);
    if (e.meta?.region && !regioes.includes(e.meta.region)) regioes.push(e.meta.region);

    for (const i of intervs) {
      if (i.acao && String(i.acao).trim()) {
        const acao = String(i.acao).trim();
        acaoCount.set(acao, (acaoCount.get(acao) || 0) + 1);
      }
    }

    const dur = duracaoDorMin(e);
    if (dur !== null) duracoes.push(dur);

    episodios.push({
      id: e.id,
      ts: e.ts || e.timestamp || 0,
      day: e.day || '',
      time: e.time || '',
      title: e.title || 'Dor',
      intensity: Number(e.meta?.intensity ?? e.intensity ?? 0),
      regioes,
      intervencoes: intervs.map((i) => ({
        acao: i.acao || '',
        nota: i.nota || '',
        nivel: i.nivel || null,
        ts: i.ts || 0,
      })),
      duracaoMin: dur,
    });
  }

  episodios.sort((a, b) => (b.ts || 0) - (a.ts || 0));

  const maisFrequentes = [...acaoCount.entries()]
    .map(([acao, n]) => ({ acao, n }))
    .sort((a, b) => b.n - a.n || a.acao.localeCompare(b.acao))
    .slice(0, 5);

  const alivioMedioMin = duracoes.length
    ? Math.round(duracoes.reduce((s, x) => s + x, 0) / duracoes.length)
    : null;

  return { episodios, maisFrequentes, alivioMedioMin, n: episodios.length };
}