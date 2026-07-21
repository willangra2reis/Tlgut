const MODELOS_PERMITIDOS = [
  '@cf/meta/llama-4-scout-17b-16e-instruct',
  '@cf/google/gemma-4-26b-a4b-it',
  '@cf/zai-org/glm-4.7-flash',
  '@cf/openai/gpt-oss-120b',
  '@google/gemini-2.5-flash',
  '@google/gemini-2.5-flash-lite',
];

const MODELO_PADRAO = '@google/gemini-2.5-flash';
const MODELO_FALLBACK_CF = '@cf/zai-org/glm-4.7-flash';

export async function onRequestPost({ request, env }) {

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Body inválido. Envie um JSON com { entries, model }.' }, { status: 400 });
  }

  const {
    entries = [],
    model = MODELO_PADRAO,
    consulta_date,
    profile,
    periodo,
    mode = 'standard',
    narrative,
    pain_map,
  } = body;

  const periodoDias = Number.isFinite(periodo) && periodo > 0 ? periodo : 0;
  const isExpress = mode === 'express';

  const profileBlock = buildProfileBlock(profile);

  if (!MODELOS_PERMITIDOS.includes(model)) {
    return Response.json({
      error: `Modelo "${model}" não suportado.`,
    }, { status: 400 });
  }

  // Em modo express, `entries` é opcional; requer `narrative` em modo standard.
  if (!isExpress && (!Array.isArray(entries) || entries.length === 0)) {
    return Response.json(
      { error: 'Nenhum registro disponível. Adicione entradas no diário primeiro.' },
      { status: 400 }
    );
  }
  if (isExpress && (!narrative || String(narrative).trim().length < 10)) {
    return Response.json(
      { error: 'Relato em texto vazio ou muito curto. Escreva sobre o que sente antes de gerar.' },
      { status: 400 }
    );
  }

  const isGemini = model.startsWith('@google/');
  if (isGemini && !env.GEMINI_API_KEY) {
    return Response.json(
      { error: 'GEMINI_API_KEY não configurada nas environment variables.' },
      { status: 503 }
    );
  }
  if (!isGemini && !env.AI) {
    return Response.json(
      { error: 'AI binding não configurado.' },
      { status: 503 }
    );
  }

  const consultaFrase = consulta_date
    ? `Para a sua consulta do dia ${consulta_date}, leve esses pontos...`
    : 'Para a sua próxima consulta, leve esses pontos...';
  const dataConsultaStr = consulta_date ? `Sua próxima consulta médica é dia ${consulta_date}. ` : '';
  const periodoEvolucaoStr = periodoDias >= 30
    ? `O período analisado é de ${periodoDias} dias. `
    : '';

  let prompt;
  if (isExpress) {
    prompt = buildExpressPrompt({
      narrative: String(narrative),
      pain_map,
      consultaFrase,
      dataConsultaStr,
      profileBlock,
    });
  } else {
    const registrosTexto = entries.slice(0, 200).map(formatEntry).join('\n');
    if (registrosTexto.length > 35000) {
      return Response.json(
        { error: 'Muitos registros para processar. Selecione um período menor.' },
        { status: 400 }
      );
    }
    prompt = buildStandardPrompt({
      registrosTexto,
      consultaFrase,
      dataConsultaStr,
      periodoEvolucaoStr,
      profileBlock,
      periodoDias,
    });
  }

  async function runGemini(modelName, promptText) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${env.GEMINI_API_KEY}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: { maxOutputTokens: 16384 },
      }),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Gemini HTTP ${res.status}: ${errBody}`);
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return text.trim();
  }

  async function runModel(modelId, promptText) {
    if (modelId.startsWith('@google/')) {
      const geminiName = modelId.slice(8); // strip '@google/'
      return await runGemini(geminiName, promptText);
    }
    const result = await env.AI.run(modelId, {
      messages: [{ role: 'user', content: promptText }],
      max_tokens: 16384,
    });
    const responseText = typeof result.response === 'string' ? result.response : (result.choices?.[0]?.message?.content || '');
    return (responseText || '').trim();
  }

  function isCFModel(id) { return id.startsWith('@cf/'); }

  async function tentarModelos(lista, promptTexto) {
    for (let i = 0; i < lista.length; i++) {
      const mid = lista[i];
      try {
        const text = await runModel(mid, promptTexto);
        if (text) return { text, model: mid };
      } catch (e) {
        console.error(`[report] Falha em ${mid}:`, e.message || e);
      }
    }
    return { text: '', model: lista[0] };
  }

  let rawText = '';
  let modelUsado = model;
  let fallbacks = [];

  if (isGemini) {
    fallbacks = ['@google/gemini-2.5-flash', '@google/gemini-2.5-flash-lite', MODELO_FALLBACK_CF];
    const idx = fallbacks.indexOf(model);
    if (idx > 0) fallbacks.splice(idx, 1);
    fallbacks = [model, ...fallbacks];
  } else {
    fallbacks = [model];
    if (model !== MODELO_FALLBACK_CF) fallbacks.push(MODELO_FALLBACK_CF);
  }

  // Em modo express, o prompt não contém a frase de "consulta médica é dia X"
  // que seria removida pelo fallback original, então usamos o prompt cru.
  const promptFallback = isExpress
    ? prompt
    : prompt.replace(/Sua próxima consulta médica é dia [^.]*\. /, '');
  const tentativa = await tentarModelos(fallbacks, promptFallback);
  rawText = tentativa.text;
  modelUsado = tentativa.model;

  if (!rawText) {
    return Response.json({ error: 'Modelo não retornou texto.' }, { status: 502 });
  }

  const report = parseReportJSON(rawText);
  return Response.json({
    report,
    model: modelUsado,
    generated_at: new Date().toISOString(),
  });
}

// ── Prompt standard (Relatórios IA — usa entries estruturadas) ─────────────
function buildStandardPrompt({
  registrosTexto,
  consultaFrase,
  dataConsultaStr,
  periodoEvolucaoStr,
  profileBlock,
  periodoDias,
}) {
  return `Você é um organizador de anotações de um diário intestinal. Sua função é compilar e apresentar, em português brasileiro, os registros que o usuário fez ao longo dos dias, em linguagem simples, para que ele leve suas anotações organizadas à consulta. Você é um diário passivo: NÃO interpreta, NÃO conclui, NÃO sugere causas, NÃO identifica quadros, NÃO rotula gravidade. Apenas organiza, resume e apresenta o que o usuário registrou.

