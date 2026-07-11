export function extractReportFromRaw(rawText) {
  if (!rawText) return null;
  const i = rawText.indexOf('{');
  if (i === -1) return null;
  let depth = 0, inString = false, escape = false;
  for (let j = i; j < rawText.length; j++) {
    const ch = rawText[j];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try {
          const obj = JSON.parse(rawText.slice(i, j + 1));
          if (obj && typeof obj.resumo_executivo === 'string' && obj.resumo_executivo.length > 0
              && Array.isArray(obj.correlacoes)) {
            return obj;
          }
        } catch {}
        return null;
      }
    }
  }
  return null;
}

export function normalizePergunta(item) {
  if (typeof item === 'string') return { pergunta: item, motivo: '', mecanismo_fisiologico: '' };
  if (item && typeof item === 'object') return {
    pergunta: item.pergunta || '',
    pergunta_original: typeof item.pergunta_original === 'string' ? item.pergunta_original : '',
    motivo: item.motivo || '',
    mecanismo_fisiologico: typeof item.mecanismo_fisiologico === 'string' ? item.mecanismo_fisiologico : '',
  };
  return { pergunta: '', motivo: '', mecanismo_fisiologico: '' };
}

export const LOADING_FRASES = [
  'Lendo todo o seu histórico...',
  'Analisando com profundidade...',
  'Fazendo correlações entre sintomas...',
  'Observando o consumo de água...',
  'Verificando padrões de sono...',
  'Conectando humor e sintomas...',
  'Localizando pontos de dor...',
  'Analisando tempo de evacuação...',
  'Cruzando alimentação e sintomas...',
  'Identificando gatilhos alimentares...',
  'Examinando seus marcadores de saúde...',
  'Comparando dias bons e ruins...',
  'Analisando a qualidade do sono...',
  'Mapeando sua hidratação semanal...',
  'Detectando padrões de estresse...',
  'Verificando frequência das refeições...',
  'Relacionando medicamentos e sintomas...',
  'Observando sua evolução no período...',
  'Analisando variações de humor...',
  'Avaliando consistência dos registros...',
  'Preparando perguntas para o médico...',
];