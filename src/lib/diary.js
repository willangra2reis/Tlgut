// ─── Funções puras e constantes de domínio do Diário Intestinal ───────────────
// Extraídas de App.jsx para manter o componente livre de exports não-componente
// (regra react-refresh/only-export-components) e para facilitar os testes de
// propriedade (PBT). Nenhuma destas funções tem efeito colateral.

// ─── Conteúdo factual da Escala de Bristol (guarda-corpo regulatório, RF 6.2) ─
// Apenas atributos observáveis (forma, consistência, textura). Sem nomes de
// condições, diagnóstico, juízo de normalidade ou recomendação.
export const BRISTOL_DESCRICOES = {
  1: 'Pedaços duros e separados, como pequenas bolinhas',
  2: 'Formato alongado, com superfície grumosa',
  3: 'Formato alongado, com rachaduras na superfície',
  4: 'Formato alongado, superfície lisa e macia',
  5: 'Pedaços macios com bordas bem definidas',
  6: 'Pedaços moles com bordas irregulares',
  7: 'Totalmente líquido, sem pedaços sólidos',
};

export const EVAC_CORES  = ['Marrom claro', 'Marrom', 'Marrom escuro', 'Amarelada', 'Esverdeada', 'Avermelhada', 'Escura'];
export const EVAC_ODORES = ['Leve', 'Moderado', 'Forte'];

export const BRISTOL_PADRAO = 4; // Valor_Padrão_Bristol (RF 5.11)

// ─── Tema por horário (ADIADO) ────────────────────────────────────────────────
// Mantidas como utilitário inativo (não usado no render), reservadas para o
// incremento futuro de temas por horário. Função TOTAL: qualquer hora fora de
// [0,23] ou não-inteira cai no fallback 'noite'.
export function periodoDoDia(hora) {
  if (!Number.isInteger(hora) || hora < 0 || hora > 23) return 'noite';
  if (hora >= 5 && hora <= 11) return 'amanhecer';
  if (hora >= 12 && hora <= 17) return 'tarde';
  return 'noite';
}

// Obtém a hora local de forma defensiva; em falha retorna NaN (→ fallback Noite).
export function horaLocalAtual() {
  try {
    return new Date().getHours();
  } catch {
    return NaN;
  }
}

// Normaliza o estado do formulário de evacuação em uma entrada válida da
// Linha do Tempo. Aplica clamp/validação defensiva (segunda barreira além da
// UI), o padrão Bristol=4 quando não selecionado (RF 5.11) e preserva campos
// opcionais ausentes como null sem bloquear o salvamento (RF 5.12).
export function buildEvacuationEntry(form) {
  const f = form || {};
  const bristol =
    Number.isInteger(f.bristol) && f.bristol >= 1 && f.bristol <= 7 ? f.bristol : BRISTOL_PADRAO;
  const cor = EVAC_CORES.includes(f.cor) ? f.cor : null;
  const odor = EVAC_ODORES.includes(f.odor) ? f.odor : null;
  const esforco =
    Number.isInteger(f.esforco) && f.esforco >= 1 && f.esforco <= 5 ? f.esforco : null;
  const tempo =
    Number.isInteger(f.tempo) && f.tempo >= 1 && f.tempo <= 120 ? f.tempo : null;
  const conforto =
    Number.isInteger(f.conforto) && f.conforto >= 1 && f.conforto <= 5 ? f.conforto : null;

  const parts = [BRISTOL_DESCRICOES[bristol]];
  if (cor) parts.push(`Cor: ${cor.toLowerCase()}`);
  if (odor) parts.push(`Odor: ${odor.toLowerCase()}`);
  if (esforco) parts.push(`Esforço ${esforco}/5`);
  if (tempo) parts.push(`${tempo} min`);

  return {
    title: 'Evacuação',
    description: parts.join(' · '),
    meta: { bristol, cor, odor, esforco, tempo, conforto },
  };
}

