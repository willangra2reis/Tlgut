import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Lightbulb, ThumbsUp, ChevronDown, CheckCircle2, ClipboardList, X, Calendar,
  Download, Share2, FileText, Sparkles, Stethoscope, TrendingUp, AlertTriangle, Map,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { loadProfile, CONDICOES_LABELS } from '../lib/profile.js';
import { calcularEstatisticas, gerarDadosRelatorioMock } from '../lib/diary.js';
import { dorPorRegiao } from '../lib/insights.js';
import { ORGAN_CENTROIDES, ORGAN_LABELS } from '../lib/organs.js';
import PainHeatmap from './PainHeatmap.jsx';
import digestiveImage from '../assets/sisdiges.jpg';
const digestiveImgEl = typeof Image !== 'undefined' ? new Image() : null;
if (digestiveImgEl) digestiveImgEl.src = digestiveImage;
import mascoteImage from '../assets/mascote.png';

function extractReportFromRaw(rawText) {
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

function normalizePergunta(item) {
  if (typeof item === 'string') return { pergunta: item, motivo: '' };
  if (item && typeof item === 'object') return { pergunta: item.pergunta || '', motivo: item.motivo || '' };
  return { pergunta: '', motivo: '' };
}

const MODELOS = [
  { id: '@google/gemini-2.5-flash',            label: 'Gemini 2.5 Flash',  descricao: 'Google, 1500 req/dia grátis, alta qualidade', recommended: true },
  { id: '@google/gemini-2.5-flash-lite',       label: 'Gemini 2.5 Flash Lite', descricao: 'Google, versão leve do 2.5 Flash',         recommended: false },
  { id: '@cf/zai-org/glm-4.7-flash',           label: 'GLM 4.7 Flash',    descricao: 'Multilíngue, rápido, 131K de contexto, Cloudflare', recommended: false },
  { id: '@cf/meta/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout 17B (Experimental)', descricao: 'MoE com 16 especialistas, Meta, Cloudflare', recommended: false },
  { id: '@cf/google/gemma-4-26b-a4b-it',       label: 'Gemma 4 26B',      descricao: 'Alta inteligência, Google, Cloudflare',      recommended: false },
  { id: '@cf/openai/gpt-oss-120b',             label: 'GPT-OSS 120B',     descricao: 'Open-source 120B, Cloudflare',               recommended: false },
];

const MODELO_PADRAO = '@google/gemini-2.5-flash';

const LOADING_FRASES = [
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

const PERIODOS = [
  { dias: 7, label: '7 dias' },
  { dias: 15, label: '15 dias' },
  { dias: 30, label: '30 dias' },
  { dias: 60, label: '60 dias' },
  { dias: 90, label: '90 dias' },
];

const CARDS_CLASS = "rounded-2xl border p-4 shadow-[0_10px_24px_-10px_rgba(31,42,40,0.4)]";
const CARDS_BG = 'rgba(255,255,255,1)';
const CARDS_BORDER = 'rgba(150,140,120,0.25)';
const CARDS_BG_DARK = 'rgba(255,255,255,1)';

export default function RelatoriasIAScreen({ entries }) {
  const [reports, setReports] = useState({});
  const [compareMode, setCompareMode] = useState(false);
  const [redFlagTest, setRedFlagTest] = useState(() => {
    try { return localStorage.getItem('tlgut_redflag_test') === '1'; } catch { return false; }
  });
  const toggleRedFlag = (v) => {
    const next = v ?? !redFlagTest;
    setRedFlagTest(next);
    try {
      if (next) localStorage.setItem('tlgut_redflag_test', '1');
      else localStorage.removeItem('tlgut_redflag_test');
    } catch {}
  };
  const [selectedModel, setSelectedModel] = useState(MODELO_PADRAO);
  const [periodo, setPeriodo] = useState(30);
  const [expandedCorr, setExpandedCorr] = useState({});
  const [selectedQuestions, setSelectedQuestions] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tlgut_selected_questions') || '[]'); }
    catch { return []; }
  });
  const [consultaAberta, setConsultaAberta] = useState(false);
  const [consultaDate, setConsultaDate] = useState(() => {
    try { return localStorage.getItem('tlgut_consulta_date') || ''; }
    catch { return ''; }
  });
  const [votes, setVotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tlgut_model_votes') || '{}'); }
    catch { return {}; }
  });

  const [activePhraseIndex, setActivePhraseIndex] = useState(0);
  const isLoading = Object.values(reports).some(r => r?.loading);

  useEffect(() => {
    if (!isLoading) return;
    setActivePhraseIndex(0);
    const interval = setInterval(() => {
      setActivePhraseIndex(prev => (prev + 1) % LOADING_FRASES.length);
    }, 3800);
    return () => clearInterval(interval);
  }, [isLoading]);

  const workingEntries = useMemo(() => {
    if (!Array.isArray(entries)) return gerarDadosRelatorioMock();
    const hasTs = entries.some(e => e.ts || e.timestamp);
    if (!hasTs) return gerarDadosRelatorioMock();
    return entries;
  }, [entries, redFlagTest]);

  const filteredEntries = useMemo(() => {
    const cutoff = Date.now() - periodo * 86400000;
    return workingEntries.filter(e => {
      const ts = e.ts || e.timestamp || 0;
      return ts >= cutoff;
    });
  }, [workingEntries, periodo]);

  const hasResults = Object.keys(reports).some(k => k !== '_empty');

  const gerarRelatorio = useCallback(async (entriesFor, model) => {
    const body = { entries: entriesFor, model, periodo };
    const cd = consultaDate && consultaDate.trim() ? consultaDate.trim() : null;
    if (cd) body.consulta_date = cd;
    try {
      const pr = loadProfile();
      if (pr && Object.keys(pr).length > 0) body.profile = pr;
    } catch {}
    const res = await fetch('/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return await res.json();
  }, [consultaDate, periodo]);

  async function handleGerar() {
    setSelectedQuestions([]);
    localStorage.removeItem('tlgut_selected_questions');
    if (filteredEntries.length === 0) {
      setReports({ _empty: { error: 'Nenhum registro no período selecionado.' } });
      return;
    }

    if (compareMode) {
      const models = MODELOS.map(m => m.id);
      const init = {};
      models.forEach(m => { init[m] = { loading: true, report: null, error: null }; });
      setReports(init);

      const results = await Promise.allSettled(models.map(m =>
        gerarRelatorio(filteredEntries, m).then(r => ({ model: m, report: r.report })).catch(e => ({ model: m, error: e.message }))
      ));

      const next = {};
      results.forEach(r => {
        if (r.status === 'fulfilled') {
          next[r.value.model] = { loading: false, report: r.value.report || null, error: r.value.error || null };
        } else {
          next[r.reason.model] = { loading: false, report: null, error: r.reason.message || 'Erro desconhecido' };
        }
      });
      setReports(next);
    } else {
      setReports({ [selectedModel]: { loading: true, report: null, error: null } });
      try {
        const r = await gerarRelatorio(filteredEntries, selectedModel);
        setReports({ [selectedModel]: { loading: false, report: r.report, error: null } });
      } catch (err) {
        setReports({ [selectedModel]: { loading: false, report: null, error: err.message } });
      }
    }
  }

  function votar(model) {
    const novosVotos = { ...votes, [model]: (votes[model] || 0) + 1 };
    setVotes(novosVotos);
    localStorage.setItem('tlgut_model_votes', JSON.stringify(novosVotos));
  }

  function toggleQuestao(pergunta) {
    const next = selectedQuestions.includes(pergunta)
      ? selectedQuestions.filter(q => q !== pergunta)
      : [...selectedQuestions, pergunta];
    setSelectedQuestions(next);
    localStorage.setItem('tlgut_selected_questions', JSON.stringify(next));
  }

  function toggleAccordion(idx) {
    setExpandedCorr(prev => ({ ...prev, [idx]: !prev[idx] }));
  }

  function renderStructuredContent(report) {
    const { resumo_executivo, evolucao, sinais_alerta, correlacoes, perguntas_medico } = report;
    const perguntasNorm = Array.isArray(perguntas_medico) ? perguntas_medico.map(normalizePergunta) : [];
    const paragrafos = resumo_executivo ? resumo_executivo.split(/\n\n+/).filter(p => p.trim()) : [];
    const alertas = Array.isArray(sinais_alerta) ? sinais_alerta.filter(a => a && (a.titulo || a.descricao)) : [];
    const temEvolucao = typeof evolucao === 'string' && evolucao.trim().length > 0;
    return (
      <div className="space-y-5">
        {alertas.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(189,90,74,0.12)' }}>
                <AlertTriangle size={15} style={{ color: '#BD5A4A' }} />
              </span>
              <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: '#BD5A4A' }}>Sinais de Alerta — procure atendimento se persistirem</h4>
            </div>
            <div className="space-y-1.5">
              {alertas.map((a, idx) => (
                <div key={idx} className="rounded-xl p-3"
                  style={{ background: 'rgba(189,90,74,0.06)', border: '1px solid rgba(189,90,74,0.2)' }}>
                  <p className="text-sm font-semibold text-[#2B2A28]">
                    {a.titulo || `Sinal ${idx + 1}`}{a.data ? ` · ${a.data}` : ''}
                  </p>
                  {a.descricao && <p className="text-xs text-[#4A443F] mt-1 leading-relaxed">{a.descricao}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {paragrafos.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(93,95,160,0.12)' }}>
                <FileText size={15} style={{ color: '#5D5FA0' }} />
              </span>
              <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: '#5D5FA0' }}>Resumo Executivo</h4>
            </div>
            <div className="space-y-2 pl-1">
              {paragrafos.map((p, i) => (
                <p key={i} className="text-sm text-[#4A443F] leading-relaxed">{p.trim()}</p>
              ))}
            </div>
          </div>
        )}

        {temEvolucao && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(62,142,150,0.12)' }}>
                <TrendingUp size={15} style={{ color: '#3E8E96' }} />
              </span>
              <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: '#3E8E96' }}>Evolução no período</h4>
            </div>
            <p className="text-sm text-[#4A443F] leading-relaxed pl-1">{evolucao.trim()}</p>
          </div>
        )}

        {Array.isArray(correlacoes) && correlacoes.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(201,118,58,0.12)' }}>
                <Sparkles size={15} style={{ color: '#C9763A' }} />
              </span>
              <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: '#C9763A' }}>Correlações Encontradas</h4>
            </div>
            <div className="space-y-1.5">
              {correlacoes.map((corr, idx) => (
                <div key={idx} className="rounded-xl overflow-hidden"
                  style={{ border: '1px solid rgba(201,118,58,0.2)' }}>
                  <button type="button" onClick={() => toggleAccordion(idx)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-left text-sm font-medium text-[#2B2A28] hover:bg-[#F6E9DD] transition-colors">
                    <span>{corr.titulo || `Correlação ${idx + 1}`}</span>
                    <span style={{ color: expandedCorr[idx] ? '#C9763A' : '#7D766A' }}>
                      <ChevronDown size={16}
                        className={`transition-transform duration-200 ${expandedCorr[idx] ? 'rotate-180' : ''}`} />
                    </span>
                  </button>
                  {expandedCorr[idx] && (
                    <div className="px-3 pb-3 text-sm text-[#4A443F] space-y-1"
                      style={{ background: 'rgba(246,233,221,0.3)' }}>
                      {corr.descricao && <p className="pt-1">{corr.descricao}</p>}
                      {corr.forca && (
                        <p className="text-xs text-[#7D766A]">Força da correlação: {corr.forca}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {(() => {
          const painCounts = dorPorRegiao(filteredEntries);
          const valores = Object.values(painCounts);
          const painTotal = valores.reduce((s, x) => s + x, 0);
          if (painTotal === 0) return null;
          const painMax = Math.max(1, ...valores);
          const painItems = ORGAN_CENTROIDES
            .map(o => ({ id: o.id, label: o.label, cx: o.cx, cy: o.cy, n: painCounts[o.id] || 0 }))
            .filter(o => o.n > 0)
            .sort((a, b) => b.n - a.n);
          return (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(189,90,74,0.12)' }}>
                  <Map size={15} style={{ color: '#BD5A4A' }} />
                </span>
                <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: '#BD5A4A' }}>Onde a dor aparece</h4>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <div className="relative mx-auto shrink-0" style={{ width: 160, aspectRatio: '374/740' }}>
                  <img src={digestiveImage} alt="Mapa de dor no corpo"
                    className="absolute inset-0 w-full h-full object-contain select-none" draggable={false} />
                  {painItems.map(o => {
                    const r = 9 + (o.n / painMax) * 18;
                    return (
                      <span key={o.id} aria-label={`${o.label}: ${o.n}`}
                        className="absolute rounded-full"
                        style={{
                          left: `${o.cx}%`, top: `${o.cy}%`, width: r, height: r, transform: 'translate(-50%,-50%)',
                          background: `rgba(189,90,74,${0.3 + (o.n / painMax) * 0.5})`,
                          border: '2px solid rgba(255,255,255,0.7)',
                          pointerEvents: 'none',
                        }} />
                    );
                  })}
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  {painItems.map((it, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-[#4A443F]">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: `rgba(189,90,74,${0.3 + (it.n / painMax) * 0.5})` }} />
                      <span className="font-medium text-[#2B2A28] shrink-0">{it.label}</span>
                      <span className="text-[#7D766A]">— {Math.round((it.n / painTotal) * 100)}% ({it.n} episódio{it.n !== 1 ? 's' : ''})</span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-[#9A938A] mt-3 leading-relaxed italic">
                <strong>Atenção:</strong> Os pontos na silhueta indicam a região onde o paciente relatou dor, não o órgão doente. Vários órgãos se sobrepõem na imagem (estômago, fígado, intestino delgado, cólon). A localização marcada não estabelece diagnóstico — apenas registra o relato. A interpretação clínica é exclusiva do médico.
              </p>
            </div>
          );
        })()}

        {perguntasNorm.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(74,138,92,0.12)' }}>
                <Stethoscope size={15} style={{ color: '#4A8A5C' }} />
              </span>
              <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: '#4A8A5C' }}>Perguntas para o Médico</h4>
            </div>
            <div className="space-y-1.5">
              {perguntasNorm.map((item, idx) => {
                const checked = selectedQuestions.includes(item.pergunta);
                return (
                  <label key={idx}
                    className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-colors"
                    style={{ background: checked ? 'rgba(74,138,92,0.08)' : 'transparent' }}>
                    <input type="checkbox" checked={checked}
                      onChange={() => toggleQuestao(item.pergunta)}
                      className="mt-0.5 accent-[#4A8A5C]" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-[#2B2A28] block">{item.pergunta}</span>
                      {item.motivo && (
                        <p className="text-[11px] text-[#7D766A] mt-1 leading-relaxed italic">{item.motivo}</p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
            {selectedQuestions.length > 0 && (
              <button type="button" onClick={() => setConsultaAberta(true)}
                className="mt-3 w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90 flex items-center justify-center gap-2"
                style={{ background: 'var(--brand)', color: '#fff' }}>
                <ClipboardList size={16} />
                Abrir Modo Consulta ({selectedQuestions.length})
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  function gerarPDF(reportData, modelLabel) {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 48;
    const maxW = pageW - margin * 2;
    let y = margin;

    const ensureSpace = (need) => {
      if (y + need > pageH - margin) { doc.addPage(); y = margin; }
    };

    const heading = (text, color) => {
      ensureSpace(28);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(color[0], color[1], color[2]);
      doc.text(text, margin, y);
      y += 8;
      doc.setDrawColor(color[0], color[1], color[2]);
      doc.setLineWidth(1.5);
      doc.line(margin, y, margin + 18, y);
      y += 16;
    };

    const paragraph = (text, fontColor = [68, 68, 63]) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(fontColor[0], fontColor[1], fontColor[2]);
      const lines = doc.splitTextToSize(text, maxW);
      lines.forEach(line => {
        ensureSpace(14);
        doc.text(line, margin, y);
        y += 14;
      });
    };

    const microLine = (text) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(125, 118, 106);
      const lines = doc.splitTextToSize(text, maxW);
      lines.forEach(line => {
        ensureSpace(12);
        doc.text(line, margin, y);
        y += 12;
      });
    };

    const spacer = (h = 8) => { y += h; };

    // ── Cabeçalho enriquecido ──
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(43, 42, 40);
    doc.text('Smart Gut · Relatório Gastrointestinal', margin, y);
    y += 22;

    const dataGer = new Date().toLocaleDateString('pt-BR');
    const pr = (typeof loadProfile === 'function') ? loadProfile() : {};
    const nomeProf = pr && pr.nome ? String(pr.nome).trim() : '';
    const bio = [];
    if (pr && pr.idade) bio.push(`${pr.idade} anos`);
    if (pr && pr.peso)  bio.push(`${pr.peso} kg`);
    if (pr && pr.altura) bio.push(`${pr.altura} cm`);
    const condArr = Array.isArray(pr && pr.condicoes) ? pr.condicoes.map(c => CONDICOES_LABELS[c] || c).filter(Boolean) : [];
    if (pr && pr.outros) condArr.push(pr.outros);

    microLine(`Paciente: ${nomeProf || '—'}${bio.length ? '  ·  ' + bio.join(' · ') : ''}${condArr.length ? '  ·  Condições: ' + condArr.join(', ') : ''}`);
    microLine(`${periodo} dias  ·  Gerado em ${dataGer}  ·  Modelo: ${modelLabel}`);

    const stats = calcularEstatisticas(workingEntries);
    if (stats && stats.totalRegistros > 0) {
      const freqTxt = stats.classificacao
        ? `Primeiro registro: ${stats.primeiroRegistro}  ·  Total: ${stats.totalRegistros} registros  ·  Frequência: ${stats.frequenciaMediaDia}/dia (${stats.classificacao})`
        : `Primeiro registro: ${stats.primeiroRegistro}  ·  Total: ${stats.totalRegistros} registros`;
      microLine(freqTxt);
    }

    y += 4;
    doc.setDrawColor(200, 195, 185);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y);
    y += 20;

    const r = reportData || {};
    const paragrafos = r.resumo_executivo ? r.resumo_executivo.split(/\n\n+/).filter(p => p.trim()) : [];

    if (paragrafos.length > 0) {
      heading('Resumo Executivo', [93, 95, 160]);
      paragrafos.forEach(p => { paragraph(p.trim()); spacer(6); });
      spacer(8);
    }

    if (typeof r.evolucao === 'string' && r.evolucao.trim()) {
      heading('Evolução no período', [62, 142, 150]);
      paragraph(r.evolucao.trim());
      spacer(8);
    }

    if (Array.isArray(r.sinais_alerta) && r.sinais_alerta.length > 0) {
      heading('Sinais de Alerta — procure atendimento se persistirem', [189, 90, 74]);
      r.sinais_alerta.forEach((a, i) => {
        ensureSpace(24);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(43, 42, 40);
        const titulo = `${i + 1}. ${a.titulo || ''}${a.data ? ' · ' + a.data : ''}`;
        const tLines = doc.splitTextToSize(titulo, maxW);
        tLines.forEach(l => { ensureSpace(14); doc.text(l, margin, y); y += 14; });
        if (a.descricao) paragraph(a.descricao, [120, 70, 60]);
        spacer(8);
      });
      spacer(4);
    }

    if (Array.isArray(r.correlacoes) && r.correlacoes.length > 0) {
      heading('Correlações Encontradas', [201, 118, 58]);
      r.correlacoes.forEach((c, i) => {
        ensureSpace(30);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(43, 42, 40);
        const tLines = doc.splitTextToSize(`${i + 1}. ${c.titulo || ''}`, maxW);
        tLines.forEach(l => { ensureSpace(14); doc.text(l, margin, y); y += 14; });
        if (c.descricao) { paragraph(c.descricao, [100, 100, 95]); }
        spacer(10);
      });
      spacer(4);
    }

    const painCounts = dorPorRegiao(workingEntries);
    const painValores = Object.values(painCounts);
    const painTotal = painValores.reduce((s, x) => s + x, 0);
    if (painTotal > 0) {
      const painMax = Math.max(1, ...painValores);
      const painItems = ORGAN_CENTROIDES
        .map(o => ({ id: o.id, label: o.label, cx: o.cx, cy: o.cy, n: painCounts[o.id] || 0 }))
        .filter(o => o.n > 0)
        .sort((a, b) => b.n - a.n);
      const imgW = 140;
      const imgH = imgW * 740 / 374;
      ensureSpace(imgH + 90);
      heading('Onde a dor aparece', [189, 90, 74]);
      const imgX = margin + (maxW - imgW) / 2;
      const imgY = y;
      if (digestiveImgEl && digestiveImgEl.complete && digestiveImgEl.naturalWidth > 0) {
        try { doc.addImage(digestiveImgEl, 'JPEG', imgX, imgY, imgW, imgH); } catch (e) {}
      }
      painItems.forEach((o) => {
        const intensidade = 0.3 + (o.n / painMax) * 0.5;
        const cr = Math.round(255 - (255 - 189) * intensidade);
        const cg = Math.round(255 - (255 - 90) * intensidade);
        const cb = Math.round(255 - (255 - 74) * intensidade);
        const cx = imgX + (o.cx / 100) * imgW;
        const cy = imgY + (o.cy / 100) * imgH;
        const rr = 3 + (o.n / painMax) * 8;
        doc.setFillColor(cr, cg, cb);
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(0.5);
        doc.circle(cx, cy, rr, 'FD');
      });
      y = imgY + imgH + 10;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      painItems.forEach((it) => {
        const txt = `${it.label} — ${Math.round((it.n / painTotal) * 100)}% (${it.n} episódio${it.n !== 1 ? 's' : ''})`;
        const lines = doc.splitTextToSize(txt, maxW);
        lines.forEach(l => { ensureSpace(12); doc.setTextColor(100, 100, 95); doc.text(l, margin, y); y += 12; });
      });
      spacer(6);
      const caveat = 'Atenção: os pontos na silhueta indicam a região onde o paciente relatou dor, não o órgão doente. Vários órgãos se sobrepõem na imagem (estômago, fígado, intestino delgado, cólon). A localização marcada não estabelece diagnóstico — apenas registra o relato. A interpretação clínica é exclusiva do médico.';
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(125, 118, 106);
      const cavLines = doc.splitTextToSize(caveat, maxW);
      cavLines.forEach(l => { ensureSpace(11); doc.text(l, margin, y); y += 11; });
      spacer(8);
    }

    const perguntas = Array.isArray(r.perguntas_medico) ? r.perguntas_medico.map(normalizePergunta).filter(p => p.pergunta) : [];
    if (perguntas.length > 0) {
      heading('Perguntas para o Médico', [74, 138, 92]);
      perguntas.forEach((item, i) => {
        ensureSpace(20);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(43, 42, 40);
        const qLines = doc.splitTextToSize(`${i + 1}. ${item.pergunta}`, maxW);
        qLines.forEach(l => { ensureSpace(14); doc.text(l, margin, y); y += 14; });
        if (item.motivo) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(9);
          doc.setTextColor(125, 118, 106);
          const mLines = doc.splitTextToSize(item.motivo, maxW - 12);
          mLines.forEach(l => { ensureSpace(12); doc.text(l, margin + 12, y); y += 12; });
        }
        spacer(10);
      });
    }

    ensureSpace(20);
    y += 4;
    doc.setDrawColor(200, 195, 185);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y);
    y += 12;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(125, 118, 106);
    const disclaimer = 'Relatório gerado por IA com base nos seus registros. Não substitui avaliação médica.';
    doc.text(doc.splitTextToSize(disclaimer, maxW), margin, y);

    return doc;
  }

  function montarNomeArquivoPDF() {
    const data = new Date().toISOString().slice(0, 10);
    let pr = {};
    try { pr = loadProfile(); } catch {}
    const nome = pr && pr.nome ? String(pr.nome).trim().replace(/[^\p{L}\p{N}_-]+/gu, '_') : '';
    const base = nome ? `SmartGut_Relatorio_${nome}_${data}` : `SmartGut_Relatorio_${data}`;
    return base + '.pdf';
  }

  function baixarPDF(reportData, modelLabel) {
    try {
      const doc = gerarPDF(reportData, modelLabel);
      const fileName = montarNomeArquivoPDF();
      if (navigator.userAgent.includes('Firefox')) {
        const blobUrl = doc.output('bloburl');
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      } else {
        doc.save(fileName);
      }
    } catch (e) { console.error('Erro ao gerar PDF:', e); }
  }

  function isShareSupported() {
    return typeof navigator !== 'undefined' &&
           !!navigator.share &&
           !!navigator.canShare &&
           !navigator.userAgent.includes('Firefox') &&
           !navigator.userAgent.includes('iPhone');
  }

  async function compartilharPDF(reportData, modelLabel) {
    try {
      const doc = gerarPDF(reportData, modelLabel);
      const fileName = montarNomeArquivoPDF();
      if (isShareSupported()) {
        const blob = doc.output('blob');
        const file = new File([blob], fileName, { type: 'application/pdf' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Smart Gut — Relatório Gastrointestinal', text: 'Relatório gastrointestinal gerado por IA' });
          return;
        }
      }
      baixarPDF(reportData, modelLabel);
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error('Erro ao compartilhar:', e);
        baixarPDF(reportData, modelLabel);
      }
    }
  }

  function renderCardStructured(modelId, { report, error, loading } = {}, mostrarVoto) {
    const modelo = MODELOS.find(m => m.id === modelId);
    const nomeModelo = modelo ? modelo.label : modelId;
    const recoveredReport = report?.isRaw ? (extractReportFromRaw(report.resumo_executivo) || report) : report;
    const isTruncated = (recoveredReport === report) && !!report?.truncated;
    const effectiveReport = isTruncated ? null : recoveredReport;
    const isRaw = effectiveReport?.isRaw;
    const canPDF = effectiveReport && !error && !loading && !isRaw;

    if (loading) {
      return (
        <div key={modelId}
          className="day-summary-mesh relative z-10 rounded-2xl border border-[#EDE7DD] p-6 overflow-hidden shadow-[0_10px_24px_-10px_rgba(31,42,40,0.4)]">
          <div className="relative z-10 flex flex-col items-center justify-center py-2 gap-3">
            <img src={mascoteImage} alt="Mascote" className="w-16 h-16 animate-mascote-pulse" />
            <div className="relative h-8 w-full flex items-center justify-center overflow-hidden">
              <div key={activePhraseIndex} className="text-[15px] font-semibold text-[#4A8A5C] tg-phrase-cycle">
                {LOADING_FRASES[activePhraseIndex]}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div key={modelId} className={CARDS_CLASS}
        style={{ background: CARDS_BG_DARK, borderColor: CARDS_BORDER }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ background: modelo?.recommended ? 'rgba(74,138,92,0.12)' : 'rgba(100,100,100,0.08)', color: modelo?.recommended ? '#4A8A5C' : '#7D766A' }}>
            {nomeModelo}{modelo?.recommended ? ' ★' : ''}
          </span>
          <div className="flex items-center gap-1.5">
            {mostrarVoto && !error && (
              <button type="button" onClick={() => votar(modelId)}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors"
                style={{ color: '#7D766A' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(74,138,92,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <ThumbsUp size={14} />
                {(votes[modelId] || 0) > 0 && <span>{votes[modelId]}</span>}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="py-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {isTruncated && !error && (
          <div className="flex flex-col items-center text-center py-6">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: 'rgba(189,90,74,0.12)' }}>
              <AlertTriangle size={22} style={{ color: '#BD5A4A' }} />
            </div>
            <p className="text-sm text-[#4A443F] font-medium">O relatório ficou incompleto.</p>
            <p className="text-sm text-[#7D766A] mt-1">Tente novamente em alguns minutos.</p>
          </div>
        )}

        {effectiveReport && !error && (
          <div className="text-sm text-[#4A443F] leading-relaxed">
            {isRaw ? (
              <div className="whitespace-pre-wrap max-h-80 overflow-y-auto">{effectiveReport.resumo_executivo}</div>
            ) : (
              renderStructuredContent(effectiveReport)
            )}
          </div>
        )}

        {canPDF && (
          <div className="flex gap-2.5 mt-4 pt-4 border-t" style={{ borderColor: 'rgba(150,140,120,0.2)' }}>
            <button type="button" onClick={() => baixarPDF(effectiveReport, nomeModelo)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
              style={{ background: 'rgba(93,95,160,0.08)', color: '#5D5FA0', border: '1px solid rgba(93,95,160,0.2)' }}>
              <Download size={16} />
              Baixar PDF
            </button>
            <button type="button" onClick={() => compartilharPDF(effectiveReport, nomeModelo)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
              style={{ background: 'rgba(93,95,160,0.08)', color: '#5D5FA0', border: '1px solid rgba(93,95,160,0.2)' }}>
              <Share2 size={16} />
              Compartilhar
            </button>
          </div>
        )}
      </div>
    );
  }

  function renderCardCompact(modelId, { report, error, loading } = {}, mostrarVoto) {
    const modelo = MODELOS.find(m => m.id === modelId);
    const nomeModelo = modelo ? modelo.label : modelId;
    const recoveredReport = report?.isRaw ? (extractReportFromRaw(report.resumo_executivo) || report) : report;
    const isTruncated = (recoveredReport === report) && !!report?.truncated;
    const effectiveReport = isTruncated ? null : recoveredReport;
    const isRaw = effectiveReport?.isRaw;
    const perguntasNorm = effectiveReport && Array.isArray(effectiveReport.perguntas_medico) ? effectiveReport.perguntas_medico.map(normalizePergunta) : [];

    if (loading) {
      return (
        <div key={modelId}
          className="day-summary-mesh relative z-10 rounded-2xl border border-[#EDE7DD] p-4 overflow-hidden shadow-[0_10px_24px_-10px_rgba(31,42,40,0.4)]">
          <div className="relative z-10 flex flex-col items-center justify-center py-2 gap-2">
            <img src={mascoteImage} alt="Mascote" className="w-10 h-10 animate-mascote-pulse" />
            <div className="relative h-6 w-full flex items-center justify-center overflow-hidden">
              <div key={activePhraseIndex} className="text-[11px] font-semibold text-[#4A8A5C] tg-phrase-cycle">
                {LOADING_FRASES[activePhraseIndex]}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div key={modelId} className={CARDS_CLASS}
        style={{ background: CARDS_BG_DARK, borderColor: CARDS_BORDER }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
            style={{ background: modelo?.recommended ? 'rgba(74,138,92,0.12)' : 'rgba(100,100,100,0.08)', color: modelo?.recommended ? '#4A8A5C' : '#7D766A' }}>
            {nomeModelo}
          </span>
          {mostrarVoto && !error && (
            <button type="button" onClick={() => votar(modelId)}
              className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-lg transition-colors"
              style={{ color: '#7D766A' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(74,138,92,0.1)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <ThumbsUp size={12} />
              {(votes[modelId] || 0) > 0 && <span>{votes[modelId]}</span>}
            </button>
          )}
        </div>
        {error && <p className="text-xs text-red-600 py-2">{error}</p>}
        {isTruncated && !error && (
          <div className="flex flex-col items-center text-center py-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center mb-2" style={{ background: 'rgba(189,90,74,0.12)' }}>
              <AlertTriangle size={16} style={{ color: '#BD5A4A' }} />
            </div>
            <p className="text-xs text-[#4A443F] font-medium">O relatório ficou incompleto.</p>
            <p className="text-xs text-[#7D766A]">Tente novamente em alguns minutos.</p>
          </div>
        )}
        {effectiveReport && !error && (
          <div className="text-xs text-[#4A443F] leading-relaxed max-h-60 overflow-y-auto">
            {isRaw ? (
              <p className="text-xs whitespace-pre-wrap">{effectiveReport.resumo_executivo.slice(0, 500)}{effectiveReport.resumo_executivo.length > 500 ? '...' : ''}</p>
            ) : (
              <div className="space-y-2">
                {effectiveReport.resumo_executivo && (
                  <div>
                    <h5 className="text-[10px] font-semibold uppercase tracking-wider text-[#7D766A] mb-0.5">Resumo</h5>
                    <p className="text-xs leading-relaxed">{effectiveReport.resumo_executivo}</p>
                  </div>
                )}

        {perguntasNorm.length > 0 && (
                  <div>
                    <h5 className="text-[10px] font-semibold uppercase tracking-wider text-[#7D766A] mb-0.5">Perguntas</h5>
                    <ul className="list-disc list-inside text-xs">
                      {perguntasNorm.map((p, i) => (
                        <li key={i}>{p.pergunta}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 relative z-10">
      <div className={CARDS_CLASS} style={{ background: CARDS_BG, borderColor: CARDS_BORDER }}>
        <div className="flex items-center gap-2 mb-2">
          <Calendar size={16} style={{ color: '#7D766A' }} />
          <span className="text-sm font-medium text-[#2B2A28]">Período da análise</span>
        </div>
        <div className="flex gap-2">
          {PERIODOS.map(p => (
            <button key={p.dias} type="button" onClick={() => setPeriodo(p.dias)}
              className="flex-1 py-2 rounded-xl text-xs font-medium transition-colors"
              style={{
                background: periodo === p.dias ? 'var(--brand)' : 'rgba(150,140,120,0.1)',
                color: periodo === p.dias ? '#fff' : '#4A443F',
              }}>
              {p.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-[#7D766A] mt-1.5">
          {filteredEntries.length} registro{filteredEntries.length !== 1 ? 's' : ''} no período
        </p>
        <div className="mt-2 pt-2 border-t" style={{ borderColor: 'rgba(150,140,120,0.2)' }}>
          <label className="flex items-center gap-2 cursor-pointer">
            <Calendar size={14} style={{ color: '#7D766A' }} />
            <span className="text-xs text-[#7D766A]">Data da consulta (opcional):</span>
          </label>
          <input type="date" value={consultaDate}
            onChange={e => {
              setConsultaDate(e.target.value);
              localStorage.setItem('tlgut_consulta_date', e.target.value);
            }}
            className="mt-1 w-full px-3 py-2 rounded-xl text-sm border"
            style={{ background: '#FBF9F4', borderColor: 'rgba(150,140,120,0.25)', color: '#2B2A28' }} />
        </div>
      </div>

      <div className={CARDS_CLASS} style={{ background: CARDS_BG, borderColor: CARDS_BORDER }}>
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(127,200,140,0.18)', color: '#4A8A5C' }}>
            <Lightbulb size={20} />
          </span>
          <div>
            <p className="font-medium text-[#2B2A28]">Relatório com IA</p>
            <p className="text-xs text-[#7D766A]">Resumo personalizado dos seus registros</p>
          </div>
        </div>

        <p className="text-sm text-[#4A443F] mt-3 leading-relaxed">
          A IA analisa seus sintomas, alimentação, sono e humor para apontar padrões e sugerir pontos de atenção de forma clara e objetiva.
        </p>

        {!compareMode && (
          <div className="mt-3 space-y-1.5">
            <p className="text-xs font-medium text-[#7D766A]">Modelo de IA:</p>
            {MODELOS.map(m => (
              <label key={m.id}
                className="flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-colors"
                style={{ background: selectedModel === m.id ? 'rgba(74,138,92,0.08)' : 'transparent' }}>
                <input type="radio" name="aiModel" value={m.id} checked={selectedModel === m.id}
                  onChange={() => setSelectedModel(m.id)} className="accent-[#4A8A5C]" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-[#2B2A28]">{m.label}</span>
                  {m.recommended && <span className="text-[10px] ml-1.5 px-1.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(74,138,92,0.12)', color: '#4A8A5C' }}>Recomendado</span>}
                  <p className="text-[11px] text-[#7D766A] truncate">{m.descricao}</p>
                </div>
              </label>
            ))}
          </div>
        )}

        <label className="flex items-center gap-2 mt-3 cursor-pointer select-none"
          title="Ativa 2 registros fictícios com sinais de alerta (sangue nas fezes, perda de peso) para validar o bloco de Sinais de Alerta da IA. Não afeta dados reais.">
          <input type="checkbox" checked={redFlagTest} onChange={e => toggleRedFlag(e.target.checked)}
            className="accent-[#BD5A4A]" />
          <span className="text-sm text-[#4A443F] flex items-center gap-1.5">
            <AlertTriangle size={14} style={{ color: '#BD5A4A' }} />
            Modo teste: Sinais de Alerta
          </span>
        </label>

        <label className="flex items-center gap-2 mt-3 cursor-pointer select-none">
          <input type="checkbox" checked={compareMode} onChange={e => setCompareMode(e.target.checked)}
            className="accent-[#4A8A5C]" />
          <span className="text-sm text-[#4A443F]">Comparar todos os modelos</span>
        </label>

        <button type="button" onClick={handleGerar}
          disabled={isLoading}
          className="mt-3 w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-60 transition-opacity"
          style={{ background: 'var(--brand)', color: '#fff' }}>
          {isLoading ? 'Gerando...' : hasResults ? 'Gerar novamente' : 'Gerar relatório'}
        </button>
      </div>

      {hasResults && !compareMode && reports[selectedModel] && (
        <div>
          {renderCardStructured(selectedModel, reports[selectedModel], false)}
        </div>
      )}

      {hasResults && compareMode && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {MODELOS.map(m => {
            if (!reports[m.id]) return null;
            return renderCardCompact(m.id, reports[m.id], true);
          })}
        </div>
      )}

      {reports._empty && (
        <div className={CARDS_CLASS} style={{ background: CARDS_BG, borderColor: CARDS_BORDER }}>
          <p className="text-sm text-[#7D766A]">{reports._empty.error}</p>
        </div>
      )}

      {hasResults && (
        <p className="text-[11px] text-[#7D766A] italic leading-snug">
          Relatório gerado por IA com base nos seus registros. Não substitui avaliação médica.
        </p>
      )}

      {consultaAberta && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setConsultaAberta(false)}>
          <div className="w-full sm:max-w-lg max-h-[80vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-6"
            style={{ background: '#FBF9F4' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ClipboardList size={20} style={{ color: '#4A8A5C' }} />
                <h3 className="text-lg font-semibold text-[#2B2A28]">Modo Consulta</h3>
              </div>
              <button type="button" onClick={() => setConsultaAberta(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#EBE7DD] transition-colors">
                <X size={18} style={{ color: '#7D766A' }} />
              </button>
            </div>
            <p className="text-sm text-[#4A443F] mb-4">
              Perguntas selecionadas para levar ao médico:
            </p>
            <div className="space-y-2">
              {selectedQuestions.map((q, idx) => (
                <div key={idx} className="flex items-start gap-2 px-3 py-2 rounded-xl"
                  style={{ background: 'rgba(127,200,140,0.08)' }}>
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0" style={{ color: '#4A8A5C' }} />
                  <span className="text-sm text-[#2B2A28]">{q}</span>
                </div>
              ))}
            </div>
            {selectedQuestions.length > 0 && (
              <button type="button" onClick={() => {
                const text = selectedQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n');
                navigator.clipboard.writeText(text).catch(() => {});
                setConsultaAberta(false);
              }}
                className="mt-4 w-full py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ background: 'var(--brand)', color: '#fff' }}>
                Copiar perguntas
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
