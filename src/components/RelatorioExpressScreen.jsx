import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  AlertTriangle, Sparkles, Stethoscope, ChevronDown, Mic, Download, Share2, X, Map, FileText, CheckCircle2,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import Silhouette from './Silhouette.jsx';
import { extractReportFromRaw } from '../lib/ai-report.js';
import { loadExpressDraft, saveExpressDraft, clearExpressDraft } from '../lib/express.js';
import { loadReports, saveReport, removeReport, migrarExpressLegado, MAX_REPORTS } from '../lib/reports.js';
import { proximaConsulta } from '../lib/consulta.js';
import { loadProfile, CONDICOES_LABELS } from '../lib/profile.js';
import { nearestRegion } from '../lib/organs.js';
import mascoteImage from '../assets/mascote.png';
import digestiveClosedImage from '../assets/sisdiges_fechado.jpg';
const digestiveImgEl = typeof Image !== 'undefined' ? new Image() : null;
if (digestiveImgEl) digestiveImgEl.src = digestiveClosedImage;

const EXPRESS_LOADING_FRASES = [
  'Analisando quando começou...',
  'Analisando frequência...',
  'Analisando com que piora...',
  'Verificando sintomas associados...',
  'Analisando qualidade das fezes...',
  'Analisando sono...',
  'Analisando alimentação...',
  'Verificando medicamentos...',
  'Analisando com que alivia...',
  'Organizando dúvidas para o médico...',
];

// Chips guiados: inserem fragmentos no textarea no cursor, para ajudar quem
// não sabe por onde começar a relatar.
const CHIPS_GUIADOS = [
  { label: 'Quando começou?',     snippet: '\n\nQuando começou: ' },
  { label: 'Frequência',           snippet: '\n\nFrequência: ' },
  { label: 'Piora com quê?',       snippet: '\n\nPiora com: ' },
  { label: 'Alívio com quê?',      snippet: '\n\nAlívio com: ' },
  { label: 'Sintomas associados',  snippet: '\n\nSintomas associados: ' },
  { label: 'Qualidade das fezes',  snippet: '\n\nQualidade das fezes: ' },
  { label: 'Como é seu sono',      snippet: '\n\nComo é seu sono: ' },
  { label: 'O que costuma comer',  snippet: '\n\nO que costuma comer: ' },
  { label: 'Usa algum medicamento?', snippet: '\n\nUsa algum medicamento: ' },
  { label: 'Exames anteriores',    snippet: '\n\nExames/anteriores: ' },
  { label: 'Dúvidas para o médico', snippet: '\n\nDúvidas para o médico: ' },
];

// Extrai dúvidas do paciente a partir de marcadores no texto livre do Express.
// Cada ocorrência de "Dúvidas para o médico:" captura o texto até o próximo \n\n
// ou fim do texto. Os trechos são limpos (trim) e vazios são descartados.
function extrairDuvidasDoRelato(texto) {
  if (!texto) return [];
  const regex = /Dúvidas?\s*(para\s*o?\s*médico)?\s*[:—–-]\s*([\s\S]*?)(?=\n\n\w|$)/gi;
  const results = [];
  let match;
  while ((match = regex.exec(texto)) !== null) {
    const duvida = match[2].trim();
    if (duvida && duvida.length > 0) results.push(duvida);
  }
  return results;
}

// cloudRegionId: resolve o id da região de uma cloud.
function cloudRegionId(c) {
  if (!c) return null;
  if (c.region) return c.region;
  if (c.organ) return c.organ;
  if (c.x != null && c.y != null) {
    const r = nearestRegion(c.x, c.y);
    if (r && r.id) return r.id;
  }
  return null;
}

// cloudLabel: resolve o rótulo da região de uma cloud (nova, legada ou sem label).
// Prioriza labels salvos; se não houver, resolve via nearestRegion(x, y).
function cloudLabel(c) {
  if (!c) return 'Região marcada';
  if (c.regionLabel) return c.regionLabel;
  if (c.organLabel) return c.organLabel;
  if (c.x != null && c.y != null) {
    const r = nearestRegion(c.x, c.y);
    if (r && r.label) return r.label;
  }
  return 'Região marcada';
}