// Conta registros por tipo em um dado dia (base dos Chips_de_Resumo_do_Dia).
// Retorna um objeto { [type]: contagem } apenas com tipos presentes no dia.
export function contarPorTipo(entries, dia) {
  const counts = {};
  (Array.isArray(entries) ? entries : []).forEach((e) => {
    if (e && e.day === dia) {
      counts[e.type] = (counts[e.type] || 0) + 1;
    }
  });
  return counts;
}

// Remove de forma idempotente a entrada de `id` informado, preservando as
// demais inalteradas. Núcleo puro usado por handleDelete na UI (RF 2.7).
export function removerEntrada(entries, id) {
  return (Array.isArray(entries) ? entries : []).filter((e) => e && e.id !== id);
}

// ─── Evento Gases ─────────────────────────────────────────────────────────────
// Atributos observáveis (sem juízo clínico). Intensidade vira métrica 1–3 nos
// Insights via GAS_INTENSIDADES.indexOf + 1.
export const GAS_INTENSIDADES = ['Pouco', 'Moderado', 'Muito'];
export const GAS_ODORES = ['Sem odor', 'Leve', 'Moderado', 'Forte'];
export const GAS_ALIVIO = ['Aliviou', 'Continua estufado'];
export const GAS_SOM = ['Silencioso', 'Ruidoso'];

