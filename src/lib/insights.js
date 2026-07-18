// ─── Análise de Insights (cálculo no cliente) + histórico mockado ─────────────
// Funções puras e determinísticas. Hoje operam sobre um histórico mockado; com
// o Supabase, receberão o mesmo formato de registros vindos do banco — a lógica
// não muda. Nada aqui envolve rede ou IA (RF 9.1).

export const HORA = 3600 * 1000;
export const DIA = 24 * HORA;

const REGIOES_DOR = ['regiao_peitoral_esq', 'regiao_peitoral_dir', 'regiao_peitoral_centro', 'regiao_sup_esq', 'regiao_sup_dir', 'regiao_sup_centro', 'regiao_centro', 'regiao_inf_esq', 'regiao_inf_dir', 'regiao_inf_centro'];

// PRNG determinístico (mulberry32) — mock reproduzível a partir de uma seed.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Gera um Historico_Mock de `dias` dias terminando em `fim` (epoch ms).
// Padrões plantados: pouca água → Bristol mais baixo e mais dor; refeição pesada
// → dor ~1–3 h depois; sono ruim → mais dor no dia seguinte (RF 9.8).
export function gerarHistoricoMock(dias = 75, seed = 20260618, fim = Date.UTC(2026, 5, 18)) {
  const rnd = mulberry32(seed);
  const ri = (min, max) => min + Math.floor(rnd() * (max - min + 1));
  const entries = [];
  const push = (ts, type, extra) => entries.push({ ts, type, ...extra });
  let sonoRuimOntem = false;

  for (let d = dias - 1; d >= 0; d -= 1) {
    const base = fim - d * DIA;
    const at = (h, m = 0) => base + h * HORA + m * 60000;

    const copos = ri(2, 10);
    for (let i = 0; i < copos; i += 1) push(at(7 + (i % 14), ri(0, 59)), 'water', { glasses: 1 });
    const poucaAgua = copos <= 4;

    const qualidade = ri(1, 5);
    push(at(7, 30), 'sleep', { quality: qualidade });
    const sonoRuim = qualidade <= 2;

    push(at(7, 45), 'meal', { heavy: false, tags: ['Café', 'Pão/Trigo'] });
    const almocoPesado = rnd() < 0.4;
    const tAlmoco = at(12, ri(0, 40));
    const tagsAlmoco = ['Arroz'];
    if (almocoPesado) tagsAlmoco.push('Frituras');
    if (rnd() < 0.3) tagsAlmoco.push('Carne vermelha');
    push(tAlmoco, 'meal', { heavy: almocoPesado, tags: tagsAlmoco });
    const jantaFeijao = rnd() < 0.45;
    const tJantar = at(20, ri(0, 40));
    push(tJantar, 'meal', { heavy: rnd() < 0.3, tags: jantaFeijao ? ['Feijão', 'Arroz'] : ['Frango', 'Verduras/Salada'] });

    // Gases: gatilho plantado — feijão no jantar → gases ~9–12 h depois (manhã
    // seguinte, cruzando a meia-noite); mais alguns gases de base.
    if (jantaFeijao && rnd() < 0.7) push(tJantar + (9 + rnd() * 3) * HORA, 'gas', { nivel: ri(2, 3) });
    if (rnd() < 0.25) push(at(15, ri(0, 59)), 'gas', { nivel: ri(1, 2) });

    if (rnd() < 0.5) push(at(18, ri(0, 30)), 'exercise', { minutes: ri(15, 60) });

    const pDor = 0.12 + (poucaAgua ? 0.3 : 0) + (almocoPesado ? 0.3 : 0) + (sonoRuimOntem ? 0.2 : 0);
    if (rnd() < pDor) {
      const atrasoH = 1 + rnd() * 2; // dor ~1–3 h após o almoço (proximidade temporal)
      const intensidade = Math.min(10, ri(4, 7) + (poucaAgua ? 1 : 0) + (almocoPesado ? 1 : 0));
      const organ = almocoPesado ? 'regiao_sup_esq' : REGIOES_DOR[ri(0, REGIOES_DOR.length - 1)];
      push(tAlmoco + atrasoH * HORA, 'pain', { intensity: intensidade, organ });
    }

    push(at(21, 0), 'mood', { score: Math.max(1, ri(2, 5) - (poucaAgua || sonoRuim ? 1 : 0)) });

    const bristol = poucaAgua ? ri(1, 3) : ri(3, 6); // planta água ↔ Bristol
    push(at(8, ri(0, 59)), 'evacuation', { bristol });

    // Medicamento (RF 15.5): registro ocasional de manhã. Gatilho plantado para
    // visualização do cruzamento medicamento→sintoma — em dias com 'Antibiótico'
    // (~20%), eleva a chance de gases algumas horas depois (dentro da janela de
    // 12 h). Determinístico via rnd(); fica no fim do loop para não alterar a
    // sequência do PRNG dos padrões já plantados (feijão→gases etc.).
    const antibiotico = rnd() < 0.2;
    if (antibiotico) {
      push(at(8, ri(0, 30)), 'medication', { tags: ['Antibiótico'] });
      if (rnd() < 0.85) push(at(ri(10, 14), ri(0, 59)), 'gas', { nivel: ri(2, 3) });
    } else if (rnd() < 0.3) {
      push(at(8, ri(0, 30)), 'medication', { tags: rnd() < 0.5 ? ['Suplemento'] : ['Vitamina'] });
    }

    sonoRuimOntem = sonoRuim;
  }

  return entries.sort((a, b) => a.ts - b.ts);
}

