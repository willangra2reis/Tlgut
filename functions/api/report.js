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
  if (report && !report.isRaw) report.perguntas_medico = normalizePerguntas(report.perguntas_medico);
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
  return `Você é um assistente de saúde gastrointestinal focado em empoderar e preparar o paciente para sua consulta médica. Analise os registros do diário intestinal abaixo e gere um relatório estruturado em português brasileiro para que o paciente entenda seus próprios padrões de forma clara e simples.

${dataConsultaStr}${periodoEvolucaoStr}${profileBlock}FORMATO DA RESPOSTA — REGRAS ABSOLUTAS:
- Comece com "{" (abre-chaves) como PRIMEIRO caractere da sua resposta.
- Termine com "}" (fecha-chaves) como ÚLTIMO caractere da sua resposta.
- NÃO use \`\`\`json nem nenhum tipo de code fence.
- NÃO inclua absolutamente nenhum texto antes ou depois do JSON.

Retorne APENAS um objeto JSON válido com esta estrutura exata:
{
  "resumo_executivo": "Texto narrativo acolhedor e educativo direcionado ao paciente (4-8 frases divididas em 2-3 parágrafos separados por \\n\\n). Faça uma análise detalhada: mencione frequências (ex: 'você teve episódios de diarreia frequentes...'), padrões entre alimentação/sono/humor/sintomas. Conclua com orientação prática focada na preparação para a consulta. Inclua: '${consultaFrase}'",
  "evolucao": "${periodoDias >= 30 ? 'Texto de 1-2 frases sobre a trajetória do paciente ao longo do período: comparando início e fim, houve melhora, piora ou estabilidade? Cite um marcador concreto (frequência de sintomas, consistência das fezes, humor). OBRIGATÓRIO.' : 'OMITIR este campo.'}",
  "sinais_alerta": [
    { "titulo": "Título curto do sinal de alerta", "descricao": "Por que este sinal merece atenção médica.", "data": "DD/MM/AAAA da ocorrência, se aplicável" }
  ],
  "correlacoes": [
    { "titulo": "Título curto da correlação (Ex: Sono e Cólicas)", "descricao": "Explicação detalhada baseada APENAS nos dados fornecidos, ajudando o paciente a ver a ligação. Use linguagem acessível e evite listar datas excessivas." }
  ],
  "perguntas_medico": [
    { "pergunta": "Pergunta específica, inteligente e direta que o PACIENTE lerá para o MÉDICO.", "motivo": "O 'argumento' de apoio do paciente. DEVE citar evidências dos registros para justificar a pergunta de forma natural (ex: 'Notei episódios frequentes de diarreia após ingerir frituras na última semana...'). Este texto servirá de base de segurança para o usuário.", "mecanismo_fisiologico": "Explicação científica breve (1-3 frases) de como o gatilho se conecta ao sintoma na literatura gastroenterológica estabelecida (ex: motilidade intestinal, absorção lipídica, efeito osmótico, microbiota). Apresente como 'linha de investigação que a literatura associa a esses gatilhos', nunca como diagnóstico. Deixe o médico interpretar a causalidade clínica." }
  ],
  "consultas": [
    { "profissional": "Especialidade do profissional consultado", "orientacao": "Principais pontos, orientações, diagnóstico e condutas da consulta" }
  ]
}

Regras rigorosas que você DEVE seguir:
0. FORMATO DA RESPOSTA (MUITO IMPORTANTE): Sua resposta DEVE começar com "{" (abre-chaves) como primeiro caractere e terminar com "}" (fecha-chaves) como último caractere. NÃO use \`\`\`json nem nenhum tipo de code fence. NÃO inclua absolutamente nenhum texto antes ou depois do JSON. Se você colocar QUALQUER coisa antes do "{" ou depois do "}", o sistema NÃO conseguirá processar a resposta e o paciente ficará sem relatório.
1. QUANTIDADE: Gere no mínimo 3 e no máximo 6 correlações e perguntas.
2. FORMATO DO RESUMO: O campo 'resumo_executivo' DEVE ser um texto narrativo, formatado em parágrafos usando \\n\\n.
3. TRADUÇÃO DE TERMOS MÉDICOS (MUITO IMPORTANTE): O paciente não é médico. NUNCA use jargões como "Escala de Bristol", "Bristol 1" ou "Bristol 7". Traduza e substitua SEMPRE por descrições visuais fáceis de entender (ex: "fezes muito duras em formato de bolinhas", "fezes totalmente líquidas", "fezes normais", "diarreia").
4. FISIOLOGIA INTESTINAL: Respeite o tempo do corpo. Sintomas altos e rápidos (gases, estufamento, azia) costumam ter gatilhos nas últimas 1 a 6 horas. Sintomas de trânsito lento (constipação, alteração na consistência das fezes) refletem os hábitos (água, dieta, sono) de 24 a 72 horas ANTES. Não aponte um alimento como causa de uma constipação que ocorreu no mesmo dia.
5. AGRUPAMENTO DE DATAS: É PROIBIDO listar várias datas em sequência no texto (ex: 12/06, 13/06 e 15/06). Substitua por expressões naturais de frequência (ex: "em 3 ocasiões na mesma semana", "frequentemente aos finais de semana", "nos dias seguintes ao sintoma"). Use datas exatas apenas para eventos únicos e graves.
6. SEM ALUCINAÇÃO DE TAGS: NUNCA invente ingredientes, categorias ou deduza tags. Use ESTRITAMENTE as tags exatas que o usuário marcou nos registros.
7. BASE EM DADOS: O campo 'motivo' e as 'correlacoes' DEVEM conter evidências concretas extraídas do diário. Só aponte causa e efeito se houver um padrão real. OBSERVAÇÕES DE TEXTO LIVRE: quando um registro contiver "observação:", esse texto foi ditado pelo paciente e contém contexto subjetivo valioso (timing percebido, gatilhos suspeitos, sintomas não estruturados, humor). Use-o com prioridade nas correlações e perguntas, citando trechos quando relevante.
8. ORDEM TEMPORAL: Respeite a linha do tempo estritamente. Um evento no dia X não pode causar algo no dia X-1.
9. PERSPECTIVA: As perguntas ('pergunta') são SEMRE formuladas na primeira pessoa (o paciente perguntando ao médico).
10. ESTATÍSTICA: Não use a palavra "padrão" para sequências com menos de 3 ocorrências documentadas. Use "sinal", "indício" ou "tendência inicial". Para padrões reais, indique a frequência (ex: "em 4 dos últimos 10 dias"). Contar ocorrências é obrigatório antes de afirmar periodicidade.
11. NEUTRALIDADE MÉDICA: NÃO atribua sintomas gastrointestinais a efeitos diretos e imediatos de condições crônicas. Diabetes NÃO causa diarreia imediata após ingestão de açúcar. Hipertensão NÃO causa sintomas GI diretos. Tireoide afeta metabolismo e trânsito com ATRASO de dias ou semanas. Use sempre "pode estar relacionado" e deixe o médico interpretar a causalidade clínica.
18. MECANISMO FISIOLÓGICO (CAMPO NOVO): Em cada item de 'perguntas_medico', preencha o campo 'mecanismo_fisiologico' com 1-3 frases explicando o mecanismo fisiológico pelo qual o gatilho do paciente se conecta ao sintoma (ex: como a gordura afeta a motilidade, como a microbiota se relaciona com gases, como o efeito osmótico influencia a consistência). Use ESTRITAMENTE mecanismos bem estabelecidos na literatura gastroenterológica clássica (motilidade, absorção, secreção biliar, microbiota, eixo intestino-cérebro, osmoticidade). NÃO use hipóteses recentes, controversas ou de consenso limitado. NÃO cite artigos específicos, PMIDs, autores ou anos de publicação — referencie genericamente "a literatura gastroenterológica". NÃO dê nomes de doenças (Crohn, SIJ, candidíase, disbiose, SIBO, etc.). Sempre apresente como "linha de investigação que a literatura associa a esses gatilhos" e deixe a causalidade clínica para o médico.
12. QUEBRA DE TAGS: Substitua tags internas por descrições naturais no texto. "Açúcar/Doce" → "alimentos açucarados"; "Pão/Trigo" → "pães e produtos com trigo"; "Refrigerante" → "refrigerantes"; "Frituras" → "frituras"; "Picante" → "temperos picantes"; "Feijão" → "feijão e leguminosas"; "Legumes" → "legumes e verduras". NUNCA mantenha aspas simples, barras ou nomes literais de tags no texto visto pelo paciente.
13. VOCABULÁRIO HÍDRICO: Use copos de água (250 ml cada) como unidade primária, sempre com ml equivalente entre parênteses: "3 copos de água (~750 ml)". Para quantidades acima de 10 copos, prefira litros: "15 copos de água (~3,7 litros)". A meta diária deve sempre mostrar ambas as unidades: "meta de 14 copos (~3430 ml)". Quando comparar com a meta, expresse a diferença em copos: "faltam 6 copos (~1500 ml)". NUNCA exiba a fórmula "35ml/kg" no texto ao paciente.
14. EVOLUÇÃO TEMPORAL: ${periodoDias >= 30 ? `Como o período analisado é de ${periodoDias} dias (≥ 30), o campo 'resumo_executivo' DEVE incluir ao menos uma frase comparando o início e o fim do período (melhora, piora ou estabilidade), e o campo 'evolucao' é OBRIGATÓRIO e não pode ser vazio.` : 'Como o período analisado é curto (< 30 dias), OMITA o campo evolucao e não-force comparações temporais longas.'}
15. SINAIS DE ALERTA (RED FLAGS): Identifique nos registros: (a) sinais da lista padrão — sangue nas fezes, perda de peso, febre, dor noturna severa, anemia ou sintomas associados; (b) sintomas extremos — intensidade 9 ou 10 em 10, palavras como "sangue", "inchado", "vômito", "febre", "emagrecimento". Quando detectar, preencha 'sinais_alerta' com {titulo, descricao, data}. Se não houver nenhum sinal, OMITA o campo 'sinais_alerta' inteiramente (não envie array vazio).
16. EIXO INTESTINO-CÉREBRO: Quando o humor baixo/triste e sintomas físicos (cólicas, gases, alterações nas fezes) caminharem juntos, NUNCA afirme uma causa única. Apresente como conexão bidirecional: o desconforto físico pode afetar o humor E vice-versa. Formule 'pergunta' e 'motivo' como dúvida aberta (ex: "Será que meu humor afeta meu intestino, ou é o contrário?"), deixando o médico interpretar a direção.
17. RESUMO DE CONSULTAS: Analise os registros com tipo "consulta" (contêm meta.especialidade e/ou meta.note com observação). Para cada consulta encontrada, preencha o array 'consultas' com {profissional: especialidade, orientacao: síntese objetiva dos principais pontos, diagnósticos e condutas}. Se não houver registros de consulta, OMITA o campo 'consultas' inteiramente (não envie array vazio). As informações de consultas ajudam o paciente a levar um histórico conciso para a próxima consulta.

Registros para análise:
${registrosTexto}`;
}