// Normaliza o formulário de Gases numa entrada válida; todos os campos opcionais.
// ─── Gerador de dados mock enriquecidos para Relatório IA ────────────────────
// Gera ~80 entries distribuídos pelos últimos 90 dias com ts, day, time reais.
// Usado apenas pelo RelatoriasIAScreen enquanto Supabase não está integrado.
export function gerarDadosRelatorioMock() {
  const agora = Date.now();
  const DIA = 86400000;
  const entries = [];
  let id = 1000;

  const comidas = ['Arroz, feijão e bife', 'Salada com frango grelhado', 'Macarrão ao sugo', 'Sopa de legumes', 'Pão com ovo', 'Omelete com queijo', 'Peixe cozido com batatas', 'Sanduíche natural', 'Frutas com iogurte', 'Café com leite e biscoito', 'Açaí com granola', 'Lasanha', 'Arroz integral com legumes', 'Batata assada com carne moída', 'Panqueca de frango'];
  const bebidas = ['Café', 'Suco de laranja', 'Chá de camomila', 'Água de coco', 'Chá verde', 'Refrigerante', 'Suco de limão', 'Chá de hortelã', 'Leite morno', 'Suco de maracujá'];
  const dores = ['Cólica', 'Queimação', 'Pontada', 'Peso no estômago', 'Cólica intensa', 'Desconforto difuso', 'Cólica leve'];
  const regioes = ['regiao_sup_esq', 'regiao_sup_dir', 'regiao_centro', 'regiao_inf_dir', 'regiao_inf_esq'];
  const humores = ['Normal', 'Ansioso', 'Cansado', 'Irritado', 'Calmo', 'Alegre', 'Triste'];
  const tagsBreakfast = ['Leite', 'Pão/Trigo', 'Açúcar/Doce', 'Café', 'Ovo', 'Frutas'];
  const tagsLunch     = ['Feijão', 'Arroz', 'Carne', 'Frituras', 'Refrigerante', 'Açúcar/Doce', 'Ovo', 'Legumes'];
  const tagsDinner    = ['Legumes', 'Frituras', 'Ovo', 'Picante', 'Pão/Trigo', 'Café', 'Feijão', 'Carne'];

  function mt(h, m) { return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; }
  function pick(arr, seed) { return arr[(seed * 7 + 13) % arr.length]; }

  for (let dAtras = 89; dAtras >= 0; dAtras--) {
    const diaTs = agora - dAtras * DIA;
    const data = new Date(diaTs);
    const day = `${String(data.getDate()).padStart(2, '0')}/${String(data.getMonth() + 1).padStart(2, '0')}`;
    const baseSeed = dAtras * 13 + 7;
    const r = (i) => (baseSeed * (i + 1) * 7 + 11) % 1000 / 1000;

    const push = (type, title, desc, meta, h, m) => {
      entries.push({ id: id++, type, day, time: mt(h, m), ts: diaTs + h * 3600000 + m * 60000, title, description: desc, meta });
    };

    // Café da manhã (~07:00-08:30)
    push('meal', 'Café da manhã', pick(comidas, baseSeed), { tags: [pick(tagsBreakfast, baseSeed)], ritmo: 'Normal', saciedade: 'Satisfeito' }, 7, 15 + Math.floor(r(1) * 60));

    // Almoço (~11:30-13:00)
    push('meal', 'Almoço', pick(comidas, baseSeed + 1), { tags: [pick(tagsLunch, baseSeed + 1), pick(tagsLunch, baseSeed + 2)], heavy: r(2) > 0.6 }, 11, 30 + Math.floor(r(3) * 90));

    // Jantar (~18:00-20:00)
    push('meal', 'Jantar', pick(comidas, baseSeed + 3), { tags: [pick(tagsDinner, baseSeed + 3)], ritmo: 'Lento' }, 18, Math.floor(r(4) * 120));

    // Água (3-5 ao longo do dia)
    for (let w = 0; w < 3 + Math.floor(r(5) * 3); w++) {
      const hA = 7 + Math.floor(r(6 + w * 3) * 14);
      push('water', 'Hidratação', `1 copo de água (~250 ml)`, {}, hA, Math.floor(r(7 + w * 3) * 60));
    }

    // Sono (se for noite)
    push('sleep', 'Sono', r(8) > 0.3 ? 'Sono tranquilo' : 'Acordou 1x à noite', { quality: 2 + Math.floor(r(9) * 4) }, 23, Math.floor(r(10) * 30));

    // Humor (1-2 por dia)
    push('mood', pick(humores, baseSeed + 4), pick(humores, baseSeed + 4), { score: 1 + Math.floor(r(11) * 5) }, 10 + Math.floor(r(12) * 10), Math.floor(r(13) * 60));

    // Exercício (a cada 2-3 dias)
    if (r(14) > 0.65) {
      push('exercise', 'Exercício', `Caminhada · ${20 + Math.floor(r(15) * 40)} min · Intensidade ${r(16) > 0.5 ? 'moderada' : 'leve'}`, {}, 8 + Math.floor(r(17) * 4), Math.floor(r(18) * 60));
    }

    // Evacuação (1-2 por dia)
    const bristolVal = 1 + Math.floor(r(19) * 7);
    push('evacuation', `Evacuação (Bristol ${bristolVal})`, BRISTOL_DESCRICOES[bristolVal],
      { bristol: bristolVal, cor: pick(EVAC_CORES, baseSeed + 5), esforco: 1 + Math.floor(r(20) * 5) },
      7 + Math.floor(r(21) * 14), Math.floor(r(22) * 60));

    // Dor (0-2 por dia, com padrões: mais dias com gordura = mais dor)
    if (r(23) > 0.5) {
      const intensidade = 3 + Math.floor(r(24) * 6);
      push('pain', pick(dores, baseSeed + 6), `${pick(dores, baseSeed + 6)} · intensidade ${intensidade}`,
        { intensity: intensidade, region: pick(regioes, baseSeed + 7) },
        13 + Math.floor(r(25) * 8), Math.floor(r(26) * 60));
    }

    // Gases (0-1 por dia)
    if (r(27) > 0.55) {
      push('gas', 'Gases', 'Gases moderados', { intensidade: 'Moderado', odor: 'Leve', alivio: 'Aliviou' },
        14 + Math.floor(r(28) * 8), Math.floor(r(29) * 60));
    }

    // Medicamento (a cada 3-4 dias)
    if (r(30) > 0.7) {
      push('medication', 'Medicamento', pick(['Probiótico', 'Antibiótico', 'Vitamina D', 'Ômega 3', 'Magnésio'], baseSeed + 8),
        { tags: [pick(['Probiótico', 'Antibiótico', 'Vitamina', 'Suplemento'], baseSeed + 8)] },
        8 + Math.floor(r(31) * 3), Math.floor(r(32) * 60));
    }
  }

  // B.1 — Observações fictícias (texto livre ditado pelo paciente) sempre presentes no mock.
  // Distribuídas em dias distintos do período para a IA poder correlacionar com eventos próximos.
  const obs = [
    { dAtras: 2,  type: 'pain',       title: 'Dor abdominal',  desc: 'Dor abdominal · intensidade 6', meta: { intensity: 6, region: 'regiao_inf_esq', note: 'começou uns 40 min depois do almoço, junto com estufamento' } },
    { dAtras: 5,  type: 'meal',       title: 'Almoço',         desc: 'Arroz, feijoada e refrigerante',  meta: { tags: ['Feijão', 'Refrigerante'], note: 'comi rapidamente, senti que exagerei no refrigerante' } },
    { dAtras: 9,  type: 'evacuation', title: 'Evacuação',      desc: BRISTOL_DESCRICOES[1],            meta: { bristol: 1, esforco: 4, note: 'estou há 3 dias quase sem beber água' } },
    { dAtras: 14, type: 'mood',       title: 'Triste',         desc: 'Triste',                         meta: { score: 2, note: 'dia estressante no trabalho, dor de cabeça desde a manhã' } },
    { dAtras: 21, type: 'gas',        title: 'Gases',          desc: 'Gases moderados',                meta: { intensidade: 'Moderado', note: 'piora quando como feijão à noite' } },
  ];
  obs.forEach(o => {
    const diaTs = agora - o.dAtras * DIA;
    const d = new Date(diaTs);
    const day = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    entries.push({ id: id++, type: o.type, day, time: '10:30', ts: diaTs + 10 * 3600000 + 30 * 60000, title: o.title, description: o.desc, meta: o.meta });
  });

  // B.1b — Pesagens fictícias para a IA detectar tendência (implícito: perda
  // leve de ~2 kg ao longo do período). Distribuídas em 3 momentos distintos.
  const pesos = [
    { dAtras: 58, kg: 78.0 },
    { dAtras: 30, kg: 77.1 },
    { dAtras: 3,  kg: 76.2 },
  ];
  pesos.forEach(o => {
    const diaTs = agora - o.dAtras * DIA;
    const d = new Date(diaTs);
    const day = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    entries.push({ id: id++, type: 'weight', day, time: '07:30', ts: diaTs + 7 * 3600000 + 30 * 60000, title: 'Peso', description: `${o.kg.toFixed(1).replace('.', ',')} kg`, meta: { weight: o.kg } });
  });

  // B.1c — Consultas fictícias para a IA resumir no bloco "Resumo das últimas
  // consultas". Distribuídas em 2 momentos distintos.
  const consultas = [
    { dAtras: 7,  esp: 'Gastroenterologista', note: 'Recomendou retirar lactose por 2 semanas, receitou probiótico, marcou retorno em 30 dias com novos exames.' },
    { dAtras: 30, esp: 'Nutricionista',        note: 'Plano alimentar com fibras solúveis, aumentar ingestão de água para 2 litros/dia, checar deficiência de ferro no próximo exame.' },
  ];
  consultas.forEach(o => {
    const diaTs = agora - o.dAtras * DIA;
    const d = new Date(diaTs);
    const day = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    entries.push({ id: id++, type: 'medicalvisit', day, time: '10:00', ts: diaTs + 10 * 3600000, title: o.esp, description: `Consulta com ${o.esp}`, meta: { especialidade: o.esp, note: o.note } });
  });

  // B.2 — Sinais de alerta (red flags) injetados apenas quando o toggle
  // localStorage 'tlgut_redflag_test' === '1'. Permite validar visualmente a
  // regra 15 (Sinais de Alerta) sem poluir o mock padrão usado em produção.
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('tlgut_redflag_test') === '1') {
      const flags = [
        { dAtras: 3,  type: 'pain',       title: 'Dor abdominal', desc: 'Dor abdominal · intensidade 10', meta: { intensity: 10, region: 'regiao_inf_esq', note: 'fezes com sangue vermelho vivo pela manhã' } },
        { dAtras: 7,  type: 'mood',       title: 'Triste',         desc: 'Tristeza profunda',               meta: { score: 1, note: 'emagreci 4 kg nas últimas 2 semanas sem motivo' } },
      ];
      flags.forEach(o => {
        const diaTs = agora - o.dAtras * DIA;
        const d = new Date(diaTs);
        const day = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
        entries.push({ id: id++, type: o.type, day, time: '08:15', ts: diaTs + 8 * 3600000 + 15 * 60000, title: o.title, description: o.desc, meta: o.meta });
      });
    }
  } catch {}

  return entries.sort((a, b) => b.ts - a.ts);
}

