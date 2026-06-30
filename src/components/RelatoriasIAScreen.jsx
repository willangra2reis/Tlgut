import { useState, useCallback, useMemo } from 'react';
import {
  Lightbulb, ThumbsUp, ChevronDown, CheckCircle2, ClipboardList, X, Calendar,
} from 'lucide-react';
import { gerarDadosRelatorioMock } from '../lib/diary.js';

function normalizePergunta(item) {
  if (typeof item === 'string') return { pergunta: item, motivo: '' };
  if (item && typeof item === 'object') return { pergunta: item.pergunta || '', motivo: item.motivo || '' };
  return { pergunta: '', motivo: '' };
}

const MODELOS = [
  { id: '@google/gemini-2.5-flash',            label: 'Gemini 2.5 Flash',  descricao: 'Google, 1500 req/dia grátis, alta qualidade', recommended: true },
  { id: '@google/gemini-2.5-flash-lite',       label: 'Gemini 2.5 Flash Lite', descricao: 'Google, versão leve do 2.5 Flash',         recommended: false },
  { id: '@cf/zai-org/glm-4.7-flash',           label: 'GLM 4.7 Flash',    descricao: 'Multilíngue, rápido, 131K de contexto, Cloudflare', recommended: false },
  { id: '@cf/meta/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout 17B', descricao: 'MoE com 16 especialistas, Meta, Cloudflare', recommended: false },
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

  const hasResults = Object.keys(reports).some(k => k !== '_empty');

  const gerarRelatorio = useCallback(async (entriesFor, model) => {
    const body = { entries: entriesFor, model };
    const cd = consultaDate && consultaDate.trim() ? consultaDate.trim() : null;
    if (cd) body.consulta_date = cd;
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
  }, [consultaDate]);

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
    const { resumo_executivo, correlacoes, perguntas_medico } = report;
    const perguntasNorm = Array.isArray(perguntas_medico) ? perguntas_medico.map(normalizePergunta) : [];
    return (
      <div className="space-y-4">
        {resumo_executivo && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#7D766A] mb-1.5">Resumo Executivo</h4>
            <p className="text-sm text-[#4A443F] leading-relaxed">{resumo_executivo}</p>
          </div>
        )}

        {Array.isArray(correlacoes) && correlacoes.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#7D766A] mb-1.5">Correlações Encontradas</h4>
            <div className="space-y-1">
              {correlacoes.map((corr, idx) => (
                <div key={idx} className="rounded-xl border overflow-hidden"
                  style={{ borderColor: 'rgba(150,140,120,0.2)' }}>
                  <button type="button" onClick={() => toggleAccordion(idx)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-left text-sm font-medium text-[#2B2A28] hover:bg-[#F5F3EE] transition-colors">
                    <span>{corr.titulo || `Correlação ${idx + 1}`}</span>
                    <span style={{ color: expandedCorr[idx] ? '#4A8A5C' : '#7D766A' }}>
                      <ChevronDown size={16}
                        className={`transition-transform duration-200 ${expandedCorr[idx] ? 'rotate-180' : ''}`} />
                    </span>
                  </button>
                  {expandedCorr[idx] && (
                    <div className="px-3 pb-3 text-sm text-[#4A443F] space-y-1">
                      {corr.descricao && <p>{corr.descricao}</p>}
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

        {perguntasNorm.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#7D766A] mb-1.5">Perguntas para o Médico</h4>
            <div className="space-y-1">
              {perguntasNorm.map((item, idx) => (
                <label key={idx}
                  className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-[#F5F3EE] transition-colors">
                  <input type="checkbox" checked={selectedQuestions.includes(item.pergunta)}
                    onChange={() => toggleQuestao(item.pergunta)}
                    className="mt-0.5 accent-[#4A8A5C]" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-[#2B2A28]">{item.pergunta}</span>
                    {item.motivo && (
                      <p className="text-[11px] text-[#7D766A] mt-0.5">{item.motivo}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
            {selectedQuestions.length > 0 && (
              <button type="button" onClick={() => setConsultaAberta(true)}
                className="mt-3 w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ background: 'var(--brand)', color: '#fff' }}>
                Abrir Modo Consulta ({selectedQuestions.length})
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderCardStructured(modelId, { report, error, loading } = {}, mostrarVoto) {
    const modelo = MODELOS.find(m => m.id === modelId);
    const nomeModelo = modelo ? modelo.label : modelId;
    const isRaw = report?.isRaw;

    return (
      <div key={modelId} className={CARDS_CLASS}
        style={{ background: loading ? CARDS_BG : CARDS_BG_DARK, borderColor: CARDS_BORDER }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ background: modelo?.recommended ? 'rgba(74,138,92,0.12)' : 'rgba(100,100,100,0.08)', color: modelo?.recommended ? '#4A8A5C' : '#7D766A' }}>
            {nomeModelo}{modelo?.recommended ? ' ★' : ''}
          </span>
          {mostrarVoto && !loading && !error && (
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

        {loading && (
          <div className="flex items-center gap-2 py-6">
            <span className="w-5 h-5 border-2 rounded-full animate-spinner"
              style={{ borderColor: '#D0CAB8', borderTopColor: '#4A8A5C' }} />
            <span className="text-sm text-[#7D766A]">Gerando relatório...</span>
          </div>
        )}

        {error && (
          <div className="py-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {report && !error && !loading && (
          <div className="text-sm text-[#4A443F] leading-relaxed">
            {isRaw ? (
              <div className="whitespace-pre-wrap max-h-80 overflow-y-auto">{report.resumo_executivo}</div>
            ) : (
              renderStructuredContent(report)
            )}
          </div>
        )}
      </div>
    );
  }

  function renderCardCompact(modelId, { report, error, loading } = {}, mostrarVoto) {
    const modelo = MODELOS.find(m => m.id === modelId);
    const nomeModelo = modelo ? modelo.label : modelId;
    const isRaw = report?.isRaw;
    const perguntasNorm = report && Array.isArray(report.perguntas_medico) ? report.perguntas_medico.map(normalizePergunta) : [];

    return (
      <div key={modelId} className={CARDS_CLASS}
        style={{ background: loading ? CARDS_BG : CARDS_BG_DARK, borderColor: CARDS_BORDER }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
            style={{ background: modelo?.recommended ? 'rgba(74,138,92,0.12)' : 'rgba(100,100,100,0.08)', color: modelo?.recommended ? '#4A8A5C' : '#7D766A' }}>
            {nomeModelo}
          </span>
          {mostrarVoto && !loading && !error && (
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
        {loading && (
          <div className="flex items-center gap-2 py-4">
            <span className="w-4 h-4 border-2 rounded-full animate-spinner"
              style={{ borderColor: '#D0CAB8', borderTopColor: '#4A8A5C' }} />
            <span className="text-xs text-[#7D766A]">Gerando...</span>
          </div>
        )}
        {error && <p className="text-xs text-red-600 py-2">{error}</p>}
        {report && !error && !loading && (
          <div className="text-xs text-[#4A443F] leading-relaxed max-h-60 overflow-y-auto">
            {isRaw ? (
              <p className="text-xs whitespace-pre-wrap">{report.resumo_executivo.slice(0, 500)}{report.resumo_executivo.length > 500 ? '...' : ''}</p>
            ) : (
              <div className="space-y-2">
                {report.resumo_executivo && (
                  <div>
                    <h5 className="text-[10px] font-semibold uppercase tracking-wider text-[#7D766A] mb-0.5">Resumo</h5>
                    <p className="text-xs leading-relaxed">{report.resumo_executivo}</p>
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

        <label className="flex items-center gap-2 mt-3 cursor-pointer select-none">
          <input type="checkbox" checked={compareMode} onChange={e => setCompareMode(e.target.checked)}
            className="accent-[#4A8A5C]" />
          <span className="text-sm text-[#4A443F]">Comparar todos os modelos</span>
        </label>

        <button type="button" onClick={handleGerar}
          disabled={Object.values(reports).some(r => r?.loading)}
          className="mt-3 w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-60 transition-opacity"
          style={{ background: 'var(--brand)', color: '#fff' }}>
          {Object.values(reports).some(r => r?.loading) ? 'Gerando...' : hasResults ? 'Gerar novamente' : 'Gerar relatório'}
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