${dataConsultaStr}${periodoEvolucaoStr}${profileBlock}FORMATO DA RESPOSTA — REGRAS ABSOLUTAS:
- Comece com "{" (abre-chaves) como PRIMEIRO caractere da sua resposta.
- Termine com "}" (fecha-chaves) como ÚLTIMO caractere da sua resposta.
- NÃO use \`\`\`json nem nenhum tipo de code fence.
- NÃO inclua absolutamente nenhum texto antes ou depois do JSON.

Retorne APENAS um objeto JSON válido com esta estrutura exata:
{
  "resumo_executivo": "Texto narrativo acolhedor e organizado direcionado ao usuário (4-8 frases divididas em 2-3 parágrafos separados por \\n\\n). Compile suas anotações de contexto: mencione, com suas palavras, o que você registrou ao longo do período (frequências que aparecem nos seus registros, como 'você registrou episódios de fezes líquidas em vários dias'). Use sempre a perspectiva do usuário ('você descreveu', 'segundo seus registros', 'em suas anotações'). Conclua com uma frase de preparação para a consulta. Inclua: '${consultaFrase}'",
  "evolucao": "${periodoDias >= 30 ? 'Texto de 1-2 frases comparando o início e o fim do período com base nas suas anotações (houve mais, menos ou parecidos registros de um tipo?). Indique um marcador concreto que apareça nos registros (frequência de uma queixa, consistência das fezes, humor). OBRIGATÓRIO.' : 'OMITIR este campo.'}",
  "associacoes": [
    { "titulo": "Título curto (Ex: Alimentação e o que você registrou sentir depois)", "descricao": "Apresente a associação que aparece nos seus registros, atribuída sempre ao usuário: 'você descreveu', 'segundo seu relato', 'em suas anotações'. Não afirme causalidade — apenas descreva que as anotações coincidiram no tempo. Use linguagem acessível." }
  ],
  "consultas": [
    { "profissional": "Especialidade do profissional consultado (segundo suas anotações)", "orientacao": "Resumo do que você registrou dessa consulta: principais pontos e orientações que você anotou" }
  ]
}

Regras rigorosas que você DEVE seguir:
0. FORMATO DA RESPOSTA (MUITO IMPORTANTE): Sua resposta DEVE começar com "{" (abre-chaves) como primeiro caractere e terminar com "}" (fecha-chaves) como último caractere. NÃO use \`\`\`json nem nenhum tipo de code fence. NÃO inclua absolutamente nenhum texto antes ou depois do JSON. Se você colocar QUALQUER coisa antes do "{" ou depois do "}", o sistema NÃO conseguirá processar a resposta e o usuário ficará sem relatório.
1. QUANTIDADE: Gere no mínimo 3 e no máximo 6 associações.
2. FORMATO DO RESUMO: O campo 'resumo_executivo' DEVE ser um texto narrativo, formatado em parágrafos usando \\n\\n.
3. PERSPECTIVA OBRIGATÓRIA: Toda afirmação deve ser atribuída ao usuário: 'você descreveu', 'segundo seus registros', 'em suas anotações', 'você notou'. NUNCA use linguagem de fato médico que confirme causalidade. NUNCA diga 'isso sugere', 'isso indica', 'análise', 'analisamos', 'identificamos', 'sintomas'.
4. TRADUÇÃO DE TERMOS MÉDICOS (MUITO IMPORTANTE): O usuário não é médico. NUNCA use jargões como "Escala de Bristol", "Bristol 1" ou "Bristol 7". Traduza e substitua SEMPRE por descrições visuais fáceis de entender (ex: "fezes muito duras em formato de bolinhas", "fezes totalmente líquidas", "fezes normais", "fezes líquidas").
5. FISIOLOGIA INTESTINAL: Respeite o tempo do corpo. O que você registrou sentir e que parece ter gatilhos altos e rápidos (gases, estufamento, azia) costuma coincidir com os hábitos das últimas 1 a 6 horas. O que envolve trânsito lento (constipação, alteração na consistência das fezes) costuma coincidir com os hábitos (água, dieta, sono) de 24 a 72 horas ANTES. Não aponte um alimento como coincidência de uma constipação que ocorreu no mesmo dia.
6. AGRUPAMENTO DE DATAS: É PROIBIDO listar várias datas em sequência no texto (ex: 12/06, 13/06 e 15/06). Substitua por expressões naturais de frequência (ex: "em 3 ocasiões na mesma semana", "frequentemente aos finais de semana", "nos dias seguintes"). Use datas exatas apenas para eventos únicos isolados.
7. SEM ALUCINAÇÃO DE TAGS: NUNCA invente ingredientes, categorias ou deduza tags. Use ESTRITAMENTE as tags exatas que o usuário marcou nos registros.
8. BASE NOS REGISTROS: As 'associacoes' DEVEM conter menções concretas extraídas do diário. Só mencione uma associação se ela aparecer como repetição real nos registros. OBSERVAÇÕES DE TEXTO LIVRE: quando um registro contiver "observação:", esse texto foi ditado pelo usuário e contém contexto subjetivo valioso (timing percebido, gatilhos suspeitos, o que ele notou sentir, humor). Use-o com prioridade nas associações, citando trechos quando relevante.
9. ORDEM TEMPORAL: Respeite a linha do tempo estritamente. Um evento no dia X não pode coincidir com algo no dia X-1.
10. FREQUÊNCIA NOS REGISTROS: Não use a palavra "padrão" para sequências com menos de 3 registros documentados. Use "repetição nos seus registros", "sequência observada" ou "você descreveu em vários dias". Para sequências reais, indique a frequência (ex: "em 4 dos últimos 10 dias"). Contar registros é obrigatório antes de mencionar periodicidade. Nunca use "isso sugere", "isso indica".
11. NEUTRALIDADE: NÃO atribua o que o usuário registrou sentir a efeitos diretos e imediatos de condições crônicas. Diabetes NÃO é descrito pelo usuário como coincidindo com fezes líquidas logo após ingestão de açúcar. Hipertensão NÃO aparece nos registros como coincidindo com o que ele descreveu. Tireoide afeta metabolismo e trânsito com ATRASO de dias ou semanas. Use sempre "você descreveu que coincide" e deixe o médico interpretar a causalidade clínica.
12. QUEBRA DE TAGS: Substitua tags internas por descrições naturais no texto. "Açúcar/Doce" → "alimentos açucarados"; "Pão/Trigo" → "pães e produtos com trigo"; "Refrigerante" → "refrigerantes"; "Frituras" → "frituras"; "Picante" → "temperos picantes"; "Feijão" → "feijão e leguminosas"; "Legumes" → "legumes e verduras". NUNCA mantenha aspas simples, barras ou nomes literais de tags no texto visto pelo usuário.
13. VOCABULÁRIO HÍDRICO: Use copos de água (250 ml cada) como unidade primária, sempre com ml equivalente entre parênteses: "3 copos de água (~750 ml)". Para quantidades acima de 10 copos, prefira litros: "15 copos de água (~3,7 litros)". APENAS descreva o que aparece nos registros do usuário, citando números absolutos: "você registrou 2 copos de água (~500 ml)". NUNCA mencione "meta", "recomendação", "ideal", "faltam", "precisa beber mais", nem calcule um valor alvo. NUNCA use qualificadores como "pouca", "reduzida", "baixa", "insuficiente", "abaixo" ou "acima" — apenas números. NUNCA exiba a fórmula "35ml/kg" no texto ao usuário.
14. EVOLUÇÃO TEMPORAL: ${periodoDias >= 30 ? `Como o período é de ${periodoDias} dias (≥ 30), o campo 'resumo_executivo' DEVE incluir ao menos uma frase comparando o início e o fim do período com base nas suas anotações, e o campo 'evolucao' é OBRIGATÓRIO e não pode ser vazio.` : 'Como o período é curto (< 30 dias), OMITA o campo evolucao e não-force comparações temporais longas.'}
15. EIXO INTESTINO-CÉREBRO: Quando o humor baixo/triste e o que o usuário registrou sentir fisicamente (cólicas, gases, alterações nas fezes) caminharem juntos, NUNCA afirme uma causa única. Apresente como coincidência nos registros: o desconforto físico aparece junto com o humor nos seus registros, e vice-versa, deixando o médico interpretar a direção.
16. RESUMO DE CONSULTAS: Apresente os registros com tipo "consulta" (contêm meta.especialidade e/ou meta.note com observação). Para cada consulta encontrada, preencha o array 'consultas' com {profissional: especialidade, orientacao: resumo do que você registrou dessa consulta, segundo suas anotações}. Se não houver registros de consulta, OMITA o campo 'consultas' inteiramente (não envie array vazio). As informações de consultas ajudam o usuário a levar um histórico conciso para a próxima consulta.

Registros para compilar:
${registrosTexto}`;
}

