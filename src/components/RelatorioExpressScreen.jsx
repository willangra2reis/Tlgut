import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  AlertTriangle, Sparkles, Stethoscope, ChevronDown, RotateCcw, Trash2,
} from 'lucide-react';
import Silhouette from './Silhouette.jsx';
import { extractReportFromRaw, normalizePergunta, LOADING_FRASES } from '../lib/ai-report.js';
import { loadExpressDraft, saveExpressDraft, clearExpressDraft, saveExpressReport } from '../lib/express.js';
import { proximaConsulta } from '../lib/consulta.js';
import { loadProfile } from '../lib/profile.js';
import mascoteImage from '../assets/mascote.png';

// Chips guiados: inserem fragmentos no textarea no cursor, para ajudar quem
// não sabe por onde começar a relatar.
const CHIPS_GUIADOS = [
  { label: 'Quando começou?', snippet: '\n\nQuando começou: ' },
  { label: 'Frequência',      snippet: '\n\nFrequência: ' },
  { label: 'Piora com quê?',  snippet: '\n\nPiora com: ' },
  { label: 'Alívio com quê?', snippet: '\n\nAlívio com: ' },
  { label: 'Sintomas associados', snippet: '\n\nSintomas associados: ' },
  { label: 'Exames anteriores',  snippet: '\n\nExames/anteriores: ' },
  { label: 'Medicamentos atuais', snippet: '\n\nMedicamentos atuais: ' },
];

const SOFT_BORDER = 'rgba(150,140,120,0.25)';

