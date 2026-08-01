// Exportação e limpeza dos dados do usuário.
// Exportar: monta um JSON com todo o conteúdo (perfil, preferências, registros,
// relatórios e consultas) e dispara o download. Limpar: remove o cache local
// (tlgut_*). A exclusão remota é feita pela edge function 'delete-account'
// (sync.js), que apaga os dados e a conta no Supabase.

const APP_VERSION = '0.0.0';
export const PALAVRA_CONFIRMACAO = 'DELETAR';

export function confirmarPalavra(valor) {
  return typeof valor === 'string' && valor === PALAVRA_CONFIRMACAO;
}

export function montarExportJSON({ profile, prefs, entries, reportsIA, reportsExpress, consultas }) {
  return {
    app: 'TimelineGut',
    versao: APP_VERSION,
    exportadoEm: new Date().toISOString(),
    perfil: profile || null,
    preferencias: prefs || {},
    registros: Array.isArray(entries) ? entries : [],
    relatorios: {
      ia: Array.isArray(reportsIA) ? reportsIA : [],
      express: Array.isArray(reportsExpress) ? reportsExpress : [],
    },
    consultas: Array.isArray(consultas) ? consultas : [],
  };
}

export function baixarJSON(nomeArquivo, objeto) {
  const blob = new Blob([JSON.stringify(objeto, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const CHAVES_LOCAIS = [
  'tlgut_profile',
  'tlgut_prefs',
  'tlgut_suavizar_janela',
  'tlgut_anonimo',
  'tlgut_onboarded',
  'tlgut_guest_mode',
  'tlgut_reports',
  'tlgut_express_reports',
  'tlgut_consultas',
  'tlgut_consulta_date',
];

export function limparDadosLocais() {
  for (const chave of CHAVES_LOCAIS) {
    try { localStorage.removeItem(chave); } catch {}
  }
}