// ── Prompt express (Relatório Express — usa narrative livre + pain_map) ─────
// Cenário: usuário sem registros diários, com consulta próxima. Narra em texto
// livre o que sente; pode marcar dores na silhueta. IA organiza a memória dispersa
// em um relatório conciso, em modo diário passivo, marcando info como "relatada".
function buildExpressPrompt({ narrative, pain_map, consultaFrase, dataConsultaStr, profileBlock }) {
  const hasClouds = pain_map && Array.isArray(pain_map.clouds) && pain_map.clouds.length > 0;
  const hasKinds = pain_map && Array.isArray(pain_map.kinds) && pain_map.kinds.length > 0;
  const painText = (hasClouds || hasKinds)
    ? `\nMapa de dores marcado por você${
        hasClouds ? ` (intensidade ${pain_map.intensity || 5}/10):\n${
          pain_map.clouds.map((c, i) => `  ${i + 1}. região: ${c.regionLabel || c.organLabel || c.organ || 'desconhecida'} (coordenadas ${c.x.toFixed(1)}%, ${c.y.toFixed(1)}%)`).join('\n')
        }` : ':'
      }${
        hasKinds ? `\nTipos de dor que você marcou: ${pain_map.kinds.join(', ')}` : ''
      }\n`
    : '';

  return `Você é um organizador de anotações de um diário intestinal. O usuário NÃO tem registros diários estruturados — está usando a modalidade "Relatório Express" para relatar, em texto livre, o que lembra do que vem sentindo. Sua função é organizar essa memória dispersa em um relatório conciso e útil para a conversa com o médico, em português brasileiro. Você é um diário passivo: NÃO interpreta, NÃO conclui, NÃO sugere causas, NÃO identifica quadros, NÃO rotula gravidade. Apenas organiza e apresenta o que o usuário relatou.

${dataConsultaStr}${profileBlock}FORMATO DA RESPOSTA — REGRAS ABSOLUTAS:
- Comece com "{" (abre-chaves) como PRIMEIRO caractere da sua resposta.
- Termine com "}" (fecha-chaves) como ÚLTIMO caractere da sua resposta.
- NÃO use \`\`\`json nem nenhum tipo de code fence.
- NÃO inclua absolutamente nenhum texto antes ou depois do JSON.

Retorne APENAS um objeto JSON válido com esta estrutura exata:
{
  "resumo_executivo": "Texto narrativo acolhedor e organizado (4-8 frases em 2-3 parágrafos separados por \\n\\n). Organize o que você relatou: principais pontos que descreveu, tempo decorrido, gatilhos que você percebeu, intensidade. Trace um retrato fiel do seu relato para a consulta. Use sempre a perspectiva do usuário ('você descreveu', 'segundo seu relato', 'você notou'). NUNCA use 'análise', 'analisamos', 'sintomas', 'isso sugere', 'isso indica'. Conclua com: '${consultaFrase}'",
  "associacoes": [
    { "titulo": "Título curto (Ex: Alimentação e o que você descreveu sentir)", "descricao": "Conexão que apareceu no seu relato. Use 'você notou', 'segundo seu relato', 'você descreveu'. Não afirme causalidade — apenas descreva que os pontos coincidiram no que você relatou." }
  ]
}

Regras rigorosas que você DEVE seguir:
0. FORMATO DA RESPOSTA (MUITO IMPORTANTE): Resposta DEVE começar com "{" e terminar com "}". Sem code fences. Sem texto antes ou depois.
1. QUANTIDADE: Gere no mínimo 3 e no máximo 5 associações.
2. PARÁGRAFOS: 'resumo_executivo' DEVE usar \\n\\n entre parágrafos.
3. PERSPECTIVA: Toda afirmação deve ser atribuída ao usuário: 'você descreveu', 'segundo seu relato', 'você notou', 'em seu relato'. NUNCA use linguagem de fato médico que confirme causalidade. NUNCA use 'análise', 'analisamos', 'sintomas', 'isso sugere', 'isso indica', 'identificar'.
4. SEM PSEUDO-DIAGNÓSTICO: NUNCA sugira nomes de doenças (Crohn, SIJ, candidíase, disbiose, SIBO, etc.) — sua função é organizar o relato, NÃO diagnosticar. Use sempre 'vale conversar com seu médico', 'o médico poderá avaliar'.
5. APENAS O RELATADO: Use ESTRITAMENTE o texto do usuário. NUNCA invente o que ele não descreveu, datas, medicamentos ou percepções que não aparecem no relato. Se o usuário não tocou no tema, não presuma.
6. NÃO ENCHER: Se faltam informações para associações (o usuário não deu detalhes), reduza o número de associações ao invés de inventar. Qualidade > quantidade.
7. MAPA DE DORES (se fornecido): As coordenadas de dores devem enriquecer 'resumo_executivo' e 'associacoes' como contexto anatômico adicional: 'você marcou a dor na região ${pain_map?.clouds?.[0]?.regionLabel || pain_map?.clouds?.[0]?.organLabel || 'abdominal'}'. Nunca afirme que a localização confirma diagnóstico.
8. INFERÊNCIAS SOBRE TEMPO: Se o usuário usa expressões ambíguas ('há um tempo', 'ultimamente'), preserve essa ambiguidade no relatório. NUNCA converta em datas precisas inventadas.
9. CONSULTAS: OMITA o campo 'consultas' inteiramente nesta modalidade.
10. HIDRATAÇÃO NO RELATO LIVRE: se o usuário mencionar água no relato, apenas reproduza o que ele descreveu, em números absolutos se possível ('você mencionou 2 copos de água'). NUNCA mencione 'meta', 'recomendação', 'ideal', 'faltam', 'precisa beber mais', nem calcule um valor alvo, nem use qualificadores como 'pouca', 'reduzida', 'insuficiente', 'baixa' ou 'abaixo' — apenas cite o que foi relatado.

Relato do usuário:
"""
${narrative}
"""
${painText}`;
}