// Chave do dia (dia fisiológico começa às 04:00) — eventos da madrugada contam
// para o dia anterior, evitando o problema da virada da meia-noite.
function diaChave(ts) {
  const d = new Date(ts - 4 * HORA);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

// Eventos do tipoB que ocorrem até `janelaHoras` após um evento do tipoA.
// Núcleo da proximidade temporal (Janela_Temporal, RF 9.4).
export function eventosProximos(history, tipoA, tipoB, janelaHoras) {
  const as = history.filter((e) => e.type === tipoA).sort((a, b) => a.ts - b.ts);
  const bs = history.filter((e) => e.type === tipoB).sort((a, b) => a.ts - b.ts);
  const limite = Math.max(0, janelaHoras) * HORA;
  const pares = [];
  bs.forEach((b) => {
    let melhor = null;
    for (let i = as.length - 1; i >= 0; i -= 1) {
      if (as[i].ts <= b.ts && b.ts - as[i].ts <= limite) { melhor = as[i]; break; }
      if (as[i].ts < b.ts - limite) break;
    }
    if (melhor) pares.push({ a: melhor, b, horas: (b.ts - melhor.ts) / HORA });
  });
  return pares;
}

// Intervalo típico entre refeição e dor subsequente (proximidade temporal).
export function intervalosRefeicaoDor(history, janelaHoras = 6, minPares = 5) {
  const pares = eventosProximos(history, 'meal', 'pain', janelaHoras);
  const horas = pares.map((p) => p.horas).sort((x, y) => x - y);
  if (horas.length < minPares) return { status: 'insuficiente', n: horas.length, pares };
  const mediana = horas[Math.floor(horas.length / 2)];
  return { status: 'ok', n: horas.length, mediana, pares };
}

// Coeficiente de correlação de Pearson — sempre em [-1, 1] (0 se indefinido).
export function correlacao(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  let mx = 0; let my = 0;
  for (let i = 0; i < n; i += 1) { mx += xs[i]; my += ys[i]; }
  mx /= n; my /= n;
  let num = 0; let dx = 0; let dy = 0;
  for (let i = 0; i < n; i += 1) {
    const a = xs[i] - mx; const b = ys[i] - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  if (den === 0) return 0;
  const r = num / den;
  return Math.max(-1, Math.min(1, r));
}

// Relação água (copos/dia) × Bristol médio do dia.
export function correlacaoAguaBristol(history, minDias = 7) {
  const porDia = new Map();
  history.forEach((e) => {
    const k = diaChave(e.ts);
    if (!porDia.has(k)) porDia.set(k, { agua: 0, bristol: [] });
    const dia = porDia.get(k);
    if (e.type === 'water') dia.agua += e.glasses || 1;
    if (e.type === 'evacuation' && Number.isInteger(e.bristol)) dia.bristol.push(e.bristol);
  });
  const pontos = [];
  porDia.forEach((v, k) => {
    if (v.bristol.length) {
      const media = v.bristol.reduce((s, x) => s + x, 0) / v.bristol.length;
      pontos.push({ dia: k, agua: v.agua, bristol: media });
    }
  });
  if (pontos.length < minDias) return { status: 'insuficiente', n: pontos.length, pontos };
  const r = correlacao(pontos.map((p) => p.agua), pontos.map((p) => p.bristol));
  return { status: 'ok', n: pontos.length, pontos, r };
}

// Contagem de dor por região do corpo (Mapa_de_Calor_da_Dor).
// 1+ pontos marcados em um mesmo evento contam como 1 episódio por região.
export function dorPorRegiao(history) {
  const counts = {};
  const seen = new Set();
  history.forEach((e) => {
    if (e.type !== 'pain') return;
    seen.clear();
    const ids = [e.region || e.organ, e.meta?.region || e.meta?.organ, ...(e.meta?.clouds || []).map(c => c.region || c.organ)];
    ids.forEach((id) => {
      if (id && !seen.has(id)) {
        seen.add(id);
        counts[id] = (counts[id] || 0) + 1;
      }
    });
  });
  return counts;
}

// Série diária de uma métrica (preenche dias sem registro com 0), para gráficos
// de tendência. `modo`: 'soma' (ex.: copos de água) ou 'media' (ex.: intensidade
// de dor, qualidade do sono). `campo` é o atributo numérico do registro.
export function seriePorDia(history, type, campo, modo = 'soma') {
  if (!history.length) return [];
  let min = Infinity; let max = -Infinity;
  history.forEach((e) => { const k = diaChave(e.ts); if (k < min) min = k; if (k > max) max = k; });
  const buckets = new Map();
  history.forEach((e) => {
    if (e.type !== type) return;
    const k = diaChave(e.ts);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(campo ? (e[campo] ?? 0) : 1);
  });
  const serie = [];
  for (let k = min; k <= max; k += DIA) {
    const vals = buckets.get(k) || [];
    let valor;
    if (modo === 'media') valor = vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : 0;
    else valor = vals.reduce((s, x) => s + x, 0);
    serie.push({ dia: k, valor });
  }
  return serie;
}

// Média móvel trailing dos últimos `janela` dias (suaviza a série de tendência).
// Preserva o tamanho da série; cada valor fica dentro de [min, max] da original.
export function mediaMovel(serie, janela = 7) {
  if (!Array.isArray(serie)) return [];
  return serie.map((p, i) => {
    const ini = Math.max(0, i - janela + 1);
    const janelaVals = serie.slice(ini, i + 1).map((q) => q.valor);
    const v = janelaVals.reduce((s, x) => s + x, 0) / janelaVals.length;
    return { dia: p.dia, valor: v };
  });
}

// Correlação defasada (lagged): testa defasagens de 0..maxLag dias entre duas
// séries diárias (B ocorre `lag` dias após A) e retorna a defasagem com maior
// |correlação|. Exige um mínimo de pares sobrepostos (guarda anti-coincidência).
export function correlacaoDefasada(aVals, bVals, maxLag = 4, minPares = 14) {
  let melhor = { lag: 0, r: 0, n: 0 };
  const limite = Math.min(aVals.length, bVals.length);
  for (let lag = 0; lag <= maxLag; lag += 1) {
    const xs = [];
    const ys = [];
    for (let i = 0; i + lag < limite; i += 1) { xs.push(aVals[i]); ys.push(bVals[i + lag]); }
    if (xs.length >= minPares) {
      const r = correlacao(xs, ys);
      if (Math.abs(r) > Math.abs(melhor.r)) melhor = { lag, r, n: xs.length };
    }
  }
  if (melhor.n < minPares) return { status: 'insuficiente' };
  return { status: 'ok', lag: melhor.lag, r: melhor.r, n: melhor.n };
}

// Contexto factual da dor numa região: contagem, participação, intensidade média
// e comparação da água/sono nos dias com dor ali vs. a média geral. Observação
// dos dados — não afirma causa (RF 6/9.6).
export function contextoRegiao(history, organId) {
  const dorReg = history.filter((e) => {
    if (e.type !== 'pain') return false;
    if (e.organ === organId) return true;
    if (e.meta?.organ === organId) return true;
    return (e.meta?.clouds || []).some(c => c.organ === organId);
  });
  const totalDor = history.filter((e) => e.type === 'pain').length;
  const n = dorReg.length;
  const intensidadeMedia = n ? dorReg.reduce((s, e) => s + (e.intensity || 0), 0) / n : 0;
  const diasReg = new Set(dorReg.map((e) => diaChave(e.ts)));

  const aguaDia = new Map();
  const sonoAcc = new Map();
  history.forEach((e) => {
    const k = diaChave(e.ts);
    if (e.type === 'water') aguaDia.set(k, (aguaDia.get(k) || 0) + (e.glasses || 1));
    if (e.type === 'sleep') { if (!sonoAcc.has(k)) sonoAcc.set(k, []); sonoAcc.get(k).push(e.quality || 0); }
  });
  const sonoDia = new Map();
  sonoAcc.forEach((arr, k) => sonoDia.set(k, arr.reduce((s, x) => s + x, 0) / arr.length));

  const mediaEm = (mapa, dias) => {
    const vs = [...dias].map((k) => mapa.get(k)).filter((v) => v != null);
    return vs.length ? vs.reduce((s, x) => s + x, 0) / vs.length : null;
  };

  // Alimentos frequentes: conta cada ocorrência de tag nas refeições dos dias
  // com dor na região e retorna as top-N por frequência (desempate por ordem
  // de inserção, estável). Restrito aos dias em diasReg (RF 13.2).
  const tagCount = new Map();
  history.forEach((e) => {
    if (e.type !== 'meal' || !diasReg.has(diaChave(e.ts))) return;
    (e.tags || []).forEach((t) => tagCount.set(t, (tagCount.get(t) || 0) + 1));
  });
  const alimentosFrequentes = [...tagCount.entries()]
    .map(([tag, c]) => ({ tag, n: c }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 3);

  // Humor e Bristol médios restritos aos dias com dor na região; null sem amostra
  // (RF 13.3/13.4). Coleta todas as ocorrências do dia, não uma média por dia.
  const humores = [];
  const bristois = [];
  history.forEach((e) => {
    if (!diasReg.has(diaChave(e.ts))) return;
    if (e.type === 'mood' && e.score != null) humores.push(e.score);
    if (e.type === 'evacuation' && Number.isInteger(e.bristol)) bristois.push(e.bristol);
  });
  const media = (arr) => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null);

  return {
    n,
    share: totalDor ? n / totalDor : 0,
    intensidadeMedia,
    aguaNesses: mediaEm(aguaDia, diasReg),
    aguaGeral: mediaEm(aguaDia, new Set(aguaDia.keys())),
    sonoNesses: mediaEm(sonoDia, diasReg),
    sonoGeral: mediaEm(sonoDia, new Set(sonoDia.keys())),
    alimentosFrequentes,
    humorMedio: media(humores),
    bristolMedio: media(bristois),
  };
}

// Gatilho por tag (genérico): dentre os eventos-fonte de um tipo (`tipoFonte`),
// usa as `tags` desses eventos e encontra a tag que mais aumenta a frequência de
// um sintoma numa janela de horas após o evento (atravessa a meia-noite, pois
// usa o horário). Compara "com a tag" vs "sem a tag". Observação factual — não
// prova causa (RF 6/9.6/15.6). Reutilizado por refeição e medicamento.
export function gatilhoPorTag(history, tipoFonte, tipoSintoma, janelaHoras = 12, minEventos = 5) {
  const fontes = history.filter((e) => e.type === tipoFonte);
  const sintomas = history.filter((e) => e.type === tipoSintoma).map((e) => e.ts).sort((a, b) => a - b);
  const limite = janelaHoras * HORA;
  const temSintoma = (ts) => sintomas.some((s) => s > ts && s - ts <= limite);

  const tags = new Set();
  fontes.forEach((m) => (m.tags || []).forEach((t) => tags.add(t)));

  let melhor = null;
  tags.forEach((tag) => {
    const com = fontes.filter((m) => (m.tags || []).includes(tag));
    const sem = fontes.filter((m) => !(m.tags || []).includes(tag));
    if (com.length < minEventos) return;
    const taxaCom = com.filter((m) => temSintoma(m.ts)).length / com.length;
    const taxaSem = sem.length ? sem.filter((m) => temSintoma(m.ts)).length / sem.length : 0;
    const diff = taxaCom - taxaSem;
    if (!melhor || diff > melhor.diff) melhor = { tag, taxaCom, taxaSem, diff, n: com.length };
  });

  if (!melhor || melhor.diff < 0.1) return { status: 'insuficiente' };
  const risco = melhor.taxaSem > 0 ? melhor.taxaCom / melhor.taxaSem : null;
  return { status: 'ok', janelaHoras, tag: melhor.tag, taxaCom: melhor.taxaCom, taxaSem: melhor.taxaSem, risco, n: melhor.n };
}

// Gatilho alimentar: caso particular do gatilho por tag para refeições (`meal`).
// Mantém a assinatura pública e o comportamento idênticos. Observação factual —
// não prova causa (RF 6/9.6).
export function gatilhoAlimentar(history, tipoSintoma, janelaHoras = 12, minRefeicoes = 5) {
  return gatilhoPorTag(history, 'meal', tipoSintoma, janelaHoras, minRefeicoes);
}

// Fase aproximada do ciclo menstrual a partir da última data de início (TOTAL).
// Observação factual derivada da contagem de dias — sem diagnóstico, juízo de
// normalidade ou recomendação (RF 6/16.3/16.6). `diaDoCiclo` é 1-indexado: no
// próprio dia de início vale 1. As fases seguem um modelo aproximado de 28 dias:
// dias 1–5 'menstrual', 6–13 'folicular', 14–`duracaoCiclo` 'lutea'.
// Entradas inválidas (NaN, não numéricas, início no futuro) → 'desconhecida'.
export function faseDoCiclo(inicioTs, agoraTs, duracaoCiclo = 28) {
  const desconhecida = { fase: 'desconhecida', diaDoCiclo: null };
  if (!Number.isFinite(inicioTs) || !Number.isFinite(agoraTs)) return desconhecida;
  if (agoraTs < inicioTs) return desconhecida; // início no futuro

  // Diferença em dias fisiológicos (reutiliza diaChave) — 1-indexado.
  const diaDoCiclo = Math.floor((diaChave(agoraTs) - diaChave(inicioTs)) / DIA) + 1;
  if (!Number.isInteger(diaDoCiclo) || diaDoCiclo < 1) return desconhecida;

  // Posição dentro do ciclo (1..duracaoCiclo), repetindo a cada duracaoCiclo dias.
  const dur = Number.isInteger(duracaoCiclo) && duracaoCiclo > 0 ? duracaoCiclo : 28;
  const dentro = ((diaDoCiclo - 1) % dur) + 1;
  let fase;
  if (dentro <= 5) fase = 'menstrual';
  else if (dentro <= 13) fase = 'folicular';
  else fase = 'lutea';

  return { fase, diaDoCiclo };
}
