import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  AlertTriangle, Sparkles, Stethoscope, ChevronDown, RotateCcw, Mic, Download, Share2, X, Map, FileText,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import Silhouette from './Silhouette.jsx';
import { extractReportFromRaw, normalizePergunta, LOADING_FRASES } from '../lib/ai-report.js';
import { loadExpressDraft, saveExpressDraft, clearExpressDraft, saveExpressReport } from '../lib/express.js';
import { proximaConsulta } from '../lib/consulta.js';
import { loadProfile, CONDICOES_LABELS } from '../lib/profile.js';
import mascoteImage from '../assets/mascote.png';
import digestiveImage from '../assets/sisdiges.jpg';

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

const KIND_OPTIONS = ['Cólica', 'Queimação', 'Pressão', 'Pontada', 'Distensão'];
const PAIN_COLOR = '#BD5A4A';
const SOFT_BORDER = 'rgba(150,140,120,0.25)';

//Texto do pop-up introdutório do Express (Opção A — Direta e prática).
const INTRO_TEXT = [
  'Use esta opção **preferencialmente quando você não tem registros diários** no Diário e precisa gerar um relatório rápido para uma consulta nos próximos dias.',
  'Em texto livre, narre o que está sentindo: desde quando começou, o que piora ou alivia, sintomas associados. Você pode voltar e completar conforme lembranças surgirem — não precisa fazer tudo de uma vez.',
  'O relatório organiza seu relato em pontos claros para a conversa com o médico.',
];