export function buildGasEntry(form) {
  const f = form || {};
  const intensidade = GAS_INTENSIDADES.includes(f.intensidade) ? f.intensidade : null;
  const odor = GAS_ODORES.includes(f.odor) ? f.odor : null;
  const alivio = GAS_ALIVIO.includes(f.alivio) ? f.alivio : null;
  const som = GAS_SOM.includes(f.som) ? f.som : null;

  const parts = [];
  if (intensidade) parts.push(intensidade);
  if (odor) parts.push(`Odor: ${odor.toLowerCase()}`);
  if (alivio) parts.push(alivio);
  if (som) parts.push(som);

  return {
    title: 'Gases',
    description: parts.join(' · ') || 'Gases',
    meta: { intensidade, odor, alivio, som },
  };
}

// Normaliza o estado do formulário de peso em uma entrada válida.
// Valida/clamp defensivo do valor numérico (segunda barreira além da UI).
export function buildWeightEntry(form) {
  const f = form || {};
  const w = typeof f.weight === 'number' && isFinite(f.weight)
    ? Math.min(200, Math.max(30, Math.round(f.weight * 10) / 10))
    : null;
  if (w == null) return { title: 'Peso', description: '—', meta: { weight: null } };
  const wStr = w.toFixed(1).replace('.', ',');
  return {
    title: 'Peso',
    description: `${wStr} kg`,
    meta: { weight: w },
  };
}

