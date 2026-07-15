// Mapeamento de REGIÕES corporais genéricas da silhueta (conformidade bem-estar).
// Regiões amplas substituem mapeamento por órgão — afasta viés de diagnóstico diferencial.
// Puros dados/constantes — sem dependências de React.
//
// Para calibrar os pontos manualmente: use a ferramenta de calibração (Ctrl+Shift+K),
// selecione a região no dropdown e toque a silhueta fechada para capturar coordenadas.

export const REGION_LABELS = {
  regiao_peitoral_esq:   'Região peitoral esquerda',
  regiao_peitoral_dir:   'Região peitoral direita',
  regiao_peitoral_centro: 'Região peitoral central',
  regiao_sup_esq:        'Lado superior esquerdo',
  regiao_sup_dir:        'Lado superior direito',
  regiao_sup_centro:     'Região superior central',
  regiao_centro:         'Centro do abdômen',
  regiao_inf_esq:        'Lado inferior esquerdo do abdômen',
  regiao_inf_dir:        'Lado inferior direito do abdômen',
  regiao_inf_centro:     'Região inferior central do abdômen',
};

// Pontos calibrados (centroides) — gerados via Ctrl+Shift+K em 15/07/2026.
// Recalibrar se a silhueta for substituída ou reposicionada.
export const REGION_POINTS = {
  regiao_peitoral_esq:   [[32.5, 43.2]],
  regiao_peitoral_dir:   [[66.2, 42.2]],
  regiao_peitoral_centro: [[48.7, 41.6]],
  regiao_sup_esq:        [[34.1, 59.3]],
  regiao_sup_dir:        [[66.3, 59.4]],
  regiao_sup_centro:     [[50.6, 56.9]],
  regiao_centro:         [[51.2, 67.3]],
  regiao_inf_esq:        [[35.7, 74.2]],
  regiao_inf_dir:        [[67.6, 73.7]],
  regiao_inf_centro:     [[52.7, 76.9]],
};

// Compatibilidade: mapeia ids de órgãos legados (salvos em clouds antigas) → novas regiões.
// Mantém rótulo correto ao exibir registros antigos sem quebrar.
export const ORGAN_LEGACY_TO_REGION = {
  esofago:           'regiao_sup_centro',
  estomago:          'regiao_sup_esq',
  figado:            'regiao_sup_dir',
  intestino_delgado: 'regiao_centro',
  colon_asc:         'regiao_inf_dir',
  colon_trans:       'regiao_centro',
  colon_desc:        'regiao_inf_esq',
  colon_sig:         'regiao_inf_esq',
  apendice:          'regiao_inf_dir',
  reto:              'regiao_inf_centro',
};

// Compatibilidade: mapeia IDs de regiões legadas (removidas) → regiões atuais.
export const REGION_LEGACY_TO_REGION = {
  regiao_peito:  'regiao_peitoral_centro',
  regiao_dorsal: 'regiao_inf_centro',
};

export const REGION_ZONES = Object.entries(REGION_POINTS).flatMap(([id, pts]) =>
  pts.map(([cx, cy]) => ({ id, label: REGION_LABELS[id], cx, cy })),
);

export const REGION_LIST = Object.keys(REGION_LABELS).map((id) => ({ id, label: REGION_LABELS[id] }));

export const REGION_CENTROIDES = Object.entries(REGION_POINTS).map(([id, pts]) => ({
  id,
  label: REGION_LABELS[id],
  cx: pts.reduce((s, [x]) => s + x, 0) / pts.length,
  cy: pts.reduce((s, [, y]) => s + y, 0) / pts.length,
}));

// nearestRegion: retorna a região mais próxima das coordenadas (x%, y%).
export function nearestRegion(px, py) {
  let best = null, bestDist = Infinity;
  REGION_ZONES.forEach((z) => {
    const dx = px - z.cx, dy = py - z.cy;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < bestDist) { bestDist = d; best = z; }
  });
  return best;
}

// resolveRegionLabel: resolve rótulo de uma cloud legada (organ) ou nova (region).
// Aceita qualquer estrutura { organ?, region? } e devolve { id, label }.
export function resolveRegionLabel(cloud) {
  if (!cloud) return { id: null, label: 'Região marcada' };
  if (cloud.region && REGION_LABELS[cloud.region]) {
    return { id: cloud.region, label: REGION_LABELS[cloud.region] };
  }
  if (cloud.region && REGION_LEGACY_TO_REGION[cloud.region]) {
    const mapped = REGION_LEGACY_TO_REGION[cloud.region];
    return { id: mapped, label: REGION_LABELS[mapped] || 'Região marcada' };
  }
  if (cloud.organ) {
    const mapped = ORGAN_LEGACY_TO_REGION[cloud.organ];
    if (mapped && REGION_LABELS[mapped]) {
      return { id: mapped, label: REGION_LABELS[mapped] };
    }
    if (ORGAN_LABELS && ORGAN_LABELS[cloud.organ]) {
      return { id: cloud.organ, label: ORGAN_LABELS[cloud.organ] };
    }
  }
  if (cloud.regionLabel) return { id: cloud.region, label: cloud.regionLabel };
  if (cloud.organLabel) return { id: cloud.organ, label: cloud.organLabel };
  return { id: null, label: 'Região marcada' };
}

// ── Aliases de compatibilidade (legado) ───────────────────────────────────────
// Mantêm imports antigos funcionando enquanto os consumidores são migrados.
// NÃO usar em código novo — preferir os exports `REGION_*` / `nearestRegion`.

export const ORGAN_LABELS = {
  esofago:           'Esôfago',
  estomago:          'Estômago',
  figado:            'Fígado',
  intestino_delgado: 'Intestino delgado',
  colon_asc:         'Cólon ascendente',
  colon_trans:       'Cólon transverso',
  colon_desc:        'Cólon descendente',
  colon_sig:         'Cólon sigmoide',
  apendice:          'Apêndice',
  reto:              'Reto / Ânus',
};

export const ORGAN_CENTROIDES = REGION_CENTROIDES;
export const ORGAN_LIST = REGION_LIST;
export const ORGAN_POINTS = REGION_POINTS;
export const ORGAN_ZONES = REGION_ZONES;

export function nearestOrgan(px, py) {
  return nearestRegion(px, py);
}