function parseReportJSON(raw) {
  if (!raw) return null;

  const tentar = (texto) => {
    try {
      const obj = JSON.parse(texto);
      if (valido(obj)) return normalizeAssociacoes(obj);
    } catch {}
    return null;
  };

  const result = tentar(raw);
  if (result) return result;

  const extracted = extractBalancedJSON(raw);
  if (extracted) {
    const parsed = tentar(extracted);
    if (parsed) return parsed;
  }

  const startsWithBrace = raw.trimStart().startsWith('{');
  if (startsWithBrace) {
    return {
      resumo_executivo: raw,
      associacoes: [],
      truncated: true,
    };
  }

  return {
    resumo_executivo: raw,
    associacoes: [],
    isRaw: true,
  };
}

// Alias legacy: relatórios antigos salvos usavam 'correlacoes'. Aceita ambos,
// normalizando sempre para 'associacoes' no objeto retornado.
function normalizeAssociacoes(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (!Array.isArray(obj.associacoes) && Array.isArray(obj.correlacoes)) {
    obj.associacoes = obj.correlacoes;
  }
  delete obj.correlacoes; // unifica o nome do campo na saída
  return obj;
}

function extractBalancedJSON(text) {
  let i = text.indexOf('{');
  if (i === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let j = i; j < text.length; j++) {
    const ch = text[j];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"' && !escape) { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        const candidate = text.slice(i, j + 1);
        return candidate;
      }
    }
  }
  return null;
}

