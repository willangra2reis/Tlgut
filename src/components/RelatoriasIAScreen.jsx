import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Lightbulb, ThumbsUp, ChevronDown, CheckCircle2, X, Calendar,
  Download, Share2, FileText, Sparkles, Stethoscope, TrendingUp, AlertTriangle, Map,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { loadProfile, CONDICOES_LABELS } from '../lib/profile.js';
import { calcularEstatisticas, gerarDadosRelatorioMock } from '../lib/diary.js';
import { dorPorRegiao } from '../lib/insights.js';
import { REGION_CENTROIDES, REGION_LABELS } from '../lib/organs.js';
import { extractReportFromRaw, LOADING_FRASES } from '../lib/ai-report.js';
import { proximaConsulta } from '../lib/consulta.js';
import { loadReports, saveReport, removeReport, migrarExpressLegado, MAX_REPORTS } from '../lib/reports.js';
import PainHeatmap from './PainHeatmap.jsx';
import digestiveClosedImage from '../assets/sisdiges_fechado.jpg';
const digestiveImgEl = typeof Image !== 'undefined' ? new Image() : null;
if (digestiveImgEl) digestiveImgEl.src = digestiveClosedImage;
import mascoteImage from '../assets/mascote.png';

const MODELOS = [
  { id: '@google/gemini-2.5-flash',            label: 'Gemini 2.5 Flash',  descricao: 'Google, 1500 req/dia grátis, alta qualidade', recommended: true },
  { id: '@google/gemini-2.5-flash-lite',       label: 'Gemini 2.5 Flash Lite', descricao: 'Google, versão leve do 2.5 Flash',         recommended: false },
  { id: '@cf/zai-org/glm-4.7-flash',           label: 'GLM 4.7 Flash',    descricao: 'Multilíngue, rápido, 131K de contexto, Cloudflare', recommended: false },
  { id: '@cf/meta/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout 17B (Experimental)', descricao: 'MoE com 16 especialistas, Meta, Cloudflare', recommended: false },
  { id: '@cf/google/gemma-4-26b-a4b-it',       label: 'Gemma 4 26B',      descricao: 'Alta inteligência, Google, Cloudflare',      recommended: false },
  { id: '@cf/openai/gpt-oss-120b',             label: 'GPT-OSS 120B',     descricao: 'Open-source 120B, Cloudflare',               recommended: false },
];

