// Exportação e limpeza dos dados do usuário.
// Exportar: monta um JSON com todo o conteúdo (perfil, preferências, registros,
// relatórios e consultas) e dispara o download. Limpar: remove o cache local
// (tlgut_*). A exclusão remota é feita pela edge function 'delete-account'
// (sync.js), que apaga os dados e a conta no Supabase.

import { anonimizarPerfil, anonimizarTextoIA } from './profile.js';
import { calcularEstatisticas } from './diary.js';
import { metricasSono, metricasAgua, intervaloEntreEvacuacoes } from './insights.js';

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

// Anonimiza um JSON exportado (deep copy): aplica anonimizarPerfil no perfil e
// substitui o nome do usuário por "paciente" em TODOS os campos de texto
// (registros, notas, relatórios, consultas). Não muta o objeto original.
// Retorna uma nova estrutura; o banco/localStorage permanecem intocados.
export function anonimizarExportJSON(dados, nomeOrig) {
  const clone = structuredClone(dados);
  if (clone && typeof clone === 'object') {
    if (clone.perfil) {
      clone.perfil = anonimizarPerfil(clone.perfil);
      if (Array.isArray(clone.perfil.historico_familiar)) {
        clone.perfil.historico_familiar = clone.perfil.historico_familiar.map((r) =>
          r && typeof r === 'object' ? { ...r, nota: anonimizarIdadeNota(r.nota) } : r
        );
      }
    }
  }
  const nome = typeof nomeOrig === 'string' ? nomeOrig.trim() : '';
  if (nome && clone && typeof clone === 'object') {
    varredura(clone);
  }
  function varredura(node) {
    if (node === null || typeof node !== 'object') {
      if (typeof node === 'string') return anonimizarTextoIA(node, nome);
      return node;
    }
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        const v = varredura(node[i]);
        if (typeof v === 'string') node[i] = v;
      }
    } else {
      for (const chave of Object.keys(node)) {
        const v = varredura(node[chave]);
        if (typeof v === 'string') node[chave] = v;
      }
    }
    return node;
  }
  return clone;
}

// Generaliza idades (10–110) encontradas em texto livre para faixas de 10 anos
// (ex.: "aos 40" → "aos 40-49"), preservando o resto do texto. Mantém o
// parentesco/condição; reduz re-identificação de parentes. Determinístico e
// aplicado apenas no JSON exportado em modo anônimo.
export function anonimizarIdadeNota(nota) {
  if (typeof nota !== 'string' || !nota.trim()) return nota;
  return nota.replace(/\b(\d{1,4})\b/g, (m, num) => {
    const n = Number(num);
    if (!Number.isFinite(n) || n < 10 || n > 110) return m;
    const inicio = Math.floor(n / 10) * 10;
    return `${inicio}-${inicio + 9}`;
  });
}

// Resumo analítico (markdown) para leitura por IAs externas. APENAS descritivo e
// objetivo: período coberto, contagens por tipo, distribuição Bristol e médias
// de métricas registradas — sem correlações, sem inferência clínica e sem
// gatilhoAlimentar. Gera texto novo a partir dos dados; não altera os originais.
export function montarResumoAnalitico({ entries, profile } = {}) {
  const arr = Array.isArray(entries) ? entries : [];
  const stats = calcularEstatisticas(arr);
  const linhas = [];
  linhas.push('# Resumo analítico');
  linhas.push('');
  linhas.push(`- Período: ${stats.primeiroRegistro || 'sem registros'}`);
  linhas.push(`- Registros: ${stats.totalRegistros}`);
  if (stats.diasNoPeriodo) linhas.push(`- Dias no período: ${stats.diasNoPeriodo}`);
  if (stats.frequenciaMediaDia) linhas.push(`- Frequência média: ${stats.frequenciaMediaDia} registros/dia`);
  if (stats.classificacao) linhas.push(`- Classificação de registro: ${stats.classificacao}`);
  if (profile && typeof profile === 'object') {
    const idade = profile.idade != null ? `${profile.idade} anos` : null;
    if (idade) linhas.push(`- Idade: ${idade}`);
  }
  linhas.push('');
  linhas.push('## Contagem por tipo');
  const porTipo = new Map();
  const rotulos = {
    meal: 'Refeições', pain: 'Dores', evacuation: 'Evacuações', water: 'Hidratação',
    sleep: 'Sono', mood: 'Humor', medication: 'Medicamentos', gas: 'Gases',
    medicalvisit: 'Consultas', exercise: 'Exercícios', weight: 'Peso',
  };
  arr.forEach((e) => {
    const t = e && e.type ? String(e.type) : 'outro';
    porTipo.set(t, (porTipo.get(t) || 0) + 1);
  });
  if (porTipo.size === 0) {
    linhas.push('Sem registros.');
  } else {
    [...porTipo.entries()]
      .sort((a, b) => b[1] - a[1])
      .forEach(([t, n]) => {
        linhas.push(`- ${rotulos[t] || t}: ${n}`);
      });
  }
  linhas.push('');
  const evs = arr.filter((e) => e && e.type === 'evacuation');
  if (evs.length > 0) {
    linhas.push('## Evacuações (distribuição Bristol)');
    const bristol = new Map();
    evs.forEach((e) => {
      const b = e.meta && e.meta.bristol != null ? String(e.meta.bristol) : (e.bristol != null ? String(e.bristol) : '?');
      bristol.set(b, (bristol.get(b) || 0) + 1);
    });
    [...bristol.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([k, n]) => {
      linhas.push(`- Tipo ${k}: ${n}`);
    });
    const interv = intervaloEntreEvacuacoes(arr);
    if (interv.status === 'ok') {
      linhas.push(`- Intervalo médio: ${interv.mediaHoras} h · mediana: ${interv.medianaHoras} h · ${interv.evacPorDia}/dia`);
    }
    linhas.push('');
  }
  const dores = arr.filter((e) => e && e.type === 'pain');
  if (dores.length > 0) {
    const intensidades = dores
      .map((e) => Number(e.meta && e.meta.intensity != null ? e.meta.intensity : e.intensity))
      .filter((n) => Number.isFinite(n));
    if (intensidades.length > 0) {
      const media = intensidades.reduce((s, x) => s + x, 0) / intensidades.length;
      linhas.push('## Dor');
      linhas.push(`- Episódios: ${dores.length}`);
      linhas.push(`- Intensidade média (0-10): ${Math.round(media * 10) / 10}`);
      linhas.push('');
    }
  }
  const sono = metricasSono(arr);
  if (sono.mediaHoras != null) {
    linhas.push('## Sono');
    linhas.push(`- Média: ${Math.round(sono.mediaHoras * 10) / 10} h/dia`);
    linhas.push('');
  }
  const agua = metricasAgua(arr);
  if (agua.totalCopos > 0) {
    linhas.push('## Hidratação');
    linhas.push(`- Total: ${agua.totalCopos} copos em ${agua.diasRegistrados} dias`);
    linhas.push(`- Média: ${agua.mediaPorDia} copos/dia`);
    linhas.push('');
  }
  return linhas.join('\n').trim();
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
