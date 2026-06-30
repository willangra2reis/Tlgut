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
  const orgaos = ['estomago', 'colon_sig', 'intestino_delgado', 'colon_desc', 'figado'];
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
        { intensity: intensidade, organ: pick(orgaos, baseSeed + 7) },
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