function valido(obj) {
  return obj &&
    typeof obj.resumo_executivo === 'string' &&
    obj.resumo_executivo.length > 0 &&
    (Array.isArray(obj.associacoes) || Array.isArray(obj.correlacoes)) &&
    (obj.evolucao === undefined || typeof obj.evolucao === 'string');
}

function formatEntry(e) {
  const dia = e.day || '';
  const horario = e.time || '';
  const titulo = e.title || e.type || '';
  const desc = e.description || '';
  const metaStr = formatMeta(e);
  return `${dia} ${horario} — ${titulo}: ${desc}${metaStr}`;
}

function formatMeta(e) {
  const m = e.meta;
  if (!m || typeof m !== 'object') return '';

  const partes = [];
  if (m.intensity != null) partes.push(`intensidade: ${m.intensity}/10`);
  if (m.quality != null) partes.push(`qualidade: ${m.quality}/5`);
  if (m.bristol != null) partes.push(`Bristol: ${m.bristol}`);
  if (m.score != null) partes.push(`humor: ${m.score}/5`);
  if (m.glasses != null) partes.push(`copos: ${m.glasses}`);
  if (m.minutes != null) partes.push(`${m.minutes} min`);
  if (Array.isArray(m.tags) && m.tags.length > 0) partes.push(`tags: ${m.tags.join(', ')}`);
  if (m.region) partes.push(`região: ${m.region}`);
  if (m.esforco != null) partes.push(`esforço: ${m.esforco}/5`);
  if (m.conforto != null) partes.push(`conforto: ${m.conforto}/5`);
  if (m.nivel != null) partes.push(`nível: ${m.nivel}/3`);
  if (typeof m.fluxo === 'string') partes.push(`fluxo: ${m.fluxo}`);
  if (m.colica != null) partes.push(`cólica: ${m.colica}/5`);
  if (m.weight != null) partes.push(`peso: ${m.weight} kg`);
  if (m.especialidade) partes.push(`consulta: ${m.especialidade}`);
  if (typeof m.note === 'string' && m.note.trim()) partes.push(`observação: ${m.note.trim()}`);

  return partes.length > 0 ? ` (${partes.join(' · ')})` : '';
}

