// ─── Histórico familiar ─────────────────────────────────────────────────────
// Modelo: profile.historico_familiar = [{ parentesco, condicao, nota }]

export const PARENTESCOS = [
  { id: 'pai', label: 'Pai' },
  { id: 'mae', label: 'Mãe' },
  { id: 'irmao', label: 'Irmão/irmã' },
  { id: 'tio', label: 'Tio/tia' },
  { id: 'avo', label: 'Avô/avó' },
  { id: 'primo', label: 'Primo/prima' },
  { id: 'filho', label: 'Filho/filha' },
  { id: 'outro', label: 'Outro' },
];

export const PARENTESCOS_LABELS = PARENTESCOS.reduce((acc, p) => {
  acc[p.id] = p.label;
  return acc;
}, {});

export const CONDICOES_FAMILIARES = [
  'Doença de Crohn',
  'Colite ulcerativa',
  'Câncer de intestino',
  'Síndrome do intestino irritável (SII)',
  'Doença celíaca',
  'Intolerância à lactose',
  'Diabetes',
  'Hipertensão',
  'Doença na tireoide',
  'Outra',
];

export function historicoFamiliarPreenchido(profile) {
  const lista = profile && Array.isArray(profile.historico_familiar) ? profile.historico_familiar : [];
  return lista.some((r) => r && typeof r.condicao === 'string' && r.condicao.trim() !== '');
}

export function formatarHistoricoFamiliar(profile) {
  const lista = profile && Array.isArray(profile.historico_familiar) ? profile.historico_familiar : [];
  return lista
    .filter((r) => r && typeof r.condicao === 'string' && r.condicao.trim() !== '')
    .map((r) => {
      const parente = PARENTESCOS_LABELS[r.parentesco] || r.parentesco || 'Familiar';
      const nota = r.nota && r.nota.trim() ? ` (${r.nota.trim()})` : '';
      return `${parente} — ${r.condicao.trim()}${nota}`;
    });
}

// ─── Cadência do popup de convite ───────────────────────────────────────────
// Estado persistido (localStorage 'tlgut_histfam_popup'):
//   { convitesVazios: number, convitesCheios: number, ultimoConviteTs: number, dispensado: boolean, editadoTs: number }
// Vazio   → convite diário, até 5 exibições (primeiros dias de uso).
// Preenchido → pergunta de complemento: 1ª após 1 dia da edição, depois a cada 7 dias, máx. 4x.

export const MAX_CONVITES_VAZIOS = 5;
export const MAX_CONVITES_CHEIOS = 4;
export const INTERVALO_VAZIO_MS = 24 * 60 * 60 * 1000;
export const INTERVALO_CHEIO_MS = 7 * 24 * 60 * 60 * 1000;
export const PRIMEIRO_CHEIO_MS = 24 * 60 * 60 * 1000;

export function estadoPopupInicial() {
  return {
    convitesVazios: 0,
    convitesCheios: 0,
    ultimoConviteTs: 0,
    dispensado: false,
    editadoTs: 0,
  };
}

export function deveMostrarPopupHistFam(estado, preenchido, agora) {
  const s = estado && typeof estado === 'object' ? estado : {};
  if (s.dispensado) return { mostrar: false };

  if (!preenchido) {
    if (s.convitesVazios >= MAX_CONVITES_VAZIOS) return { mostrar: false };
    const jaMostrou = s.convitesVazios > 0;
    if (jaMostrou && agora - (s.ultimoConviteTs || 0) < INTERVALO_VAZIO_MS) return { mostrar: false };
    return {
      mostrar: true,
      modo: 'vazio',
      mensagem: 'O histórico familiar ajuda o médico a entender seu quadro. Quer registrar algo agora?',
      titulo: 'Histórico familiar',
    };
  }

  // Preenchido: convite de complemento espaçado.
  if (s.convitesCheios >= MAX_CONVITES_CHEIOS) return { mostrar: false };
  const baseTs = s.editadoTs || s.ultimoConviteTs || 0;
  const limite = baseTs + (s.convitesCheios === 0 ? PRIMEIRO_CHEIO_MS : INTERVALO_CHEIO_MS);
  if (agora < limite) return { mostrar: false };
  return {
    mostrar: true,
    modo: 'completar',
    mensagem: 'Faltou registrar algo no histórico familiar? Se lembrou de mais alguma coisa, você pode complementar a qualquer momento.',
    titulo: 'Complementar histórico familiar',
  };
}

export function registrarConvitePopup(estado, modo, agora) {
  const s = estado && typeof estado === 'object' ? estado : {};
  const next = { ...s, ultimoConviteTs: agora };
  if (modo === 'vazio') next.convitesVazios = (s.convitesVazios || 0) + 1;
  else next.convitesCheios = (s.convitesCheios || 0) + 1;
  return next;
}

export function marcarEditadoPopup(estado, agora) {
  const s = estado && typeof estado === 'object' ? estado : {};
  return { ...s, editadoTs: agora };
}