// uniqueRegions: retorna lista de regiões únicas (por id) com seus labels.
// Evita repetir "Região superior central" quando há múltiplos pontos na mesma região.
function uniqueRegions(clouds) {
  if (!Array.isArray(clouds)) return [];
  const seen = new Set();
  const result = [];
  clouds.forEach((c) => {
    const id = cloudRegionId(c);
    const label = cloudLabel(c);
    const key = id || label;
    if (!seen.has(key)) {
      seen.add(key);
      result.push({ id, label });
    }
  });
  return result;
}

const KIND_OPTIONS = ['Cólica', 'Queimação', 'Pressão', 'Pontada', 'Distensão'];
const PAIN_COLOR = '#BD5A4A';
const SOFT_BORDER = 'rgba(150,140,120,0.25)';

//Texto do pop-up introdutório do Express (Opção A — Direta e prática).
const INTRO_TEXT = [
  'Use esta opção **preferencialmente quando você não tem registros diários** no Diário e precisa gerar um relatório rápido para uma consulta nos próximos dias.',
  'Em texto livre, narre o que está sentindo: desde quando começou, o que piora ou alivia, sintomas associados. Você pode voltar e completar conforme lembranças surgirem — não precisa fazer tudo de uma vez.',
  'O relatório organiza seu relato em pontos claros para a conversa com o médico.',
];

