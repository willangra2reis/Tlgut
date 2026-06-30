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

  const { entries = [], model = MODELO_PADRAO } = body;

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

  const prompt = `Você é um assistente de saúde gastrointestinal. Analise os registros do diário intestinal abaixo e gere um relatório estruturado em português brasileiro.

Retorne APENAS um objeto JSON válido, sem texto antes ou depois, com esta estrutura exata:
{
  "resumo_executivo": "Resumo curto (2-3 frases) sobre o período analisado",
  "correlacoes": [
    { "titulo": "Título curto da correlação", "descricao": "Explicação detalhada baseada nos dados" }
  ],
  "perguntas_medico": [
    "Pergunta específica para o paciente levar ao médico",
    "Outra pergunta relevante"
  ]
}

Regras:
- No mínimo 3 e no máximo 6 correlações
- No mínimo 3 perguntas para o médico
- Use linguagem acessível, sem diagnóstico médico
- Correlações devem ser baseadas APENAS nos dados fornecidos
- Perguntas devem ser específicas e úteis para uma consulta gastroenterológica

Registros para análise:
${registrosTexto}`;

  let rawText = '';

  try {
    const result = await env.AI.run(model, {
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4096,
    });

    rawText = (result.response || result.choices?.[0]?.message?.content || '').trim();
    if (!rawText) {
      return Response.json({ error: 'Modelo não retornou texto.' }, { status: 502 });
    }

    const report = parseReportJSON(rawText);
    return Response.json({
      report,
      model,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[report] Erro:', err);
    const report = parseReportJSON(rawText);
    if (report) {
      return Response.json({ report, model, generated_at: new Date().toISOString() });
    }
    return Response.json(
      { error: `Falha ao gerar relatório: ${err.message || err}` },
      { status: 500 }
    );
  }
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
