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