export default function RelatorioExpressScreen() {
  // ── Pop-up introdutório (mostra só na primeira visita da sessão) ─────────
  const [showIntro, setShowIntro] = useState(() => {
    try {
      return sessionStorage.getItem('tlgut_express_intro_seen') !== '1';
    } catch { return true; }
  });
  const fecharIntro = useCallback(() => {
    try { sessionStorage.setItem('tlgut_express_intro_seen', '1'); } catch {}
    setShowIntro(false);
  }, []);

  // ── Estado do draft (auto-save) ──────────────────────────────────────────
  const draftInicial = useMemo(() => loadExpressDraft(), []);
  const [narrative, setNarrative] = useState(draftInicial.narrative);
  const [clouds, setClouds] = useState(draftInicial.pain_map.clouds);
  const [intensity, setIntensity] = useState(
    Number.isFinite(draftInicial.pain_map.intensity) ? draftInicial.pain_map.intensity : 5
  );
  const [kinds, setKinds] = useState(() => {
    const k = draftInicial.pain_map?.kinds;
    return Array.isArray(k) ? new Set(k) : new Set();
  });
  const [painOpen, setPainOpen] = useState(false);
  const [showOrgans, setShowOrgans] = useState(false); // inicia sem órgãos
  const txRef = useRef(null);

  // Debounce auto-save (800ms)
  useEffect(() => {
    const t = setTimeout(() => {
      saveExpressDraft({
        narrative,
        pain_map: { clouds, intensity, kinds: Array.from(kinds) },
      });
    }, 800);
    return () => clearTimeout(t);
  }, [narrative, clouds, intensity, kinds]);

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

  // ── Microfone (lógica inline replicada de ObservationStep) ──────────────
  const [recState, setRecState] = useState('idle'); // 'idle' | 'recording' | 'transcribing' | 'error'
  const [recError, setRecError] = useState('');
  const [timeLeft, setTimeLeft] = useState(30);
  const MAX_REC_SECONDS = 30;
  const mediaRecRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const shouldRecordRef = useRef(false);

  const WebSpeech = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;
  const hasMicApi = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  const micSupported = hasMicApi || !!WebSpeech;

  // Cleanup ao desmontar
  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
  }, []);

  const stopRecording = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setTimeLeft(MAX_REC_SECONDS);
    if (mediaRecRef.current && mediaRecRef.current.state !== 'inactive') {
      try { mediaRecRef.current.stop(); } catch {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const transcribeBlob = useCallback(async (blob) => {
    setRecState('transcribing');
    setRecError('');
    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': blob.type || 'audio/webm' },
        body: blob,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const { text } = await res.json();
      if (text) {
        setNarrative((prev) => (prev ? `${prev} ${text}` : text));
      }
      setRecState('idle');
    } catch (err) {
      console.error('[Express] Whisper error:', err);
      const msg = err.message || '';
      if (/fetch|NetworkError|Failed to fetch|HTTP 5/.test(msg)) {
        setRecError('Sem conexão com o servidor. Escreva manualmente por gentileza.');
      } else {
        setRecError('Não foi possível transcrever. Tente digitar manualmente.');
      }
      setRecState('error');
    }
  }, []);

  const startRecording = useCallback(async () => {
    setRecError('');
    chunksRef.current = [];
    setTimeLeft(MAX_REC_SECONDS);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!shouldRecordRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        setRecState('idle');
        return;
      }
      streamRef.current = stream;
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
        .find((m) => MediaRecorder.isTypeSupported(m)) || '';
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecRef.current = rec;
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        if (blob.size > 0) transcribeBlob(blob);
        else setRecState('idle');
      };
      rec.start();
      setRecState('recording');
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) { stopRecording(); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      console.error('[Express] Microfone negado:', err);
      setRecError('Permissão de microfone negada. Verifique as configurações do navegador.');
      setRecState('error');
    }
  }, [transcribeBlob, stopRecording]);

  const handleMicDown = useCallback((e) => {
    if (recState !== 'idle' || !hasMicApi) return;
    e.preventDefault();
    shouldRecordRef.current = true;
    startRecording();
  }, [recState, hasMicApi, startRecording]);

  const handleMicUp = useCallback((e) => {
    shouldRecordRef.current = false;
    if (recState !== 'recording') return;
    e.preventDefault();
    stopRecording();
  }, [recState, stopRecording]);

  // ── Tap handler para silhueta ───────────────────────────────────────────
  const handleTap = useCallback(({ x, y, organ }) => {
    setClouds((prev) => {
      const idx = prev.findIndex((c) => Math.abs(c.x - x) < 3 && Math.abs(c.y - y) < 3);
      if (idx !== -1) return prev.filter((_, i) => i !== idx);
      return [...prev, { x, y, organ: organ.id, organLabel: organ.label }];
    });
  }, []);

  const toggleKind = (k) => setKinds((s) => {
    const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n;
  });

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

  // ── Gerar relatório Express ──────────────────────────────────────────────
  const consulta = useMemo(() => proximaConsulta(), []);

  const gerarExpress = useCallback(async (e) => {
    if (e && e.preventDefault) e.preventDefault();
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
      pain_map: clouds.length > 0 ? { clouds, intensity, kinds: Array.from(kinds) } : null,
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
  }, [loading, narrative, clouds, intensity, kinds, regenerations, consulta]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Pop-up introdutório (overlay) */}
      {showIntro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5"
          style={{ background: 'rgba(43,42,40,0.55)' }}>
          <div className="relative w-full max-w-[340px] rounded-3xl bg-white p-5 shadow-2xl">
            <button type="button" onClick={fecharIntro} aria-label="Fechar"
              className="absolute right-3 top-3 w-8 h-8 rounded-full flex items-center justify-center text-[#9A938A]">
              <X size={18} />
            </button>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={20} style={{ color: 'var(--brand)' }} />
              <p className="titulo-cursivo text-xl font-serif" style={{ color: 'var(--amb-text)' }}>
                Relatório Express
              </p>
            </div>
            <div className="space-y-2.5 text-sm leading-snug" style={{ color: '#4A443F' }}>
              {INTRO_TEXT.map((t, i) => (
                <p key={i} dangerouslySetInnerHTML={{ __html: t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
              ))}
            </div>
            <button type="button" onClick={fecharIntro}
              className="mt-4 w-full py-3 rounded-2xl text-white font-semibold text-sm"
              style={{ background: 'var(--brand)' }}>
              Entendi
            </button>
          </div>
        </div>
      )}

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
          Narre em texto livre o que está sentindo, desde quando começou, o que piora ou alivia. Você pode voltar e completar conforme lembranças surgirem.
        </p>
      </div>

      {/* Textarea grande + microfone */}
      <div className="rounded-2xl bg-white border shadow-[0_8px_22px_-12px_rgba(31,42,40,0.35)] p-4"
        style={{ borderColor: SOFT_BORDER }}>
        <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#2B2A28' }}>O que você está sentindo</p>

        {/* Overlays de gravação/transcrição/erro */}
        {recState === 'recording' && (
          <div className="rounded-xl border border-[#D8D1C4] p-5 flex flex-col items-center gap-3 mb-2"
            style={{ background: 'rgba(47,107,67,0.04)' }}>
            <img src={mascoteImage} alt="" className="w-16 h-16 object-contain animate-mascote-pulse" />
            <p className="text-sm font-medium text-[#2B2A28] animate-breathing">
              Estou te escutando
              <span className="dots-anim"><span>.</span><span>.</span><span>.</span></span>
            </p>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#E53935] animate-pulse" />
              <span className="text-xs font-medium text-[#E53935]">{timeLeft}s</span>
            </div>
            <div className="flex items-end gap-1 h-8">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="w-1.5 rounded-full animate-wave-bar"
                  style={{ height: `${35 + i * 15}%`, background: 'var(--brand)', animationDelay: `${i * 0.12}s` }} />
              ))}
            </div>
            <p className="text-xs text-[#B6AE9F]">Solte para enviar</p>
          </div>
        )}
        {recState === 'transcribing' && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-2"
            style={{ background: 'rgba(242,194,0,0.10)', border: '1px solid rgba(242,194,0,0.3)' }}>
            <div className="w-4 h-4 border-2 border-[#9A7A00] border-t-transparent rounded-full animate-spinner" />
            <span className="text-xs font-medium text-[#9A7A00]">Transcrevendo com Whisper AI…</span>
          </div>
        )}
        {recState === 'error' && recError && (
          <div className="px-3 py-2 rounded-xl text-xs mb-2"
            style={{ background: 'rgba(189,90,74,0.08)', border: '1px solid rgba(189,90,74,0.25)', color: '#BD5A4A' }}>
            {recError}
          </div>
        )}

        <div className="relative">
          <textarea
            ref={txRef}
            value={narrative}
            onChange={(e) => setNarrative(e.target.value)}
            disabled={recState === 'transcribing' || recState === 'recording'}
            placeholder="Ex: há uns 15 dias comecei a sentir cólica logo após a refeição, principalmente depois do almoço. A dor dura de 30 min a 1h e passa levemente se me deito. Não tenho registrado no diário, então lembrando do que eu posso agora…"
            className="w-full min-h-[160px] p-3 pr-12 rounded-xl text-sm border resize-y focus:outline-none disabled:opacity-60"
            style={{ background: '#FBF9F4', borderColor: 'rgba(150,140,120,0.25)', color: '#2B2A28', lineHeight: 1.5 }}
          />
          {hasMicApi ? (
            <button
              type="button"
              onPointerDown={handleMicDown}
              onPointerUp={handleMicUp}
              disabled={recState === 'transcribing'}
              aria-label="Pressione e segure para gravar"
              title={recState === 'recording' ? 'Solte para enviar' : 'Pressione e segure para gravar'}
              className={`absolute right-2 bottom-2 w-9 h-9 rounded-full flex items-center justify-center transition-colors disabled:opacity-40 active:scale-95 select-none ${recState === 'idle' ? 'animate-mic-pulse' : ''}`}
              style={
                recState === 'recording'
                  ? { background: '#E53935', color: '#fff' }
                  : { background: 'var(--brand-soft)', color: 'var(--brand)' }
              }
            >
              <Mic size={18} />
            </button>
          ) : (
            <button
              type="button"
              disabled={!micSupported || recState === 'transcribing'}
              aria-label="Ditar por voz"
              title={micSupported ? 'Ditar por voz' : 'Microfone não disponível neste navegador'}
              className="absolute right-2 bottom-2 w-9 h-9 rounded-full flex items-center justify-center transition-colors disabled:opacity-40"
              style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}
            >
              <Mic size={18} />
            </button>
          )}
        </div>

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
          {micSupported && recState === 'idle' && ' 🎙 Pressione e segure o microfone para gravar.'}
        </p>
      </div>

      {/* Silhueta opcional (retrátil) */}
      <div className="rounded-2xl bg-white border shadow-[0_8px_22px_-12px_rgba(31,42,40,0.35)] p-4"
        style={{ borderColor: SOFT_BORDER }}>
        <button type="button" onClick={() => setPainOpen(!painOpen)}
          className="w-full flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles size={16} style={{ color: PAIN_COLOR }} />
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#2B2A28' }}>Marcar onde dói (opcional)</p>
            {clouds.length > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(189,90,74,0.1)', color: PAIN_COLOR }}>
                {clouds.length} {clouds.length === 1 ? 'marca' : 'marcas'}
              </span>
            )}
          </div>
          <ChevronDown size={16} className={`transition-transform duration-200 ${painOpen ? 'rotate-180' : ''}`}
            style={{ color: '#B6AE9F' }} />
        </button>
        {painOpen && (
          <div className="mt-4 space-y-3">
            {/* Silhueta */}
            <div className="bg-[#FAF7F2] rounded-2xl p-3 border border-[#EDE7DD]">
              <Silhouette clouds={clouds} intensity={intensity} onTap={handleTap} showOrgans={showOrgans} />
            </div>
            <button type="button" onClick={() => setShowOrgans(!showOrgans)}
              className="w-full py-2 px-4 rounded-xl border text-xs font-semibold bg-white active:scale-95 transition-transform flex items-center justify-center gap-1.5 shadow-sm"
              style={{ color: showOrgans ? PAIN_COLOR : 'var(--brand)', borderColor: showOrgans ? '#F5E1DD' : '#EDE7DD' }}>
              {showOrgans ? 'Ocultar possíveis órgãos' : 'Possíveis órgãos afetados'}
            </button>

            {/* Intensidade (abaixo da silhueta, como no PainForm) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#2B2A28' }}>Intensidade</p>
                <span className="text-sm font-semibold" style={{ color: PAIN_COLOR }}>{intensity}/10</span>
              </div>
              <input type="range" min={1} max={10} value={intensity}
                onChange={(e) => setIntensity(Number(e.target.value))}
                className="w-full" style={{ accentColor: PAIN_COLOR }} />
            </div>

            {/* Como é a dor? */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#2B2A28' }}>Como é a dor?</p>
              <div className="flex flex-wrap gap-2">
                {KIND_OPTIONS.map((k) => (
                  <button key={k} type="button" onClick={() => toggleKind(k)}
                    className="px-3 py-1.5 rounded-full text-sm border transition-colors"
                    style={kinds.has(k)
                      ? { background: PAIN_COLOR, borderColor: PAIN_COLOR, color: '#fff' }
                      : { borderColor: '#EDE7DD', color: '#7D766A' }}>
                    {k}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-[11px] leading-snug text-center" style={{ color: '#9A938A' }}>
              Toque para marcar a dor, toque novamente para remover. A intensidade aplica-se a todas as marcas.
            </p>
          </div>
        )}
      </div>

      {/* Ação: Gerar */}
      <button type="button" onClick={gerarExpress} disabled={loading}
        className="w-full py-3 rounded-2xl text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        style={{ background: 'var(--brand)' }}>
        <Sparkles size={16} />
        {loading ? 'Gerando…' : (regenerations > 0 ? 'Regenerar relatório' : 'Gerar relatório Express')}
      </button>
      <p className="text-[11px] leading-snug text-center" style={{ color: '#9A938A' }}>
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
      {!loading && report && <ExpressReportView report={report} clouds={clouds} intensity={intensity} kinds={kinds} />}
    </div>
  );
}

// ── Render do relatório Express ────────────────────────────────────────────
function ExpressReportView({ report, clouds = [], intensity, kinds }) {
  if (!report) return null;
  const isRaw = report.isRaw === true;
  const isTruncated = report.truncated === true;
  const canPDF = !isRaw && !isTruncated && report.resumo_executivo;
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
            <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: '#5D5FA0' }}>Resumo Executivo</p>
          </div>
          <div className="text-sm leading-snug space-y-2" style={{ color: 'var(--ink, #4A443F)' }}>
            {resumo.split(/\n\n+/).map((p, i) => <p key={i}>{p}</p>)}
          </div>
        </div>
      )}

      {/* Onde a dor aparece */}
      {clouds && clouds.length > 0 && (
        <div className="rounded-2xl bg-white border p-4 shadow-[0_8px_22px_-12px_rgba(31,42,40,0.35)]"
          style={{ borderColor: SOFT_BORDER }}>
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
              {clouds.map((c, i) => (
                <span key={i} aria-label={c.organLabel || 'Dor'}
                  className="absolute rounded-full"
                  style={{
                    left: `${c.x}%`, top: `${c.y}%`, width: 14, height: 14, transform: 'translate(-50%,-50%)',
                    background: 'rgba(189,90,74,0.5)',
                    border: '2px solid rgba(255,255,255,0.7)',
                    pointerEvents: 'none',
                  }} />
              ))}
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              {clouds.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-[#4A443F]">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: 'rgba(189,90,74,0.5)' }} />
                  <span className="font-medium text-[#2B2A28] shrink-0">{c.organLabel || c.organ || 'Região marcada'}</span>
                </div>
              ))}
              {intensity != null && (
                <p className="text-xs text-[#7D766A] mt-1">Intensidade relatada: {intensity}/10</p>
              )}
              {kinds && kinds.size > 0 && (
                <p className="text-xs text-[#7D766A]">Tipo de dor: {Array.from(kinds).join(', ')}</p>
              )}
            </div>
          </div>
          <p className="text-[11px] text-[#9A938A] mt-3 leading-relaxed italic">
            <strong>Atenção:</strong> Os pontos na silhueta indicam a região onde você relatou dor, não o órgão doente. Vários órgãos se sobrepõem na imagem (estômago, fígado, intestino delgado, cólon). A localização marcada não estabelece diagnóstico — apenas registra o relato. A interpretação clínica é exclusiva do médico.
          </p>
        </div>
      )}

      {/* Perguntas para o Médico */}
      {perguntas.length > 0 && (
        <div className="rounded-2xl bg-white border p-4 shadow-[0_8px_22px_-12px_rgba(31,42,40,0.35)]"
          style={{ borderColor: SOFT_BORDER }}>
          <div className="flex items-center gap-2 mb-2">
            <RotateCcw size={16} style={{ color: 'var(--brand)' }} />
            <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: '#4A8A5C' }}>Perguntas para o Médico</p>
          </div>
          <ol className="space-y-2">
            {perguntas.map((p, i) => (
              <li key={i} className="text-sm">
                <div className="flex gap-2">
                  <span className="shrink-0 font-semibold" style={{ color: 'var(--brand)' }}>{i + 1}.</span>
                  <div>
                    <p className="leading-snug" style={{ color: 'var(--ink, #4A443F)' }}>{p.pergunta}</p>
                    {p.motivo && <p className="text-xs mt-0.5 leading-snug" style={{ color: '#9A938A' }}>{p.motivo}</p>}
                    {p.mecanismo_fisiologico && (
                      <p className="text-xs mt-1 leading-snug italic" style={{ color: '#5D5FA0' }}>
                        <span className="font-semibold not-italic">Mecanismo:</span> {p.mecanismo_fisiologico}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Botões PDF */}
      {canPDF && (
        <div className="rounded-2xl bg-white border p-4 shadow-[0_8px_22px_-12px_rgba(31,42,40,0.35)]"
          style={{ borderColor: SOFT_BORDER }}>
          <div className="flex gap-2.5">
            <button type="button" onClick={() => baixarPDFExpress(report)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
              style={{ background: 'rgba(93,95,160,0.08)', color: '#5D5FA0', border: '1px solid rgba(93,95,160,0.2)' }}>
              <Download size={16} />
              Baixar PDF
            </button>
            <button type="button" onClick={() => compartilharPDFExpress(report)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
              style={{ background: 'rgba(93,95,160,0.08)', color: '#5D5FA0', border: '1px solid rgba(93,95,160,0.2)' }}>
              <Share2 size={16} />
              Compartilhar
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <p className="text-[11px] leading-snug" style={{ color: '#9A938A' }}>
        Relatório gerado a partir do seu relato em texto livre. Aprimore com o tempo — você pode completar o relato acima e regenerar.
      </p>
    </div>
  );
}

// ── PDF Express (próprio, simplificado, sem silhouette) ─────────────────────
function gerarPDFExpress(report) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const maxW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (need) => {
    if (y + need > pageH - margin) { doc.addPage(); y = margin; }
  };
  const heading = (text, color = '#2B2A28') => {
    ensureSpace(28);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(color);
    doc.text(text, margin, y + 14);
    y += 22;
    doc.setDrawColor(color);
    doc.setLineWidth(1);
    doc.line(margin, y - 4, margin + 24, y - 4);
    y += 6;
  };
  const paragraph = (text, fontColor = '#4A443F') => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(fontColor);
    const lines = doc.splitTextToSize(text, maxW);
    for (const ln of lines) {
      ensureSpace(16);
      doc.text(ln, margin, y + 11);
      y += 16;
    }
  };
  const microLine = (text) => {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor('#7D766A');
    const lines = doc.splitTextToSize(text, maxW);
    for (const ln of lines) {
      ensureSpace(14);
      doc.text(ln, margin, y + 11);
      y += 14;
    }
    doc.setFont('helvetica', 'normal');
  };
  const spacer = (h = 12) => { y += h; };

  // Cabeçalho enriquecido
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor('#2B2A28');
  doc.text('Smart Gut · Relatório Express', margin, y + 18);
  y += 24;

  const pr = (typeof loadProfile === 'function') ? loadProfile() : {};
  const nomeProf = pr && pr.nome ? String(pr.nome).trim() : '';
  const bio = [];
  if (pr && pr.idade) bio.push(`${pr.idade} anos`);
  if (pr && pr.peso)  bio.push(`${pr.peso} kg`);
  if (pr && pr.altura) bio.push(`${pr.altura} cm`);
  const condArr = Array.isArray(pr && pr.condicoes) ? pr.condicoes.map(c => CONDICOES_LABELS[c] || c).filter(Boolean) : [];
  if (pr && pr.outros) condArr.push(pr.outros);

  microLine(`Paciente: ${nomeProf || '—'}${bio.length ? '  ·  ' + bio.join(' · ') : ''}${condArr.length ? '  ·  Condições: ' + condArr.join(', ') : ''}`);
  microLine(`Gerado em ${new Date().toLocaleString('pt-BR')}`);

  spacer(4);
  doc.setDrawColor(200, 195, 185);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 16;

  // Sinais de Alerta
  const alertas = Array.isArray(report.sinais_alerta) ? report.sinais_alerta : [];
  if (alertas.length > 0) {
    heading('Sinais de Alerta', '#BD5A4A');
    alertas.forEach((s) => {
      paragraph(s.titulo || '', '#2B2A28');
      if (s.descricao) microLine(s.descricao);
      if (s.data) microLine(`Data: ${s.data}`);
      spacer(6);
    });
    microLine('Estes pontos são alertas para uma conversa cuidadosa com seu médico. Não substituem avaliação profissional.');
    spacer(8);
  }

  // Resumo Executivo
  const resumo = typeof report.resumo_executivo === 'string' ? report.resumo_executivo : '';
  if (resumo) {
    heading('Resumo Executivo');
    const paragrafos = resumo.split(/\n\n+/);
    paragrafos.forEach((p) => { paragraph(p); spacer(4); });
    spacer(8);
  }

  // Perguntas para o Médico
  const perguntas = Array.isArray(report.perguntas_medico)
    ? report.perguntas_medico.map(normalizePergunta)
    : [];
  if (perguntas.length > 0) {
    heading('Perguntas para o Médico');
    perguntas.forEach((p, i) => {
      ensureSpace(28);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor('#5E8A4E');
      doc.text(`${i + 1}.`, margin, y + 11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor('#2B2A28');
      const pLines = doc.splitTextToSize(p.pergunta, maxW - 16);
      pLines.forEach((ln, idx) => {
        ensureSpace(16);
        doc.text(ln, margin + 16, y + 11);
        y += 16;
      });
      if (p.motivo) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(10);
        doc.setTextColor('#7D766A');
        const mLines = doc.splitTextToSize(p.motivo, maxW - 16);
        mLines.forEach((ln) => {
          ensureSpace(14);
          doc.text(ln, margin + 16, y + 11);
          y += 14;
        });
      }
      if (p.mecanismo_fisiologico) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(10);
        doc.setTextColor('#5D5FA0');
        const mekLabel = 'Mecanismo: ';
        const mekText = p.mecanismo_fisiologico;
        const mekLines = doc.splitTextToSize(mekLabel + mekText, maxW - 16);
        mekLines.forEach((ln, idx) => {
          ensureSpace(14);
          if (idx === 0) {
            doc.setFont('helvetica', 'bolditalic');
            doc.text('Mecanismo: ', margin + 16, y + 11);
            const labelW = doc.getTextWidth('Mecanismo: ');
            doc.setFont('helvetica', 'italic');
            const rest = ln.slice('Mecanismo: '.length);
            doc.text(rest, margin + 16 + labelW, y + 11);
          } else {
            doc.setFont('helvetica', 'italic');
            doc.text(ln, margin + 16, y + 11);
          }
          y += 14;
        });
      }
      spacer(6);
    });
  }

  // Rodapé
  spacer(16);
  microLine('Relatório gerado a partir do relato em texto livre do paciente (modalidade Express). Não substitui avaliação profissional.');

  return doc;
}

function montarNomeArquivoPDFExpress() {
  const data = new Date();
  const stamp = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
  try {
    const pr = loadProfile();
    if (pr?.nome) {
      const safe = pr.nome.replace(/[^a-zA-Z0-9à-úÀ-Ú ]/g, '').trim().replace(/\s+/g, '_');
      if (safe) return `SmartGut_RelatorioExpress_${safe}_${stamp}.pdf`;
    }
  } catch {}
  return `SmartGut_RelatorioExpress_${stamp}.pdf`;
}

function baixarPDFExpress(report) {
  const doc = gerarPDFExpress(report);
  const nome = montarNomeArquivoPDFExpress();
  try { doc.save(nome); }
  catch { // Firefox fallback
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nome; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function isShareSupported() {
  if (typeof navigator === 'undefined') return false;
  if (!navigator.share || !navigator.canShare) return false;
  if (/Firefox|FxiOS/i.test(navigator.userAgent)) return false;
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return false;
  return true;
}

async function compartilharPDFExpress(report) {
  if (!isShareSupported()) { baixarPDFExpress(report); return; }
  try {
    const doc = gerarPDFExpress(report);
    const blob = doc.output('blob');
    const file = new File([blob], montarNomeArquivoPDFExpress(), { type: 'application/pdf' });
    if (!navigator.canShare({ files: [file] })) { baixarPDFExpress(report); return; }
    await navigator.share({
      files: [file],
      title: 'Relatório Express — Smart Gut',
      text: 'Meu relatório de preparação para consulta.',
    });
  } catch (err) {
    if (err && err.name !== 'AbortError') baixarPDFExpress(report);
  }
}