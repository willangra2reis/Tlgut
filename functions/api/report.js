const MODELOS_PERMITIDOS = [
  '@cf/meta/llama-4-scout-17b-16e-instruct',
  '@cf/google/gemma-4-26b-a4b-it',
  '@cf/zai-org/glm-4.7-flash',
  '@cf/openai/gpt-oss-120b',
];

const MODELO_PADRAO = '@cf/zai-org/glm-4.7-flash';

export async function onRequestPost({ request, env }) {
  if (!env.AI) {
    return Response.json(
      { error: 'AI binding não configurado.' },
      { status: 503 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Body inválido. Envie um JSON com { entries, model }.' }, { status: 400 });
  }

  const { entries = [], model = MODELO_PADRAO, consulta_date } = body;

  if (!MODELOS_PERMITIDOS.includes(model)) {
    return Response.json({
      error: `Modelo "${model}" não suportado.`,
    }, { status: 400 });
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    return Response.json(
      { error: 'Nenhum registro disponível. Adicione entradas no diário primeiro.' },
      { status: 400 }
    );
  }

  const registrosTexto = entries.slice(0, 200).map(formatEntry).join('\n');

  if (registrosTexto.length > 35000) {
    return Response.json(
      { error: 'Muitos registros para processar. Selecione um período menor.' },
      { status: 400 }
    );
  }

  const dataConsultaStr = consulta_date ? `Sua próxima consulta médica é dia ${consulta_date}. ` : '';
  const prompt = `Você é um assistente de saúde gastrointestinal. Analise os registros do diário intestinal abaixo e gere um relatório estruturado em português brasileiro.

${dataConsultaStr}Retorne APENAS um objeto JSON válido, sem texto antes ou depois, com esta estrutura exata:
{
  "resumo_executivo": "Texto narrativo longo (4-8 frases divididas em 2-3 parágrafos separados por \\n\\n) com análise detalhada do período: mencione contagens específicas (ex: 'você teve 12 episódios de diarreia em 30 dias'), datas de eventos marcantes, piores dias, padrões observados entre alimentação/sono/humor/sintomas, e uma conclusão com orientação prática. Se houver data da consulta, inclua frase contextual como 'Até sua consulta do dia ${consulta_date || '...'}, fique atento a...'",
  "correlacoes": [
    { "titulo": "Título curto da correlação", "descricao": "Explicação detalhada baseada APENAS nos dados fornecidos, citando datas, contagens e exemplos concretos" }
  ],
  "perguntas_medico": [
    { "pergunta": "Pergunta específica que o PACIENTE deve fazer ao MÉDICO", "motivo": "DEVE citar dados concretos dos registros — datas, contagens, exemplos específicos. NUNCA use genéricos como 'baseado nos seus sintomas' ou 'devido ao seu quadro'. Exemplo: 'Você registrou 8 episódios de diarreia nos últimos 15 dias, 5 deles após consumir frituras nos dias 05/06, 12/06...'" }
  ]
}

Regras:
- No mínimo 3 e no máximo 6 correlações
- No mínimo 3 e no máximo 6 perguntas para o médico
- O campo 'resumo_executivo' DEVE ser um texto longo e narrativo (mínimo 4 frases divididas em 2-3 parágrafos)
- Formate o resumo_executivo em parágrafos: use \n\n entre parágrafos, cada parágrafo com 2-4 frases
- Cada 'motivo' das perguntas DEVE conter evidências concretas (datas, contagens, exemplos) extraídas dos registros
- Use linguagem acessível, sem diagnóstico médico
- Correlações devem ser baseadas APENAS nos dados fornecidos
- As perguntas são SEMPRE perguntas que o PACIENTE levará para perguntar ao MÉDICO, nunca o contrário
- Respeite a ordem temporal dos eventos. Um evento no dia X NÃO pode ser citado como causa de algo registrado no dia X-1 ou antes

Registros para análise:
${registrosTexto}`;

  async function runModel(modelId, promptText) {
    const result = await env.AI.run(modelId, {
      messages: [{ role: 'user', content: promptText }],
      max_tokens: 4096,
    });
    const responseText = typeof result.response === 'string' ? result.response : (result.choices?.[0]?.message?.content || '');
    return (responseText || '').trim();
  }

  let rawText = '';
  let modelUsado = model;

  try {
    rawText = await runModel(model, prompt);
  } catch (err) {
    console.error(`[report] Erro no modelo ${model}:`, err.message || err);
    if (model !== MODELO_PADRAO) {
      console.error(`[report] Retentando com ${MODELO_PADRAO}...`);
      modelUsado = MODELO_PADRAO;
      const promptFallback = prompt.replace(/Sua próxima consulta médica é dia [^.]*\. /, '');
      try { rawText = await runModel(MODELO_PADRAO, promptFallback); }
      catch (err2) { console.error('[report] Fallback também falhou:', err2.message || err2); }
    }
  }

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

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const extraido = tentar(jsonMatch[0]);
    if (extraido) return extraido;
  }

  return {
    resumo_executivo: raw,
    correlacoes: [],
    perguntas_medico: [],
    isRaw: true,
  };
}

function valido(obj) {
  return obj &&
    typeof obj.resumo_executivo === 'string' &&
    obj.resumo_executivo.length > 0 &&
    Array.isArray(obj.correlacoes) &&
    (obj.perguntas_medico === undefined || Array.isArray(obj.perguntas_medico));
}

function normalizePerguntas(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(item => {
    if (typeof item === 'string') return { pergunta: item, motivo: '' };
    if (item && typeof item === 'object') return { pergunta: item.pergunta || '', motivo: item.motivo || '' };
    return { pergunta: '', motivo: '' };
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

  return partes.length > 0 ? ` (${partes.join(' · ')})` : '';
}