const MODELO_PADRAO = '@google/gemini-2.5-flash';

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
  const [selectedModel, setSelectedModel] = useState(MODELO_PADRAO);
  const [periodo, setPeriodo] = useState(30);
  const [expandedCorr, setExpandedCorr] = useState({});
  const [sortDiscussOrder, setSortDiscussOrder] = useState('cronologica');
  const [votes, setVotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tlgut_model_votes') || '{}'); }
    catch { return {}; }
  });

  const [activePhraseIndex, setActivePhraseIndex] = useState(0);
  const isLoading = Object.values(reports).some(r => r?.loading);

  // ── Saved reports ──────────────────────────────────────────────────────────
  const [savedReports, setSavedReports] = useState([]);
  const [showSavedReports, setShowSavedReports] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  useEffect(() => {
    if (!toast) return;
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
    return () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); };
  }, [toast]);

  useEffect(() => {
    migrarExpressLegado();
    setSavedReports(loadReports('ia'));
  }, []);

  function loadSavedReport(r) {
    if (!r.report) return;
    setReports({
      [r.modelo || '@google/gemini-2.5-flash']: { loading: false, report: r.report, error: null }
    });
    setShowSavedReports(false);
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }

  function handleRemoveReport(id) {
    removeReport(id);
    setSavedReports(prev => prev.filter(r => r.id !== id));
  }

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
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const cutoff = Date.now() - periodo * 86400000;
    return workingEntries.filter(e => {
      const ts = e.ts || e.timestamp || 0;
      return ts >= cutoff;
    });
  }, [workingEntries, periodo]);

  const discutirEntries = useMemo(() => {
    const candidates = filteredEntries.filter(e => e.meta?.discutir_consulta);
    if (sortDiscussOrder === 'prioridade') {
      return [...candidates].sort((a, b) => (b.meta?.prioridade || 1) - (a.meta?.prioridade || 1));
    }
    const dayScale = { hoje: 1, ontem: 0 };
    return [...candidates].sort((a, b) => {
      const dayDiff = (dayScale[a.day] || 0) - (dayScale[b.day] || 0);
      if (dayDiff !== 0) return dayDiff;
      return (a.time || '').localeCompare(b.time || '');
    });
  }, [filteredEntries, sortDiscussOrder]);

  const hasResults = Object.keys(reports).some(k => k !== '_empty');

  const gerarRelatorio = useCallback(async (entriesFor, model) => {
    const body = { entries: entriesFor, model, periodo };
    const c = proximaConsulta();
    const cd = c && c.data ? c.data.trim() : null;
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
  }, [periodo, entries]);

  async function handleGerar() {
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
        const painCounts = dorPorRegiao(filteredEntries);
        const painValores = Object.values(painCounts);
        const painTotal = painValores.reduce((s, x) => s + x, 0);
        const painMax = Math.max(1, ...painValores);
        const painItems = REGION_CENTROIDES
          .map(o => ({ id: o.id, label: o.label, cx: o.cx, cy: o.cy, n: painCounts[o.id] || 0 }))
          .filter(o => o.n > 0)
          .sort((a, b) => b.n - a.n);
        const reportWithSnapshot = {
          ...r.report,
          _discutirEntries: discutirEntries,
          _painData: { painCounts, painItems, painTotal, painMax },
        };
        setReports({ [selectedModel]: { loading: false, report: reportWithSnapshot, error: null } });
        const periodStart = new Date(Date.now() - periodo * 86400000).toISOString().slice(0, 10);
        const periodEnd = new Date().toISOString().slice(0, 10);
        const { saved } = saveReport({ type: 'ia', report: reportWithSnapshot, modelo: selectedModel, period_start: periodStart, period_end: periodEnd });
        if (saved) {
          setSavedReports(prev => [saved, ...prev].slice(0, MAX_REPORTS));
          const allReports = loadReports('ia');
          if (allReports.length >= MAX_REPORTS && allReports[allReports.length - 1]?.id === saved.id) {
            setToast('Relatório mais antigo substituído (limite de 10)');
          }
        } else {
          setToast('Relatório não salvo (conteúdo inválido)');
        }
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

  function toggleAccordion(idx) {
    setExpandedCorr(prev => ({ ...prev, [idx]: !prev[idx] }));
  }

  function renderStructuredContent(report) {
    const { resumo_executivo, evolucao, correlacoes, consultas } = report;
    const discutirSnapshot = Array.isArray(report._discutirEntries) ? report._discutirEntries : [];
    const paragrafos = resumo_executivo ? resumo_executivo.split(/\n\n+/).filter(p => p.trim()) : [];
    const temEvolucao = typeof evolucao === 'string' && evolucao.trim().length > 0;
    return (
      <div className="space-y-5">
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
          const pd = report._painData;
          let painItems, painTotal, painMax;
          if (pd) {
            painItems = pd.painItems;
            painTotal = pd.painTotal;
            painMax = pd.painMax;
          } else {
            const painCounts = dorPorRegiao(filteredEntries);
            const valores = Object.values(painCounts);
            painTotal = valores.reduce((s, x) => s + x, 0);
            painMax = Math.max(1, ...valores);
            painItems = REGION_CENTROIDES
              .map(o => ({ id: o.id, label: o.label, cx: o.cx, cy: o.cy, n: painCounts[o.id] || 0 }))
              .filter(o => o.n > 0)
              .sort((a, b) => b.n - a.n);
          }
          if (painTotal === 0) return null;
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
                  <img src={digestiveClosedImage} alt="Mapa de dor no corpo"
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
                <strong>Nota:</strong> Os pontos na silhueta indicam a região corporal onde o paciente relatou a sensação (lados, centro, parte superior e inferior do abdômen). A localização marcada não identifica o órgão de origem nem estabelece diagnóstico — apenas registra o relato. A interpretação clínica é exclusiva do médico.
              </p>
            </div>
          );
        })()}

        {/* Eventos selecionados para discutir na consulta */}
        {discutirSnapshot.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(74,138,92,0.12)' }}>
                  <CheckCircle2 size={15} style={{ color: '#4A8A5C' }} />
                </span>
                <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: '#4A8A5C' }}>Discutir na consulta</h4>
              </div>
              <div className="flex gap-1">
                {['cronologica', 'prioridade'].map((opt) => (
                  <button key={opt} type="button" onClick={() => setSortDiscussOrder(opt)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-colors"
                    style={{
                      background: sortDiscussOrder === opt ? 'rgba(74,138,92,0.12)' : 'transparent',
                      color: sortDiscussOrder === opt ? '#4A8A5C' : '#B6AE9F',
                    }}>
                    {opt === 'cronologica' ? 'Cronológica' : 'Prioridade'}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              {discutirSnapshot.map((e) => {
                const prio = e.meta?.prioridade || 3;
                const cor = prio >= 4 ? '#BD5A4A' : prio >= 3 ? '#C9763A' : '#4A8A5C';
                return (
                  <div key={e.id} className="rounded-xl p-3 flex items-start gap-3"
                    style={{ background: 'rgba(74,138,92,0.04)', border: '1px solid rgba(74,138,92,0.15)' }}>
                    <div className="flex gap-0.5 mt-0.5 shrink-0">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <span key={n} className="w-1.5 h-1.5 rounded-full"
                          style={{ background: n <= prio ? cor : '#EDE7DD' }} />
                      ))}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[#2B2A28]">{e.title || e.type}</p>
                      {e.description && <p className="text-[11px] text-[#7D766A] mt-0.5 line-clamp-2">{e.description}</p>}
                      {e.meta?.note && <p className="text-[11px] text-[#5B8C91] mt-0.5 italic line-clamp-2">{e.meta.note}</p>}
                      <p className="text-[10px] text-[#B6AE9F] mt-0.5">{e.day === 'hoje' ? 'Hoje' : 'Ontem'} às {e.time}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {Array.isArray(consultas) && consultas.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(91,140,145,0.12)' }}>
                <Stethoscope size={15} style={{ color: '#5B8C91' }} />
              </span>
              <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: '#5B8C91' }}>Resumo das últimas consultas</h4>
            </div>
            <div className="space-y-2">
              {consultas.map((c, idx) => (
                <div key={idx} className="rounded-xl p-3"
                  style={{ background: 'rgba(91,140,145,0.06)', border: '1px solid rgba(91,140,145,0.2)' }}>
                  <p className="text-sm font-semibold text-[#2B2A28]">{c.profissional || `Consulta ${idx + 1}`}</p>
                  {c.orientacao && <p className="text-xs text-[#4A443F] mt-1 leading-relaxed">{c.orientacao}</p>}
                </div>
              ))}
            </div>
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

    const pd = r._painData;
    let painItems, painTotal, painMax;
    if (pd) {
      painItems = pd.painItems;
      painTotal = pd.painTotal;
      painMax = pd.painMax;
    } else {
      const painCounts = dorPorRegiao(workingEntries);
      const painValores = Object.values(painCounts);
      painTotal = painValores.reduce((s, x) => s + x, 0);
      painMax = Math.max(1, ...painValores);
      painItems = REGION_CENTROIDES
        .map(o => ({ id: o.id, label: o.label, cx: o.cx, cy: o.cy, n: painCounts[o.id] || 0 }))
        .filter(o => o.n > 0)
        .sort((a, b) => b.n - a.n);
    }
    if (painTotal > 0) {
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
      const caveat = 'Nota: os pontos na silhueta indicam a região corporal onde o paciente relatou a sensação (lados, centro, parte superior e inferior do abdômen). A localização marcada não identifica o órgão de origem nem estabelece diagnóstico — apenas registra o relato. A interpretação clínica é exclusiva do médico.';
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(125, 118, 106);
      const cavLines = doc.splitTextToSize(caveat, maxW);
      cavLines.forEach(l => { ensureSpace(11); doc.text(l, margin, y); y += 11; });
      spacer(8);
    }

    // ── Discutir na consulta ──
    const discutirPDF = Array.isArray(r._discutirEntries) ? r._discutirEntries : [];
    if (discutirPDF.length > 0) {
      heading('Discutir na consulta', [74, 138, 92]);
      const sortedPDF = [...discutirPDF].sort((a, b) => (b.meta?.prioridade || 1) - (a.meta?.prioridade || 1));
      sortedPDF.forEach((e) => {
        ensureSpace(30);
        const prio = e.meta?.prioridade || 3;
        const cor = prio >= 4 ? '#BD5A4A' : prio >= 3 ? '#C9763A' : '#4A8A5C';
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(43, 42, 40);
        const titulo = `${e.title || e.type || 'Registro'}  ·  Prioridade ${prio}/5  ·  ${e.day === 'hoje' ? 'Hoje' : 'Ontem'} ${e.time}`;
        const tLines = doc.splitTextToSize(titulo, maxW);
        tLines.forEach(l => { ensureSpace(14); doc.text(l, margin, y); y += 14; });
        if (e.description) {
          paragraph(e.description, [125, 118, 106]);
          spacer(4);
        }
        if (e.meta?.note) {
          paragraph(e.meta.note, [91, 140, 145]);
          spacer(4);
        }
        spacer(6);
      });
      spacer(4);
    }

    const consultas = Array.isArray(r.consultas) ? r.consultas.filter(c => c && (c.profissional || c.orientacao)) : [];
    if (consultas.length > 0) {
      heading('Resumo das últimas consultas', [91, 140, 145]);
      consultas.forEach((c, i) => {
        ensureSpace(16);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(43, 42, 40);
        doc.text(c.profissional || `Consulta ${i + 1}`, margin, y);
        y += 14;
        if (c.orientacao) {
          paragraph(c.orientacao, [100, 100, 95]);
          spacer(6);
        }
      });
      spacer(8);
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

      {/* Saved reports */}
      {savedReports.length > 0 && (
        <div className={CARDS_CLASS} style={{ background: CARDS_BG, borderColor: CARDS_BORDER }}>
          <button type="button" onClick={() => setShowSavedReports(!showSavedReports)}
            className="w-full flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileText size={16} style={{ color: 'var(--brand)' }} />
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#2B2A28' }}>
                Relatórios salvos ({savedReports.length}/{MAX_REPORTS})
              </p>
            </div>
            <ChevronDown size={16} className={`transition-transform duration-200 ${showSavedReports ? 'rotate-180' : ''}`}
              style={{ color: '#B6AE9F' }} />
          </button>
          {showSavedReports && (
            <div className="mt-3 space-y-2">
              {savedReports.map(r => (
                <div key={r.id}
                  className="flex items-start gap-2 p-3 rounded-xl border border-[#EDE7DD] bg-[#FBF9F4]">
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => loadSavedReport(r)}>
                    <p className="text-[11px] font-medium" style={{ color: '#B6AE9F' }}>
                      {new Date(r.created_at).toLocaleDateString('pt-BR', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                    {r.period_start && r.period_end && (
                      <p className="text-[10px] mt-0.5 text-[#7D766A]">
                        Período: {new Date(r.period_start).toLocaleDateString('pt-BR')} — {new Date(r.period_end).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                    {r.modelo && (
                      <p className="text-[10px] text-[#9A938A] font-mono truncate">
                        {MODELOS.find(m => m.id === r.modelo)?.label || r.modelo}
                      </p>
                    )}
                    <p className="text-sm text-[#2B2A28] line-clamp-2 mt-0.5">
                      {r.resumo_preview || 'Relatório IA'}
                    </p>
                  </div>
                  <button type="button" onClick={() => handleRemoveReport(r.id)}
                    className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center hover:bg-[#F1ECE3] text-[#B6AE9F]">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-[#2B2A28] text-white text-xs font-medium shadow-lg"
          style={{ animation: 'fadeIn 0.3s ease' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
