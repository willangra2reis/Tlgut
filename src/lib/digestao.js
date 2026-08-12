// Digestão como sub-registro da Refeição para a linha do tempo e o Relatório IA.
// Cada refeição (type === 'meal') pode carregar em meta.digestoes um histórico
// cronológico { ts, sintomas, acao, nota, nivel } de como o usuário se sentiu
// após comer. A digestão é considerada ALIVIADA quando algum item registra
// nivel === 'total'. Refeições sem digestões permanecem "sem registro".
// Tudo é função pura sobre o array de entries (mesmo padrão de dorAlivio.js).

import { NIVEIS_ALIVIO, labelNivel, formatarDuracao } from './dorAlivio.js';

export const ACOES_DIGESTAO = [
  'Antiácido',
  'Chá de hortelã',
  'Chá de camomila',
  'Água com gás',
  'Caminhar',
  'Descansar/deitar',
  'Evacuar',
  'Alimento leve',
  'Esperar',
  'Nada',
];

export { NIVEIS_ALIVIO, labelNivel, formatarDuracao };

// Sintomas gástricos reaproveitados do formulário avulso de Digestão.
// 'Digestão boa' é a opção positiva (sem desconforto); é mutuamente exclusiva
// com os sintomas de desconforto no fluxo do sub-registro.
export const DIA_SINTOMAS = [
  'Digestão boa', 'Estômago cheio', 'Empachamento', 'Azia', 'Queimação', 'Enjoo/Náusea',
  'Refluxo', 'Arrotos', 'Peso no estômago', 'Digestão lenta', 'Estufamento',
  'Cólica gástrica', 'Apetite reduzido',
];

// True quando o usuário marcou o desconforto como ausente ('Digestão boa').
export function digestaoBoa(sintomas) {
  return Array.isArray(sintomas) && sintomas.includes('Digestão boa');
}

// Registros de digestão válidos da refeição (ordem cronológica, ts numérico).
export function obterDigestoes(entry) {
  if (!entry || !Array.isArray(entry.meta?.digestoes)) return [];
  return entry.meta.digestoes
    .filter((i) => i && typeof i === 'object')
    .map((i) => ({ ...i }))
    .sort((a, b) => (a.ts || 0) - (b.ts || 0));
}

// Duração até a digestão se resolver (refeição → registro com nível total).
// Sem nível total, retorna null. Timezone-safe: apenas diferença de ts.
export function duracaoDigestaoMin(entry) {
  const ts = Number(entry?.ts ?? entry?.timestamp);
  if (!Number.isFinite(ts)) return null;
  const registros = obterDigestoes(entry);
  const alivio = registros.find((i) => i.nivel === 'total');
  if (!alivio || !Number.isFinite(Number(alivio.ts))) return null;
  return Math.max(0, Math.round((Number(alivio.ts) - ts) / 60000));
}

export function digestaoAliviada(entry) {
  return obterDigestoes(entry).some((i) => i.nivel === 'total');
}

// Relatório IA — agrega refeições com digestão ALIVIADA (nível total). Cada
// episódio preserva alimentos, sintomas, intervenções e duração; também calcula
// frequência das ações mais usadas e a duração média até a melhora.
export function agruparAliviosDigestao(entries) {
  if (!Array.isArray(entries)) return { episodios: [], maisFrequentes: [], alivioMedioMin: null, n: 0 };
  const episodios = [];
  const acaoCount = new Map();
  const duracoes = [];

  for (const e of entries) {
    if (!e || e.type !== 'meal' || !digestaoAliviada(e)) continue;
    const registros = obterDigestoes(e);

    for (const i of registros) {
      if (i.acao && String(i.acao).trim()) {
        const acao = String(i.acao).trim();
        acaoCount.set(acao, (acaoCount.get(acao) || 0) + 1);
      }
    }

    const dur = duracaoDigestaoMin(e);
    if (dur !== null) duracoes.push(dur);

    episodios.push({
      id: e.id,
      ts: e.ts || e.timestamp || 0,
      day: e.day || '',
      time: e.time || '',
      title: e.title || 'Refeição',
      alimentos: Array.isArray(e.meta?.tags) ? e.meta.tags : [],
      digestoes: registros.map((i) => ({
        sintomas: Array.isArray(i.sintomas) ? i.sintomas : [],
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