export default function RelatorioExpressScreen() {
  // ── Estado do draft (auto-save) ──────────────────────────────────────────
  const draftInicial = useMemo(() => loadExpressDraft(), []);
  const [narrative, setNarrative] = useState(draftInicial.narrative);
  const [clouds, setClouds] = useState(draftInicial.pain_map.clouds);
  const [intensity, setIntensity] = useState(draftInicial.pain_map.intensity);
  const [painOpen, setPainOpen] = useState(false);
  const [showOrgans, setShowOrgans] = useState(true);
  const txRef = useRef(null);

  // Debounce auto-save (800ms)
  useEffect(() => {
    const t = setTimeout(() => {
      saveExpressDraft({ narrative, pain_map: { clouds, intensity } });
    }, 800);
    return () => clearTimeout(t);
  }, [narrative, clouds, intensity]);

  // ── Estado do relatório gerado ───────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [report, setReport] = useState(null);
  const [activePhraseIndex, setActivePhraseIndex] = useState(0);
  const [regenerations, setRegenerations] = useState(0);
  const MAX_REGEN = 2;

  useEffect(() => {
    if (!loading) return;
    setActivePhraseIndex(0);
    const interval = setInterval(() => {
      setActivePhraseIndex(prev => (prev + 1) % LOADING_FRASES.length);
    }, 3800);
    return () => clearInterval(interval);
  }, [loading]);

  // ── Tap handler para silhueta ───────────────────────────────────────────
  const handleTap = useCallback(({ x, y, organ }) => {
    setClouds((prev) => {
      const idx = prev.findIndex((c) => Math.abs(c.x - x) < 3 && Math.abs(c.y - y) < 3);
      if (idx !== -1) return prev.filter((_, i) => i !== idx);
      return [...prev, { x, y, organ: organ.id, organLabel: organ.label }];
    });
  }, []);

  // ── Inserir snippet de chip no cursor ───────────────────────────────────
  const insertSnippet = useCallback((snippet) => {
    const el = txRef.current;
    if (!el) { setNarrative(n => n + snippet); return; }
    const start = el.selectionStart || narrative.length;
    const end = el.selectionEnd || narrative.length;
    const next = narrative.slice(0, start) + snippet + narrative.slice(end);
    setNarrative(next);
    setTimeout(() => {
      el.focus();
      const pos = start + snippet.length;
      el.setSelectionRange(pos, pos);
    }, 0);
  }, [narrative]);

  // ── Limpar tudo ─────────────────────────────────────────────────────────
  const limpar = useCallback(() => {
    setNarrative('');
    setClouds([]);
    setIntensity(5);
    setReport(null);
    setError(null);
    clearExpressDraft();
  }, []);

  // ── Gerar relatório Express ──────────────────────────────────────────────
  const consulta = useMemo(() => proximaConsulta(), []);

  const gerarExpress = useCallback(async (e) => {
    e.preventDefault();
    if (loading) return;
    if (narrative.trim().length < 10) {
      setError('Escreva ao menos uma frase sobre o que você está sentindo antes de gerar o relatório.');
      return;
    }
    if (regenerations >= MAX_REGEN) {
      setError('Você atingiu o limite de 2 regenerações por sessão. Tente novamente mais tarde.');
      return;
    }
    setLoading(true);
    setError(null);
    setReport(null);
    setRegenerations(n => n + 1);

    const body = {
      mode: 'express',
      narrative,
      pain_map: clouds.length > 0 ? { clouds, intensity } : null,
      model: '@google/gemini-2.5-flash',
    };
    if (consulta && consulta.data) body.consulta_date = consulta.data;
    try {
      const pr = loadProfile();
      if (pr && Object.keys(pr).length > 0) body.profile = pr;
    } catch {}
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      let rel = data?.report || data;
      if (rel && typeof rel === 'string' && !rel.startsWith('{')) {
        rel = extractReportFromRaw(rel) || { resumo_executivo: rel, sinais_alerta: [], correlacoes: [], perguntas_medico: [] };
      } else if (typeof rel === 'string') {
        const parsed = extractReportFromRaw(rel) || { resumo_executivo: rel, sinais_alerta: [], correlacoes: [], perguntas_medico: [] };
        rel = parsed;
      }
      setReport(rel);
      saveExpressReport(rel);
    } catch (err) {
      setError(err.message || 'Falha ao gerar relatório.');
    } finally {
      setLoading(false);
    }
  }, [loading, narrative, clouds, intensity, regenerations, consulta]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Header do Express */}
      <div className="rounded-2xl bg-white border shadow-[0_8px_22px_-12px_rgba(31,42,40,0.35)] p-4"
        style={{ borderColor: SOFT_BORDER }}>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={20} style={{ color: 'var(--brand)' }} />
          <p className="titulo-cursivo text-xl font-serif" style={{ color: 'var(--amb-text)' }}>
            Relatório Express
          </p>
        </div>
        <p className="text-xs leading-snug" style={{ color: '#7D766A' }}>
          Para quando você está sem registros diários mas tem consulta próxima. Em texto livre, narre o que está sentindo, desde quando começou, o que piora ou alivia. Você pode voltar e completar conforme lembranças surgirem.
        </p>
      </div>

      {/* Textarea grande */}
      <div className="rounded-2xl bg-white border shadow-[0_8px_22px_-12px_rgba(31,42,40,0.35)] p-4"
        style={{ borderColor: SOFT_BORDER }}>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#B6AE9F] mb-2">O que você está sentindo</p>
        <textarea
          ref={txRef}
          value={narrative}
          onChange={(e) => setNarrative(e.target.value)}
          placeholder="Ex: há uns 15 dias comecei a sentir cólica logo após a refeição, principalmente depois do almoço. A dor dura de 30 min a 1h e passa levemente se me deito. Não tenho registrado no diário, então lembrando do que eu posso agora…"
          className="w-full min-h-[160px] p-3 rounded-xl text-sm border resize-y"
          style={{ background: '#FBF9F4', borderColor: 'rgba(150,140,120,0.25)', color: '#2B2A28', lineHeight: 1.5 }}
        />
        <div className="flex flex-wrap gap-1.5 mt-2">
          {CHIPS_GUIADOS.map((chip) => (
            <button type="button" key={chip.label} onClick={() => insertSnippet(chip.snippet)}
              className="px-2.5 py-1 rounded-full text-xs font-medium border"
              style={{ borderColor: 'rgba(150,140,120,0.4)', color: '#7D766A', background: 'rgba(255,255,255,0.5)' }}>
              {chip.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] mt-2 leading-snug" style={{ color: '#9A938A' }}>
          Auto-salvo. Volte quando lembrar de algo novo e complete o texto — você decide.
        </p>
      </div>

      {/* Silhueta opcional (retrátil) */}
      <div className="rounded-2xl bg-white border shadow-[0_8px_22px_-12px_rgba(31,42,40,0.35)] p-4"
        style={{ borderColor: SOFT_BORDER }}>
        <button type="button" onClick={() => setPainOpen(!painOpen)}
          className="w-full flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles size={16} style={{ color: '#BD5A4A' }} />
            <p className="text-xs font-semibold uppercase tracking-wide text-[#B6AE9F]">Marcar onde dói (opcional)</p>
            {clouds.length > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(189,90,74,0.1)', color: '#BD5A4A' }}>
                {clouds.length} {clouds.length === 1 ? 'marca' : 'marcas'}
              </span>
            )}
          </div>
          <ChevronDown size={16} className={`transition-transform duration-200 ${painOpen ? 'rotate-180' : ''}`}
            style={{ color: '#B6AE9F' }} />
        </button>
        {painOpen && (
          <div className="mt-4">
            <div className="flex items-center gap-3 mb-2">
              <button type="button" onClick={() => setShowOrgans(!showOrgans)}
                className="text-xs px-2.5 py-1 rounded-full border"
                style={{ borderColor: 'rgba(150,140,120,0.4)', color: '#7D766A' }}>
                  {showOrgans ? 'Ocultar órgãos' : 'Mostrar órgãos'}
                </button>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#7D766A]">Intensidade</span>
                <input type="range" min={1} max={10} value={intensity}
                  onChange={(e) => setIntensity(Number(e.target.value))}
                  className="w-24" style={{ accentColor: '#BD5A4A' }} />
                <span className="text-xs text-[#7D766A] tabular-nums">{intensity}/10</span>
              </div>
            </div>
            <Silhouette clouds={clouds} intensity={intensity} onTap={handleTap} showOrgans={showOrgans} />
            <p className="text-[11px] mt-2 leading-snug text-center" style={{ color: '#9A938A' }}>
              Toque para marcar. Toque novamente para remover. A intensidade acima aplica-se a todas as marcas.
            </p>
          </div>
        )}
      </div>

      {/* Ações */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={gerarExpress} disabled={loading}
          className="flex-1 py-3 rounded-2xl text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ background: 'var(--brand)' }}>
          <Sparkles size={16} />
          {loading ? 'Gerando…' : (regenerations > 0 ? 'Regenerar relatório' : 'Gerar relatório Express')}
        </button>
        {(narrative || clouds.length > 0 || report) && (
          <button type="button" onClick={limpar} disabled={loading}
            className="px-3 py-3 rounded-2xl border text-[#7D766A] disabled:opacity-50"
            style={{ borderColor: SOFT_BORDER }} aria-label="Limpar tudo">
            <Trash2 size={16} />
          </button>
        )}
      </div>
      <p className="text-[11px] leading-snug" style={{ color: '#9A938A' }}>
        Limite de {MAX_REGEN} regenerações por sessão. {MAX_REGEN - regenerations} restante(s).
      </p>

      {/* Erro */}
      {error && (
        <div className="rounded-2xl border p-3" style={{ borderColor: 'rgba(189,90,74,0.4)', background: '#FDF6F4' }}>
          <p className="text-sm text-[#BD5A4A]">{error}</p>
          <button type="button" onClick={() => setError(null)} className="text-xs mt-1 underline text-[#BD5A4A]">
            fechar
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="rounded-2xl bg-white border p-4 shadow-[0_8px_22px_-12px_rgba(31,42,40,0.35)]"
          style={{ borderColor: SOFT_BORDER }}>
          <div className="flex items-center gap-3">
            <img src={mascoteImage} alt="Mascote" className="w-10 h-10 animate-mascote-pulse" />
            <p className="text-sm" style={{ color: 'var(--amb-text)' }}>{LOADING_FRASES[activePhraseIndex]}</p>
          </div>
        </div>
      )}

      {/* Relatório gerado */}
      {!loading && report && <ExpressReportView report={report} />}
    </div>
  );
}

// ── Render do relatório Express ────────────────────────────────────────────
function ExpressReportView({ report }) {
  if (!report) return null;
  const alertas = Array.isArray(report.sinais_alerta) ? report.sinais_alerta : [];
  const perguntas = Array.isArray(report.perguntas_medico) ? report.perguntas_medico.map(normalizePergunta) : [];
  const resumo = typeof report.resumo_executivo === 'string' ? report.resumo_executivo : '';

  return (
    <div className="space-y-3">
      {/* Sinais de Alerta */}
      {alertas.length > 0 && (
        <div className="rounded-2xl border p-4 shadow-[0_8px_22px_-12px_rgba(31,42,40,0.35)]"
          style={{ borderColor: 'rgba(189,90,74,0.3)', background: '#FDF8F6' }}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} style={{ color: '#BD5A4A' }} />
            <p className="text-sm font-semibold text-[#BD5A4A]">Sinais de Alerta</p>
          </div>
          <div className="space-y-2">
            {alertas.map((s, i) => (
              <div key={i} className="border rounded-xl p-2.5"
                style={{ borderColor: 'rgba(189,90,74,0.25)', background: '#FFFFFF' }}>
                <p className="text-sm font-medium text-[#2B2A28]">{s.titulo}</p>
                {s.descricao && <p className="text-xs mt-1" style={{ color: '#7D766A' }}>{s.descricao}</p>}
                {s.data && <p className="text-[11px] mt-1 text-[#9A938A]">{s.data}</p>}
              </div>
            ))}
          </div>
          <p className="text-[11px] mt-2 leading-snug" style={{ color: '#BD5A4A' }}>
            Estes pontos são apenas alertas para uma conversa cuidadosa com seu médico. Não substituem avaliação profissional.
          </p>
        </div>
      )}

      {/* Resumo Executivo */}
      {resumo && (
        <div className="rounded-2xl bg-white border p-4 shadow-[0_8px_22px_-12px_rgba(31,42,40,0.35)]"
          style={{ borderColor: SOFT_BORDER }}>
          <div className="flex items-center gap-2 mb-2">
            <Stethoscope size={16} style={{ color: 'var(--brand)' }} />
            <p className="text-sm font-semibold uppercase tracking-wide text-[#B6AE9F]">Resumo Executivo</p>
          </div>
          <div className="text-sm leading-snug space-y-2" style={{ color: 'var(--ink, #4A443F)' }}>
            {resumo.split(/\n\n+/).map((p, i) => <p key={i}>{p}</p>)}
          </div>
        </div>
      )}

      {/* Perguntas para o Médico */}
      {perguntas.length > 0 && (
        <div className="rounded-2xl bg-white border p-4 shadow-[0_8px_22px_-12px_rgba(31,42,40,0.35)]"
          style={{ borderColor: SOFT_BORDER }}>
          <div className="flex items-center gap-2 mb-2">
            <RotateCcw size={16} style={{ color: 'var(--brand)' }} />
            <p className="text-sm font-semibold uppercase tracking-wide text-[#B6AE9F]">Perguntas para o Médico</p>
          </div>
          <ol className="space-y-2">
            {perguntas.map((p, i) => (
              <li key={i} className="text-sm">
                <div className="flex gap-2">
                  <span className="shrink-0 font-semibold" style={{ color: 'var(--brand)' }}>{i + 1}.</span>
                  <div>
                    <p className="leading-snug" style={{ color: 'var(--ink, #4A443F)' }}>{p.pergunta}</p>
                    {p.motivo && <p className="text-xs mt-0.5 leading-snug" style={{ color: '#9A938A' }}>{p.motivo}</p>}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Footer */}
      <p className="text-[11px] leading-snug" style={{ color: '#9A938A' }}>
        Relatório gerado a partir do seu relato em texto livre. Aprimore com o tempo — você pode completar o relato acima e regenerar.
      </p>
    </div>
  );
}