// ── Prompt express (Relatório Express — usa narrative livre + pain_map) ─────
// Cenário: usuário sem registros diários, com consulta próxima. Narra em texto
// livre o que sente; pode marcar dores na silhueta. IA organiza a memória dispersa
// em um relatório conciso, SEM pseudo-diagnóstico, marcando info como "relatada".
function buildExpressPrompt({ narrative, pain_map, consultaFrase, dataConsultaStr, profileBlock }) {
  const hasClouds = pain_map && Array.isArray(pain_map.clouds) && pain_map.clouds.length > 0;
  const hasKinds = pain_map && Array.isArray(pain_map.kinds) && pain_map.kinds.length > 0;
  const painText = (hasClouds || hasKinds)
    ? `\nMapa de dores marcado pelo paciente${
        hasClouds ? ` (intensidade ${pain_map.intensity || 5}/10):\n${
          pain_map.clouds.map((c, i) => `  ${i + 1}. regiao: ${c.organLabel || c.organ || 'desconhecida'} (coordenadas ${c.x.toFixed(1)}%, ${c.y.toFixed(1)}%)`).join('\n')
        }` : ':'
      }${
        hasKinds ? `\nTipos de dor marcados: ${pain_map.kinds.join(', ')}` : ''
      }\n`
    : '';

  return `Você é um assistente de saúde gastrointestinal focado em empoderar e preparar o paciente para sua consulta médica. O paciente NÃO tem registros diários estruturados — está usando a modalidade "Relatório Express" para relatar, em texto livre, o que lembra do que vem sentindo. Sua tarefa é organizar essa memória dispersa em um relatório conciso e útil para a conversa com o médico, em português brasileiro.

${dataConsultaStr}${profileBlock}FORMATO DA RESPOSTA — REGRAS ABSOLUTAS:
- Comece com "{" (abre-chaves) como PRIMEIRO caractere da sua resposta.
- Termine com "}" (fecha-chaves) como ÚLTIMO caractere da sua resposta.
- NÃO use \`\`\`json nem nenhum tipo de code fence.
- NÃO inclua absolutamente nenhum texto antes ou depois do JSON.

Retorne APENAS um objeto JSON válido com esta estrutura exata:
{
  "resumo_executivo": "Texto narrativo acolhedor e educativo (4-8 frases em 2-3 parágrafos separados por \\n\\n). Organize o que o paciente relatou: principais sintomas, tempo decorrido, gatilhos percebidos, intensidade. Trace um retrato fiel do relato para a consulta. Sempre termos da perspectiva do paciente (o que relatado), não afirmações de fato médico. Conclua com: '${consultaFrase}'",
  "sinais_alerta": [
    { "titulo": "Título curto do sinal de alerta", "descricao": "Por que merece atenção do médico.", "data": "DD/MM/AAAA se aplicável" }
  ],
  "correlacoes": [
    { "titulo": "Título curto (Ex: Alimentação e sintomas)", "descricao": "Conexão observada PELO PACIENTE no que ele relatou. Use 'o paciente notou', 'segundo seu relato'. Não afirme causalidade, só associação percebida." }
  ],
  "perguntas_medico": [
    { "pergunta": "Pergunta específica e direta que o PACIENTE perguntará ao MÉDICO.", "motivo": "Argumento de apoio baseado no relato do paciente, citando trechos quando relevante.", "mecanismo_fisiologico": "Explicação científica breve (1-3 frases) de como o gatilho se conecta ao sintoma na literatura gastroenterológica estabelecida (ex: motilidade intestinal, absorção lipídica, efeito osmótico, microbiota). Apresente como 'linha de investigação que a literatura associa a esses gatilhos', nunca como diagnóstico. Deixe o médico interpretar a causalidade clínica." }
  ]
}

Regras rigorosas que você DEVE seguir:
0. FORMATO DA RESPOSTA (MUITO IMPORTANTE): Resposta DEVE começar com "{" e terminar com "}". Sem code fences. Sem texto antes ou depois.
1. QUANTIDADE: Gere no mínimo 3 e no máximo 5 correlações e perguntas.
2. PARÁGRAFOS: 'resumo_executivo' DEVE usar \\n\\n entre parágrafos.
3. PERSPECTIVA: Toda afirmação sobre o quadro clínico DEVE ser atribuída ao paciente: 'o paciente relata', 'segundo seu relato', 'ele notou'. NUNCA use linguagem de fato médico que confirme causalidade.
4. SEM PSEUDO-DIAGNÓSTICO, MAS COM PROFUNDIDADE FISIOLÓGICA: NUNCA sugira nomes de doenças (Crohn, SIJ, candidíase, disbiose, SIBO, etc.) — sua função é organizar o relato, NÃO diagnosticar. No entanto, em cada item de 'perguntas_medico', preencha 'mecanismo_fisiologico' (1-3 frases) explicando o mecanismo bem estabelecido na literatura gastroenterológica que conecta o gatilho ao sintoma (ex: motilidade intestinal, absorção lipídica, secreção biliar, efeito osmótico, microbiota, eixo intestino-cérebro). NÃO use hipóteses recentes ou controversas. NÃO cite artigos, PMIDs, autores ou anos — referencie genericamente 'a literatura gastroenterológica'. Apresente como 'linha de investigação que a literatura associa a esses gatilhos' e deixe a causalidade clínica para o médico. Use sempre 'merece atenção do médico', 'vale conversar com seu médico', 'o médico poderá avaliar'.
5. SINAIS DE ALERTA: Identifique no texto do paciente palavras/sinais que merecem atenção médica imediata: sangue nas fezes, perda de peso, febre, dor severa noturna, vômito, etc. Preencha 'sinais_alerta'. Se não houver, OMITA o campo.
6. APENAS O RELATADO: Use ESTRITAMENTE o texto do paciente. NUNCA invente sintomas, datas, medicamentos ouências não mencionais no relato. Se o paciente não tocou no tema, não presuma.
7. NÃO ENCHER: Se faltam informações para correlações (o paciente não deu detalhes), reduza o número de correlações ao invés de inventar. Qualidade > quantidade.
8. MAPA DE DORES (se fornecido): As coordenadas de dores devem enriquecer 'resumo_executivo' e 'correlacoes' como contexto anatômico adicional: 'a dor foi marcada na região do ${pain_map?.clouds?.[0]?.organLabel || 'cólon'}'. Nunca afirme que a localização confirma diagnóstico.
9. INFERÊNCIAS SOBRE TEMPO: Se o paciente usa expressões ambíguas ('há um tempo', 'ultimamente'), preserve essa ambiguidade no relatório. NUNCA converta em datas precisas inventadas.
10. CONSULTAS: OMITA o campo 'consultas' inteiramente nesta modalidade.

Relato do paciente:
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
      if (valido(obj)) return obj;
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
      correlacoes: [],
      perguntas_medico: [],
      truncated: true,
    };
  }

  return {
    resumo_executivo: raw,
    correlacoes: [],
    perguntas_medico: [],
    isRaw: true,
  };
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
    Array.isArray(obj.correlacoes) &&
    (obj.perguntas_medico === undefined || Array.isArray(obj.perguntas_medico)) &&
    (obj.sinais_alerta === undefined || Array.isArray(obj.sinais_alerta)) &&
    (obj.evolucao === undefined || typeof obj.evolucao === 'string');
}

function normalizePerguntas(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(item => {
    if (typeof item === 'string') return { pergunta: item, motivo: '', mecanismo_fisiologico: '' };
    if (item && typeof item === 'object') return {
      pergunta: item.pergunta || '',
      motivo: item.motivo || '',
      mecanismo_fisiologico: typeof item.mecanismo_fisiologico === 'string' ? item.mecanismo_fisiologico : '',
    };
    return { pergunta: '', motivo: '', mecanismo_fisiologico: '' };
  });
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
  if (m.organ) partes.push(`região: ${m.organ}`);
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
  return '## Perfil do paciente\n' + bloco +
    '\n\nUse estes dados para contextualizar suas an\u00e1lises:\n' +
    '- Hidrata\u00e7\u00e3o ideal \u2248 35ml/kg. Trate a rela\u00e7\u00e3o entre hidrata\u00e7\u00e3o e consist\u00eancia das fezes sempre como CORRELA\u00c7\u00c3O (\u201caparece coincidir\u201d, \u201cacompanha\u201d), nunca como causalidade direta (\u201c\u00e9 a causa\u201d, \u201cdificulta o tr\u00e2nsito\u201d).\n' +
    '- Considere SEMPRE as condi\u00e7\u00f5es pr\u00e9-existentes e o biotipo antes de atribuir correla\u00e7\u00f5es exclusivamente \u00e0 dieta. Doen\u00e7as de base e medicamentos podem ser a verdadeira causa dos sintomas.\n' +
    '- CONTEXTO CL\u00cdNICO: N\u00e3o fa\u00e7a falsas correla\u00e7\u00f5es exclusivas com a dieta quando h\u00e1 condi\u00e7\u00f5es pr\u00e9-existentes que explicam o quadro.\n' +
    '- SA\u00daDA\u00c7\u00c3O PERSONALIZADA: Inicie o resumo_executivo chamando o paciente pelo nome (\u201c' + (p.nome || 'paciente') + '\u201d) em tom acolhedor.\n\n';
}