function buildProfileBlock(p) {
  if (!p || typeof p !== 'object') return '';
  const has = (v) => v !== null && v !== undefined && v !== '';
  if (!has(p.nome) && !has(p.idade) && !has(p.peso) && !has(p.altura)
      && !(Array.isArray(p.condicoes) && p.condicoes.length > 0) && !has(p.outros)) return '';
  const L = {
    diabetes: 'Diabetes',
    hipertensao: 'Hipertens\u00e3o',
    tireoide: 'Altera\u00e7\u00f5es na Tireoide',
    celiaca: 'Doen\u00e7a Cel\u00edaca',
    lactose: 'Intoler\u00e2ncia \u00e0 Lactose',
    gluten: 'Sensibilidade ao Gl\u00faten',
  };
  const linhas = [];
  if (has(p.nome)) linhas.push('Nome: ' + p.nome);
  const bio = [];
  if (has(p.idade))  bio.push(p.idade + ' anos');
  if (has(p.peso))   bio.push(p.peso + ' kg');
  if (has(p.altura)) bio.push(p.altura + ' cm');
  if (bio.length) linhas.push(bio.join(' | '));
  const cond = Array.isArray(p.condicoes) ? p.condicoes.map(c => L[c] || c) : [];
  if (cond.length) linhas.push('Condi\u00e7\u00f5es pr\u00e9-existentes: ' + cond.join(', '));
  if (has(p.outros)) linhas.push('Outras: ' + p.outros);
  const bloco = linhas.join('\n');
  return '## Perfil do usuário\n' + bloco +
    '\n\nUse estes dados para personalizar o resumo, chamando o usuário pelo nome em tom acolhedor no início do resumo_executivo, e adaptando o contexto de acordo com o perfil:\n' +
    '- Hidrata\u00e7\u00e3o: apresente a rela\u00e7\u00e3o entre hidrata\u00e7\u00e3o e consist\u00eancia das fezes sempre como coincid\u00eancia nos registros (\u201caparece coincidir\u201d, \u201cacompanha\u201d), nunca como causalidade (\u201c\u00e9 a causa\u201d, \u201cdificulta o tr\u00e2nsito\u201d). Apenas descreva o que o usu\u00e1rio registrou beber, em n\u00fameros absolutos (\u201cvoc\u00ea registrou X copos de \u00e1gua (~Y ml)\u201d). NUNCA mencione \u201cmeta\u201d, \u201cideal\u201d, \u201crecomenda\u00e7\u00e3o\u201d, \u201cfaltam\u201d, \u201cprecisa beber mais\u201d nem calcule um valor alvo baseado em peso. NUNCA use qualificadores como \u201cpouca\u201d, \u201creduzida\u201d, \u201cbaixa\u201d ou \u201cinsuficiente\u201d \u2014 apenas n\u00fameros.\n' +
    '- Considere SEMPRE as condi\u00e7\u00f5es pr\u00e9-existentes e o biotipo antes de apresentar associa\u00e7\u00f5es exclusivamente \u00e0 dieta. Condi\u00e7\u00f5es de base e medicamentos tamb\u00e9m podem coincidir com o que o usu\u00e1rio registrou.\n' +
    '- CONTEXTUALIZA\u00c7\u00c3O: N\u00e3o fa\u00e7a falsas associa\u00e7\u00f5es exclusivas com a dieta quando h\u00e1 condi\u00e7\u00f5es pr\u00e9-existentes que aparecem nos registros.\n' +
    '- SA\u00daDA\u00c7\u00c3O PERSONALIZADA: Inicie o resumo_executivo chamando o usu\u00e1rio pelo nome (\u201cOlá, ' + (p.nome || 'paciente') + '! Para te ajudar a organizar suas percep\u00e7\u00f5es, compilamos um resumo do que voc\u00ea relatou.\u201d) em tom acolhedor.\n\n';
}