// Estatísticas de uso do diário usadas no cabeçalho do PDF e (futuramente)
// em um endpoint /api/stats. Função pura: não depende de localStorage nem de
// I/O. Aceita o array de entries (com `ts` ou `timestamp`) e Retorna um
// resumo com data do primeiro registro, total, média/dia e classificação.
export function calcularEstatisticas(entries) {
  const arr = Array.isArray(entries) ? entries : [];
  const tsArr = arr
    .map(e => e.ts || e.timestamp || 0)
    .filter(t => Number.isFinite(t) && t > 0)
    .sort((a, b) => a - b);
  if (tsArr.length === 0) {
    return { primeiroRegistro: '', totalRegistros: 0, diasNoPeriodo: 0, frequenciaMediaDia: 0, classificacao: '' };
  }
  const primeiro = tsArr[0];
  const ultimo = tsArr[tsArr.length - 1];
  const umDia = 24 * 3600 * 1000;
  const diasCalendario = Math.max(1, Math.round((ultimo - primeiro) / umDia) + 1);
  const freq = arr.length / diasCalendario;
  let classificacao = 'Esporádica';
  if (freq >= 1.5) classificacao = 'Assídua';
  else if (freq >= 0.5) classificacao = 'Regular';
  const d = new Date(primeiro);
  const dataFmt = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  return {
    primeiroRegistro: dataFmt,
    totalRegistros: arr.length,
    diasNoPeriodo: diasCalendario,
    frequenciaMediaDia: Math.round(freq * 10) / 10,
    classificacao,
  };
}