export default function RelatorioExpressScreen({ entries }) {
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
    setSavedReports(loadReports('express'));
  }, []);

  function loadSavedReport(r) {
    setReport(r.report);
    setShowSavedReports(false);
    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }, 100);
  }

  function handleRemoveReport(id) {
    removeReport(id);
    setSavedReports(prev => prev.filter(r => r.id !== id));
  }

  useEffect(() => {
    if (!loading) return;
    setActivePhraseIndex(0);
    const interval = setInterval(() => {
      setActivePhraseIndex(prev => (prev + 1) % EXPRESS_LOADING_FRASES.length);
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
  const handleTap = useCallback(({ x, y, region }) => {
    setClouds((prev) => {
      const idx = prev.findIndex((c) => Math.abs(c.x - x) < 3 && Math.abs(c.y - y) < 3);
      if (idx !== -1) return prev.filter((_, i) => i !== idx);
      return [...prev, { x, y, region: region ? region.id : null, regionLabel: region ? region.label : null }];
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
    const duvidasExtraidas = extrairDuvidasDoRelato(narrative);
    if (duvidasExtraidas.length > 0) body.duvidas = duvidasExtraidas;
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
        rel = extractReportFromRaw(rel) || { resumo_executivo: rel, associacoes: [] };
      } else if (typeof rel === 'string') {
        const parsed = extractReportFromRaw(rel) || { resumo_executivo: rel, associacoes: [] };
        rel = parsed;
      }
      const discutirEntriesFromExpress = duvidasExtraidas.map((d, idx) => ({
        id: `express_duvida_${idx}_${Date.now()}`,
        title: 'Dúvida ou observação',
        description: d,
        meta: { prioridade: 3, discutir_consulta: true }
      }));
      const relWithSnapshot = {
        ...rel,
        _discutirEntries: discutirEntriesFromExpress,
        _painMap: clouds.length > 0 ? { clouds, intensity, kinds: Array.from(kinds) } : null,
      };
      setReport(relWithSnapshot);
      const { saved } = saveReport({ type: 'express', report: relWithSnapshot });
      if (saved) {
        setSavedReports(prev => [saved, ...prev].slice(0, MAX_REPORTS));
        const count = loadReports('express').length;
        if (count >= MAX_REPORTS) setToast('Relatório mais antigo substituído (limite de 10)');
      } else {
        setToast('Relatório não salvo (conteúdo inválido)');
      }
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
              <p className="titulo-cursivo text-xl font-sans" style={{ color: 'var(--amb-text)' }}>
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
          <p className="titulo-cursivo text-xl font-sans" style={{ color: 'var(--amb-text)' }}>
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
            <span className="text-xs font-medium text-[#9A7A00]">Transcrevendo…</span>
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
        <p className="text-[11px] mt-1.5 leading-snug" style={{ color: '#9A938A' }}>
          Você pode usar o mesmo rótulo várias vezes para adicionar mais detalhes ao longo do tempo.
        </p>
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
              <Silhouette clouds={clouds} intensity={intensity} onTap={handleTap} />
            </div>
            {clouds.length > 0 && (
              <button type="button" onClick={() => setClouds([])}
                className="w-full py-2 px-4 rounded-xl border text-xs font-semibold bg-white active:scale-95 transition-transform flex items-center justify-center gap-1.5 shadow-sm"
                style={{ color: PAIN_COLOR, borderColor: '#F5E1DD' }}>
                Limpar marcações
              </button>
            )}

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

      {/* Saved reports */}
      {savedReports.length > 0 && (
        <div className="rounded-2xl bg-white border p-4 shadow-[0_8px_22px_-12px_rgba(31,42,40,0.35)]"
          style={{ borderColor: SOFT_BORDER }}>
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
                    <p className="text-sm text-[#2B2A28] line-clamp-2 mt-0.5">
                      {r.resumo_preview || 'Relatório Express'}
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
        <div className="day-summary-mesh relative z-10 rounded-2xl border border-[#EDE7DD] p-6 overflow-hidden shadow-[0_10px_24px_-10px_rgba(31,42,40,0.4)]">
          <div className="relative z-10 flex flex-col items-center justify-center py-2 gap-3">
            <img src={mascoteImage} alt="Mascote" className="w-16 h-16 animate-mascote-pulse" />
            <div className="relative h-8 w-full flex items-center justify-center overflow-hidden">
              <div key={activePhraseIndex} className="text-[15px] font-semibold text-[#4A8A5C] tg-phrase-cycle">
                {EXPRESS_LOADING_FRASES[activePhraseIndex]}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Relatório gerado */}
      {!loading && report && <ExpressReportView report={report} clouds={clouds} intensity={intensity} kinds={kinds} entries={entries} />}

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

// ── Render do relatório Express ────────────────────────────────────────────
function ExpressReportView({ report, clouds = [], intensity, kinds, entries }) {
  if (!report) return null;
  const isRaw = report.isRaw === true;
  const isTruncated = report.truncated === true;

  // Tentar recovery via extractReportFromRaw (mesmo padrão da tela IA)
  const recovered = (isRaw || isTruncated) && report.resumo_executivo
    ? (extractReportFromRaw(report.resumo_executivo) || report)
    : report;
  const stillTruncated = (recovered === report) && !!report?.truncated;
  const effectiveReport = stillTruncated ? null : recovered;

  // Usar snapshot de mapa de dor salvo com o relatório, se existir
  const pm = report._painMap;
  const effClouds = pm ? pm.clouds : clouds;
  const effIntensity = pm ? pm.intensity : intensity;
  const effKinds = pm ? (Array.isArray(pm.kinds) ? new Set(pm.kinds) : new Set()) : kinds;

  const canPDF = !isRaw && !isTruncated && effectiveReport && effectiveReport.resumo_executivo;
  const resumo = effectiveReport && typeof effectiveReport.resumo_executivo === 'string' ? effectiveReport.resumo_executivo : '';

  // ── Expansão de texto e exclusão de cards discutir ────────────────────
  const [expandSet, setExpandSet] = useState(() => new Set());
  const toggleExpand = (id) => setExpandSet(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const [excludedSet, setExcludedSet] = useState(() => new Set());
  const toggleExclude = (id) => setExcludedSet(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const discutirEntries = useMemo(() => {
    const source = Array.isArray(report._discutirEntries) ? report._discutirEntries : [];
    if (!Array.isArray(source)) return [];
    return source.filter(e => e.meta?.discutir_consulta);
  }, [report._discutirEntries]);

  // Relatório truncado sem recovery → mostrar aviso (como a tela IA)
  if (stillTruncated) {
    return (
      <div className="rounded-2xl border p-6 shadow-[0_8px_22px_-12px_rgba(31,42,40,0.35)] flex flex-col items-center text-center"
        style={{ borderColor: SOFT_BORDER, background: '#FDF8F6' }}>
        <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
          style={{ background: 'rgba(189,90,74,0.12)' }}>
          <AlertTriangle size={22} style={{ color: '#BD5A4A' }} />
        </div>
        <p className="text-sm text-[#4A443F] font-medium">O relatório ficou incompleto.</p>
        <p className="text-xs text-[#7D766A] mt-1">Tente regenerar em alguns instantes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
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
      {effClouds && effClouds.length > 0 && (
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
              <img src={digestiveClosedImage} alt="Mapa de dor no corpo"
                className="absolute inset-0 w-full h-full object-contain select-none" draggable={false} />
              {effClouds.map((c, i) => (
                <span key={i} aria-label={cloudLabel(c) || 'Dor'}
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
              {uniqueRegions(effClouds).map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-[#4A443F]">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: 'rgba(189,90,74,0.5)' }} />
                  <span className="font-medium text-[#2B2A28] shrink-0">{r.label}</span>
                </div>
              ))}
              {effIntensity != null && (
                <p className="text-xs text-[#7D766A] mt-1">Intensidade relatada: {effIntensity}/10</p>
              )}
              {effKinds && effKinds.size > 0 && (
                <p className="text-xs text-[#7D766A]">Tipo de dor: {Array.from(effKinds).join(', ')}</p>
              )}
            </div>
          </div>
          <p className="text-[11px] text-[#9A938A] mt-3 leading-relaxed italic">
            <strong>Nota:</strong> Os pontos na silhueta indicam a região corporal onde você relatou a sensação (lados, centro, parte superior e inferior do abdômen). A localização marcada não identifica o órgão de origem nem estabelece diagnóstico — apenas registra o relato. A interpretação clínica é exclusiva do médico.
          </p>
        </div>
      )}

      {/* Eventos selecionados para discutir na consulta */}
      {discutirEntries.length > 0 && (
        <div className="rounded-2xl bg-white border p-4 shadow-[0_8px_22px_-12px_rgba(31,42,40,0.35)]"
          style={{ borderColor: SOFT_BORDER }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(74,138,92,0.12)' }}>
              <CheckCircle2 size={15} style={{ color: '#4A8A5C' }} />
            </span>
            <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: '#4A8A5C' }}>Discutir na consulta</h4>
          </div>
          <div className="space-y-1.5">
            {discutirEntries.map((e) => {
              const expanded = expandSet.has(e.id);
              const excluded = excludedSet.has(e.id);
              const hasLong = (e.description?.length > 80) || (e.meta?.note?.length > 80);
              return (
                <div key={e.id} role="button" tabIndex={0}
                  onClick={() => toggleExpand(e.id)}
                  onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') toggleExpand(e.id); }}
                  className={`w-full rounded-xl p-3 flex items-start gap-3 text-left transition-all cursor-pointer ${excluded ? 'opacity-35 scale-[0.98]' : ''}`}
                  style={{
                    background: excluded ? 'rgba(180,175,165,0.06)' : 'rgba(74,138,92,0.04)',
                    border: excluded ? '1px solid rgba(180,175,165,0.3)' : '1px solid rgba(74,138,92,0.15)',
                  }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold text-[#2B2A28]">{e.title || e.type}</p>
                      <button type="button" onClick={(ev) => { ev.stopPropagation(); toggleExclude(e.id); }}
                        className="text-[10px] font-semibold whitespace-nowrap shrink-0 px-2 py-0.5 rounded transition-colors"
                        style={{
                          color: excluded ? '#4A8A5C' : '#B6AE9F',
                          border: '1px solid',
                          borderColor: excluded ? '#4A8A5C' : '#B6AE9F',
                        }}>
                        {excluded ? 'Incluir no PDF' : 'Excluir do PDF'}
                      </button>
                    </div>
                    {e.description && (
                      <p className={`text-[13px] font-medium text-[#7D766A] mt-0.5 leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>{e.description}</p>
                    )}
                    {e.meta?.note && (
                      <p className={`text-[13px] font-medium text-[#5B8C91] mt-0.5 italic leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>{e.meta.note}</p>
                    )}
                    {e.day && e.time && (
                      <p className="text-[11px] text-[#B6AE9F] mt-1">{e.day === 'hoje' ? 'Hoje' : 'Ontem'} às {e.time}</p>
                    )}
                    {hasLong && (
                      <span className="text-[11px] font-semibold mt-0.5 inline-block cursor-pointer transition-colors"
                        style={{ color: '#4A8A5C' }}>
                        {expanded ? 'Ver menos' : 'Ver mais'}
                      </span>
                    )}
                    {excluded && (
                      <p className="text-[10px] font-semibold uppercase tracking-wider mt-1"
                        style={{ color: '#B6AE9F' }}>Excluído do PDF</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Botões PDF */}
      {canPDF && (
        <div className="rounded-2xl bg-white border p-4 shadow-[0_8px_22px_-12px_rgba(31,42,40,0.35)]"
          style={{ borderColor: SOFT_BORDER }}>
          <div className="flex gap-2.5">
            <button type="button" onClick={() => baixarPDFExpress(report, effClouds, effIntensity, effKinds, entries, excludedSet)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
              style={{ background: 'rgba(93,95,160,0.08)', color: '#5D5FA0', border: '1px solid rgba(93,95,160,0.2)' }}>
              <Download size={16} />
              Baixar PDF
            </button>
            <button type="button" onClick={() => compartilharPDFExpress(report, effClouds, effIntensity, effKinds, entries, excludedSet)}
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
function gerarPDFExpress(report, clouds = [], intensity, kinds, entries, excludedSet = new Set()) {
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
  doc.text('Smart Gut · Relatório Express', margin, y);
  y += 22;

  const pr = (typeof loadProfile === 'function') ? loadProfile() : {};
  const nomeProf = pr && pr.nome ? String(pr.nome).trim() : '';
  const bio = [];
  if (pr && pr.idade) bio.push(`${pr.idade} anos`);
  if (pr && pr.peso)  bio.push(`${pr.peso} kg`);
  if (pr && pr.altura) bio.push(`${pr.altura} cm`);
  const condArr = Array.isArray(pr && pr.condicoes) ? pr.condicoes.map(c => CONDICOES_LABELS[c] || c).filter(Boolean) : [];
  if (pr && pr.outros) condArr.push(pr.outros);

  microLine(`Paciente: ${nomeProf || '—'}${bio.length ? '  ·  ' + bio.join(' · ') : ''}${condArr.length ? '  ·  Condições: ' + condArr.join(', ') : ''}`);
  microLine(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`);

  y += 4;
  doc.setDrawColor(200, 195, 185);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 20;

  // Resumo Executivo
  const resumo = typeof report.resumo_executivo === 'string' ? report.resumo_executivo : '';
  if (resumo) {
    heading('Resumo Executivo', [93, 95, 160]);
    const paragrafos = resumo.split(/\n\n+/).filter(p => p.trim());
    paragrafos.forEach((p) => { paragraph(p.trim()); spacer(6); });
    spacer(8);
  }

  // Onde a dor aparece (silhueta + pontos marcados)
  if (Array.isArray(clouds) && clouds.length > 0) {
    const imgW = 140;
    const imgH = imgW * 740 / 374;
    ensureSpace(imgH + 90);
    heading('Onde a dor aparece', [189, 90, 74]);
    const imgX = margin + (maxW - imgW) / 2;
    const imgY = y;
    if (digestiveImgEl && digestiveImgEl.complete && digestiveImgEl.naturalWidth > 0) {
      try { doc.addImage(digestiveImgEl, 'JPEG', imgX, imgY, imgW, imgH); } catch (e) {}
    }
    clouds.forEach((c) => {
      const cx = imgX + (c.x / 100) * imgW;
      const cy = imgY + (c.y / 100) * imgH;
      const rr = 4;
      doc.setFillColor(189, 90, 74);
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.5);
      doc.circle(cx, cy, rr, 'FD');
    });
    y = imgY + imgH + 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 95);
    uniqueRegions(clouds).forEach((r) => {
      const lines = doc.splitTextToSize(r.label, maxW);
      lines.forEach(l => { ensureSpace(12); doc.text(l, margin, y); y += 12; });
    });
    if (intensity != null) {
      const txt = `Intensidade relatada: ${intensity}/10`;
      const lines = doc.splitTextToSize(txt, maxW);
      lines.forEach(l => { ensureSpace(12); doc.text(l, margin, y); y += 12; });
    }
    if (kinds && kinds.size > 0) {
      const txt = `Tipo de dor: ${Array.from(kinds).join(', ')}`;
      const lines = doc.splitTextToSize(txt, maxW);
      lines.forEach(l => { ensureSpace(12); doc.text(l, margin, y); y += 12; });
    }
    spacer(6);
    const caveat = 'Nota: os pontos na silhueta indicam a região corporal onde você relatou a sensação (lados, centro, parte superior e inferior do abdômen). A localização marcada não identifica o órgão de origem nem estabelece diagnóstico — apenas registra o relato. A interpretação clínica é exclusiva do médico.';
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(125, 118, 106);
    const cavLines = doc.splitTextToSize(caveat, maxW);
    cavLines.forEach(l => { ensureSpace(11); doc.text(l, margin, y); y += 11; });
    spacer(8);
  }

  // Discutir na consulta
  const discutirAll = Array.isArray(report._discutirEntries) ? report._discutirEntries : [];
  const discutirPDF = discutirAll.filter(e => !excludedSet.has(e.id));
  if (discutirPDF.length > 0) {
    heading('Discutir na consulta', [74, 138, 92]);
    discutirPDF.forEach((e) => {
      ensureSpace(30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(43, 42, 40);
      const titulo = e.title || e.type || 'Registro';
      const tLines = doc.splitTextToSize(titulo, maxW);
      tLines.forEach(l => { ensureSpace(16); doc.text(l, margin, y); y += 16; });
      if (e.description) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(125, 118, 106);
        const dLines = doc.splitTextToSize(e.description, maxW);
        dLines.forEach(l => { ensureSpace(14); doc.text(l, margin, y); y += 14; });
        spacer(4);
      }
      if (e.meta?.note) {
        doc.setFont('helvetica', 'bolditalic');
        doc.setFontSize(11);
        doc.setTextColor(91, 140, 145);
        const nLines = doc.splitTextToSize(e.meta.note, maxW);
        nLines.forEach(l => { ensureSpace(14); doc.text(l, margin, y); y += 14; });
        spacer(4);
      }
      spacer(6);
    });
    spacer(4);
  }


  // Rodapé
  ensureSpace(20);
  y += 4;
  doc.setDrawColor(200, 195, 185);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 12;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(125, 118, 106);
  const disclaimer = 'Relatório gerado a partir do relato em texto livre do paciente (modalidade Express). Não substitui avaliação profissional.';
  doc.text(doc.splitTextToSize(disclaimer, maxW), margin, y);

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

function baixarPDFExpress(report, clouds, intensity, kinds, entries, excludedSet) {
  const doc = gerarPDFExpress(report, clouds, intensity, kinds, entries, excludedSet);
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

async function compartilharPDFExpress(report, clouds, intensity, kinds, entries, excludedSet) {
  if (!isShareSupported()) { baixarPDFExpress(report, clouds, intensity, kinds, entries, excludedSet); return; }
  try {
    const doc = gerarPDFExpress(report, clouds, intensity, kinds, entries, excludedSet);
    const blob = doc.output('blob');
    const file = new File([blob], montarNomeArquivoPDFExpress(), { type: 'application/pdf' });
    if (!navigator.canShare({ files: [file] })) { baixarPDFExpress(report, clouds, intensity, kinds, entries, excludedSet); return; }
    await navigator.share({
      files: [file],
      title: 'Relatório Express — Smart Gut',
      text: 'Meu relatório de preparação para consulta.',
    });
  } catch (err) {
    if (err && err.name !== 'AbortError') baixarPDFExpress(report, clouds, intensity, kinds, entries, excludedSet);
  }
}