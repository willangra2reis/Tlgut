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
              && (Array.isArray(obj.associacoes) || Array.isArray(obj.correlacoes))) {
            // Alias legacy: relatórios antigos usavam 'correlacoes'.
            if (!Array.isArray(obj.associacoes) && Array.isArray(obj.correlacoes)) {
              obj.associacoes = obj.correlacoes;
            }
            delete obj.correlacoes;
            return obj;
          }
        } catch {}
        return null;
      }
    }
  }
  return null;
}

export const LOADING_FRASES = [
  'Lendo todo o seu histórico...',
  'Reunindo suas anotações...',
  'Compilando o que você registrou sentir...',
  'Observando o consumo de água relatado...',
  'Verificando seus registros de sono...',
  'Reunindo humor e o que você descreveu...',
  'Localizando os pontos de dor marcados...',
  'Organizando suas anotações de evacuação...',
  'Aproximando alimentação e o que você registrou...',
  'Recolhendo gatilhos que você mencionou...',
  'Reunindo seus marcadores anotados...',
  'Comparando dias com mais e menos registros...',
  'Organizando a qualidade do sono que você registrou...',
  'Mapeando sua hidratação semanal...',
  'Agrupando o que você descreveu sobre estresse...',
  'Verificando a frequência das refeições que anotou...',
  'Aproximando medicamentos e o que você relatou...',
  'Observando sua evolução no período...',
  'Reunindo variações de humor que você registrou...',
  'Conferindo a consistência dos seus registros...',
];