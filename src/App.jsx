import digestiveImage from './assets/sisdiges.jpg';
import digestiveClosedImage from './assets/sisdiges_fechado.jpg';
import { useState, useRef, useCallback } from 'react';
import {
  Plus, X, ChevronLeft, Utensils, Droplet, Moon, Flame, Activity, Smile, Mic, Check, Minus,
  Leaf, BookOpen,
} from 'lucide-react';

const ENTRY_TYPES = {
  meal:       { label: 'Refeição',   icon: Utensils, color: '#C9763A', soft: '#F6E9DD' },
  water:      { label: 'Água',       icon: Droplet,  color: '#3E8E96', soft: '#DEEFEF' },
  sleep:      { label: 'Sono',       icon: Moon,     color: '#5D5FA0', soft: '#E6E5F4' },
  pain:       { label: 'Dor',        icon: Flame,    color: '#BD5A4A', soft: '#F5E1DD' },
  exercise:   { label: 'Exercício',  icon: Activity, color: '#5E8A4E', soft: '#E4EEDF' },
  mood:       { label: 'Humor',      icon: Smile,    color: '#9A6FA0', soft: '#EFE3EE' },
  evacuation: { label: 'Evacuação',  icon: Leaf,     color: '#8A6D3B', soft: '#EFE7D6' },
};

// ─── Temas de ambiência (RF 1) ───────────────────────────────────────────────
// Função TOTAL: qualquer hora fora de [0,23] ou não-inteira cai no fallback Noite.
export function periodoDoDia(hora) {
  if (!Number.isInteger(hora) || hora < 0 || hora > 23) return 'noite'; // RF 1.11 (fallback)
  if (hora >= 5 && hora <= 11) return 'amanhecer';                       // RF 1.3
  if (hora >= 12 && hora <= 17) return 'tarde';                          // RF 1.4
  return 'noite';                                                        // RF 1.5 (18–23 e 0–4)
}

// Obtém a hora local de forma defensiva; em falha retorna NaN (→ fallback Noite).
export function horaLocalAtual() {
  try {
    return new Date().getHours();
  } catch {
    return NaN;
  }
}

// ─── Conteúdo factual da Escala de Bristol (guarda-corpo regulatório, RF 4.2) ─
// Apenas atributos observáveis (forma, consistência, textura). Sem nomes de
// condições, diagnóstico, juízo de normalidade ou recomendação.
const BRISTOL_DESCRICOES = {
  1: 'Pedaços duros e separados, como pequenas bolinhas',
  2: 'Formato alongado, com superfície grumosa',
  3: 'Formato alongado, com rachaduras na superfície',
  4: 'Formato alongado, superfície lisa e macia',
  5: 'Pedaços macios com bordas bem definidas',
  6: 'Pedaços moles com bordas irregulares',
  7: 'Totalmente líquido, sem pedaços sólidos',
};

const EVAC_CORES  = ['Marrom claro', 'Marrom', 'Marrom escuro', 'Amarelada', 'Esverdeada', 'Avermelhada', 'Escura'];
const EVAC_ODORES = ['Leve', 'Moderado', 'Forte'];

const BRISTOL_PADRAO = 4; // Valor_Padrão_Bristol (RF 3.11)

// Normaliza o estado do formulário de evacuação em uma entrada válida da
// Linha do Tempo. Aplica clamp/validação defensiva (segunda barreira além da
// UI), o padrão Bristol=4 quando não selecionado (RF 3.11) e preserva campos
// opcionais ausentes como null sem bloquear o salvamento (RF 3.12).
export function buildEvacuationEntry(form) {
  const f = form || {};
  const bristol =
    Number.isInteger(f.bristol) && f.bristol >= 1 && f.bristol <= 7 ? f.bristol : BRISTOL_PADRAO;
  const cor = EVAC_CORES.includes(f.cor) ? f.cor : null;
  const odor = EVAC_ODORES.includes(f.odor) ? f.odor : null;
  const esforco =
    Number.isInteger(f.esforco) && f.esforco >= 1 && f.esforco <= 5 ? f.esforco : null;
  const tempo =
    Number.isInteger(f.tempo) && f.tempo >= 1 && f.tempo <= 120 ? f.tempo : null;

  const parts = [BRISTOL_DESCRICOES[bristol]];
  if (cor) parts.push(`Cor: ${cor.toLowerCase()}`);
  if (odor) parts.push(`Odor: ${odor.toLowerCase()}`);
  if (esforco) parts.push(`Esforço ${esforco}/5`);
  if (tempo) parts.push(`${tempo} min`);

  return {
    title: 'Evacuação',
    description: parts.join(' · '),
    meta: { bristol, cor, odor, esforco, tempo },
  };
}

// ─── Digestive image (base64 webp) ───────────────────────────────────────────
const DIGESTIVE_IMAGE = digestiveImage;

// ─── 10 organ zones  (% of image: left, top, width, height) ──────────────────
// Recalibrated from the annotated reference image you provided.
const ORGAN_ZONES = [
  { id: 'esofago',           label: 'Esôfago',              cx: 50, cy: 25 },
  { id: 'estomago',          label: 'Estômago',             cx: 72, cy: 50 },
  { id: 'figado',            label: 'Fígado',               cx: 38, cy: 51 },
  { id: 'intestino_delgado', label: 'Intestino delgado',    cx: 55, cy: 69 },
  { id: 'colon_asc',         label: 'Cólon ascendente',     cx: 23, cy: 67 },
  { id: 'colon_trans',       label: 'Cólon transverso',     cx: 53, cy: 58 },
  { id: 'colon_desc',        label: 'Cólon descendente',    cx: 87, cy: 67 },
  { id: 'colon_sig',         label: 'Cólon sigmoide',       cx: 65, cy: 82 },
  { id: 'apendice',          label: 'Apêndice',             cx: 22, cy: 80 },
  { id: 'reto',              label: 'Reto / Ânus',          cx: 50, cy: 90 },
];

const INITIAL_ENTRIES = [
  { id: 1, day: 'hoje',  time: '07:43', type: 'meal',     title: 'Café da manhã',  description: '2 fatias de bolo de chocolate' },
  { id: 2, day: 'hoje',  time: '08:23', type: 'water',    title: 'Hidratação',     description: '3 copos de água (~750 ml)' },
  { id: 3, day: 'hoje',  time: '11:45', type: 'water',    title: 'Hidratação',     description: '2 copos de água (~500 ml)' },
  { id: 4, day: 'hoje',  time: '12:21', type: 'meal',     title: 'Almoço',         description: 'Arroz, carne gordurosa e refrigerante' },
  { id: 5, day: 'hoje',  time: '14:50', type: 'pain',     title: 'Dor abdominal',  description: 'Cólica · Gases intensos · Cólon sigmoide', meta: { clouds: [{ x: 65, y: 82, organ: 'colon_sig' }], intensity: 7 } },
  { id: 6, day: 'ontem', time: '18:30', type: 'exercise', title: 'Exercício',      description: 'Caminhada · 30 min · Intensidade leve' },
  { id: 7, day: 'ontem', time: '23:10', type: 'sleep',    title: 'Sono',           description: 'Levantou 2x à noite · Acordou com desconforto abdominal', meta: { quality: 3 } },
];

// ─── Utility: nearest organ to a tap point ───────────────────────────────────
function nearestOrgan(px, py) {
  let best = null, bestDist = Infinity;
  ORGAN_ZONES.forEach((z) => {
    const dx = px - z.cx, dy = py - z.cy;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < bestDist) { bestDist = d; best = z; }
  });
  return best;
}

// ─── Smoky pain cloud (SVG turbulence filter) ────────────────────────────────
function PainCloud({ x, y, intensity, id }) {
  const alpha = 0.25 + (intensity / 10) * 0.45;
  // Size controlled here: divided by 2 to make it half the original size (e.g. 4 instead of 8)
  const r     = 4 + (intensity / 10) * 3;
  const filterId = `smoke-${id}`;
  return (
    <g className="pain-cloud-group">
      <defs>
        <filter id={filterId} x="-60%" y="-60%" width="220%" height="220%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04 0.04" numOctaves="4" seed={id * 13} result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="18" xChannelSelector="R" yChannelSelector="G" result="displaced" />
          <feGaussianBlur in="displaced" stdDeviation="3.5" result="blurred" />
          <feComposite in="blurred" in2="SourceGraphic" operator="atop" />
        </filter>
      </defs>
      {/* Outer halo */}
      <ellipse
        cx={`${x}%`} cy={`${y}%`}
        rx={`${r * 1.5}%`} ry={`${r * 1.1}%`}
        fill={`rgba(189,50,40,${alpha * 0.35})`}
        filter={`url(#${filterId})`}
      />
      {/* Core cloud */}
      <ellipse
        cx={`${x}%`} cy={`${y}%`}
        rx={`${r}%`} ry={`${r * 0.75}%`}
        fill={`rgba(210,40,30,${alpha})`}
        filter={`url(#${filterId})`}
      />
    </g>
  );
}

// ─── Interactive silhouette ───────────────────────────────────────────────────
function Silhouette({ clouds, intensity, onTap, compact, showOrgans = true }) {
  const imgRef = useRef(null);
  const currentImage = showOrgans ? DIGESTIVE_IMAGE : digestiveClosedImage;

  const handleClick = useCallback((e) => {
    if (!onTap) return;
    const rect = imgRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width)  * 100;
    const py = ((e.clientY - rect.top)  / rect.height) * 100;
    const organ = nearestOrgan(px, py);
    onTap({ x: px, y: py, organ });
  }, [onTap]);

  return (
    <div
      className={compact ? 'relative w-14 shrink-0' : 'relative w-full max-w-[220px] mx-auto'}
      style={{ aspectRatio: '374/740' }}
    >
      <img
        ref={imgRef}
        src={currentImage}
        alt="Sistema digestivo"
        className="absolute inset-0 w-full h-full object-contain select-none"
        style={{ pointerEvents: onTap ? 'none' : 'none' }}
        draggable={false}
      />

      {/* SVG overlay for clouds */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        onClick={handleClick}
        style={{ cursor: onTap ? 'crosshair' : 'default' }}
      >
        <style>{`
          @keyframes pulseCloud {
            0%, 100% { transform: scale(0.93); opacity: 0.85; }
            50% { transform: scale(1.07); opacity: 1; }
          }
          .pain-cloud-group {
            transform-box: fill-box;
            transform-origin: center;
            animation: pulseCloud 2.5s ease-in-out infinite;
          }
        `}</style>
        {clouds.map((c, i) => (
          <PainCloud key={i} id={i + 1} x={c.x} y={c.y} intensity={intensity} />
        ))}
      </svg>

      {/* Subtle tap hint when interactive and empty */}
      {onTap && clouds.length === 0 && (
        <div className="absolute inset-0 flex items-end justify-center pb-3 pointer-events-none">
          <span className="text-[10px] text-[#BD5A4A]/70 bg-white/80 px-2 py-0.5 rounded-full">
            Toque para marcar a dor
          </span>
        </div>
      )}
    </div>
  );
}

function MiniSilhouette({ clouds, intensity }) {
  return <Silhouette clouds={clouds} intensity={intensity || 5} compact />;
}

// ─── Shared primitives ────────────────────────────────────────────────────────
function SaveButton({ color, onClick, label = 'Salvar registro' }) {
  return (
    <button onClick={onClick} className="w-full py-3 rounded-2xl text-white font-medium text-sm" style={{ background: color }}>
      {label}
    </button>
  );
}

function Chip({ active, color, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-sm border transition-colors"
      style={active ? { background: color, borderColor: color, color: '#fff' } : { borderColor: '#EDE7DD', color: '#7D766A' }}
    >
      {children}
    </button>
  );
}

// ─── Ambiência decorativa por tema (RF 1.6–1.8) ──────────────────────────────
// Camada puramente decorativa, atrás do conteúdo, sem interferir em toque ou
// leitura (aria-hidden + pointer-events none). O gradiente de fundo vem do
// contêiner raiz; aqui ficam apenas os elementos decorativos de cada tema.
function AmbianceLayer({ theme }) {
  const STARS = [
    { top: '6%', left: '14%', s: 3 },   { top: '10%', left: '38%', s: 2 },
    { top: '8%', left: '62%', s: 2 },   { top: '14%', left: '82%', s: 3 },
    { top: '20%', left: '24%', s: 2 },  { top: '24%', left: '54%', s: 2 },
    { top: '18%', left: '70%', s: 2 },  { top: '30%', left: '12%', s: 3 },
    { top: '34%', left: '88%', s: 2 },  { top: '40%', left: '44%', s: 2 },
  ];
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true"
      style={{ zIndex: 0, pointerEvents: 'none' }}>
      {theme === 'amanhecer' && (
        <>
          {/* Sol */}
          <div className="absolute" style={{
            top: '7%', right: '12%', width: 70, height: 70, borderRadius: '9999px',
            background: 'radial-gradient(circle, #FFE38C 0%, #FFD15C 55%, rgba(255,209,92,0) 100%)',
          }} />
          {/* Nuvens */}
          <svg className="absolute" style={{ top: '16%', left: '6%', width: 96, opacity: 0.92 }} viewBox="0 0 100 44">
            <ellipse cx="30" cy="26" rx="22" ry="13" fill="#ffffff" />
            <ellipse cx="55" cy="22" rx="18" ry="14" fill="#ffffff" />
            <ellipse cx="45" cy="32" rx="30" ry="10" fill="#ffffff" />
          </svg>
          <svg className="absolute" style={{ top: '32%', right: '14%', width: 64, opacity: 0.78 }} viewBox="0 0 100 44">
            <ellipse cx="35" cy="26" rx="20" ry="12" fill="#ffffff" />
            <ellipse cx="58" cy="23" rx="16" ry="12" fill="#ffffff" />
            <ellipse cx="48" cy="32" rx="26" ry="9" fill="#ffffff" />
          </svg>
        </>
      )}

      {theme === 'tarde' && (
        // Brilho quente de entardecer
        <div className="absolute" style={{
          bottom: '14%', left: '50%', transform: 'translateX(-50%)',
          width: 200, height: 200, borderRadius: '9999px',
          background: 'radial-gradient(circle, rgba(255,176,84,0.55) 0%, rgba(255,176,84,0) 70%)',
        }} />
      )}

      {theme === 'noite' && (
        <>
          {/* Lua (crescente via sombra interna na cor do céu) */}
          <div className="absolute" style={{
            top: '7%', right: '14%', width: 56, height: 56, borderRadius: '9999px',
            background: '#F4EFD8', boxShadow: 'inset -15px 7px 0 0 #161E38',
          }} />
          {/* Estrelas */}
          {STARS.map((st, i) => (
            <span key={i} className="absolute rounded-full" style={{
              top: st.top, left: st.left, width: st.s, height: st.s,
              background: '#FBF7E9', opacity: 0.85,
            }} />
          ))}
        </>
      )}
    </div>
  );
}

// ─── Controle de Estilo Caderno (RF 2) ───────────────────────────────────────
function NotebookToggle({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      aria-pressed={value}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors shrink-0"
      style={value
        ? { background: ENTRY_TYPES.pain.color, borderColor: ENTRY_TYPES.pain.color, color: '#fff' }
        : { borderColor: 'rgba(150,140,120,0.4)', color: 'var(--amb-text)', background: 'rgba(255,255,255,0.4)' }}
    >
      <BookOpen size={14} />
      Caderno
    </button>
  );
}

// ─── Form: Dor ────────────────────────────────────────────────────────────────
function PainForm({ onSave }) {
  const [clouds,    setClouds]    = useState([]);
  const [intensity, setIntensity] = useState(5);
  const [kinds,     setKinds]     = useState(new Set());
  const [note,      setNote]      = useState('');
  const [showOrgans, setShowOrgans] = useState(false);
  const color = ENTRY_TYPES.pain.color;
  const kindOptions = ['Cólica', 'Queimação', 'Pressão', 'Pontada', 'Distensão'];

  const handleTap = ({ x, y, organ }) => {
    setClouds((prev) => {
      // toggle: if a cloud very close already exists, remove it
      const idx = prev.findIndex((c) => Math.abs(c.x - x) < 5 && Math.abs(c.y - y) < 5);
      if (idx !== -1) return prev.filter((_, i) => i !== idx);
      return [...prev, { x, y, organ: organ.id, organLabel: organ.label }];
    });
  };

  const clearAll = () => {
    setClouds([]);
    setShowOrgans(false);
  };

  const toggleKind = (k) => setKinds((s) => {
    const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n;
  });

  const uniqueOrgans = [...new Set(clouds.map((c) => c.organLabel))];

  return (
    <div className="space-y-5">
      {/* Silhouette */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#B6AE9F]">
            Toque onde sente a dor
          </p>
          {clouds.length > 0 && (
            <button onClick={clearAll} className="text-xs text-[#BD5A4A]">Limpar</button>
          )}
        </div>
        <div className="bg-[#FAF7F2] rounded-2xl p-3 border border-[#EDE7DD]">
          <Silhouette clouds={clouds} intensity={intensity} onTap={handleTap} showOrgans={showOrgans} />
        </div>
        {clouds.length > 0 && (
          <button
            type="button"
            onClick={() => setShowOrgans(!showOrgans)}
            className="mt-3 w-full py-2.5 px-4 rounded-xl border text-xs font-semibold bg-white hover:bg-[#FAF7F2] active:scale-95 transition-transform flex items-center justify-center gap-1.5 shadow-sm"
            style={{ color: showOrgans ? '#BD5A4A' : '#3D6B66', borderColor: showOrgans ? '#F5E1DD' : '#EDE7DD' }}
          >
            {showOrgans ? 'Ocultar Órgãos (Ver Corpo)' : 'Revelar órgãos afetados'}
          </button>
        )}
        <p className="text-sm text-center mt-3 min-h-[20px]">
          {clouds.length === 0 ? (
            <span className="text-[#5C5650]">Nenhuma região marcada — toque na ilustração</span>
          ) : showOrgans ? (
            <span className="font-semibold" style={{ color }}>{uniqueOrgans.join(' · ')}</span>
          ) : (
            <span className="text-[#7D766A] italic">Pontos marcados. Clique em "Revelar órgãos" para ver a área afetada.</span>
          )}
        </p>
      </div>

      {/* Intensity */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#B6AE9F]">Intensidade</p>
          <span className="text-sm font-semibold" style={{ color }}>{intensity}/10</span>
        </div>
        <input type="range" min={1} max={10} value={intensity}
          onChange={(e) => setIntensity(+e.target.value)}
          className="w-full" style={{ accentColor: color }} />
      </div>

      {/* Kind */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#B6AE9F] mb-2">Como é a dor?</p>
        <div className="flex flex-wrap gap-2">
          {kindOptions.map((k) => (
            <Chip key={k} active={kinds.has(k)} color={color} onClick={() => toggleKind(k)}>{k}</Chip>
          ))}
        </div>
      </div>

      {/* Note */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#B6AE9F] mb-2">Observações (opcional)</p>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
          placeholder="Ex: começou cerca de 40 min após o almoço"
          className="w-full rounded-xl border border-[#EDE7DD] p-3 text-sm resize-none focus:outline-none" />
      </div>

      <SaveButton color={color} onClick={() => {
        const kindStr = kinds.size ? Array.from(kinds).join(' · ') : 'Dor abdominal';
        const orgStr  = uniqueOrgans.join(' · ');
        const desc    = [kindStr, orgStr, note.trim()].filter(Boolean).join(' · ');
        onSave({ title: 'Dor abdominal', description: desc, meta: { clouds, intensity } });
      }} />
    </div>
  );
}

// ─── Other forms (meal, water, sleep, exercise, mood) ────────────────────────
function MealForm({ onSave }) {
  const [mealType, setMealType] = useState('Café da manhã');
  const [desc, setDesc] = useState('');
  const color = ENTRY_TYPES.meal.color;
  const types = ['Café da manhã', 'Almoço', 'Jantar', 'Lanche'];
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#B6AE9F] mb-2">Tipo de refeição</p>
        <div className="flex flex-wrap gap-2">
          {types.map((t) => <Chip key={t} active={mealType === t} color={color} onClick={() => setMealType(t)}>{t}</Chip>)}
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#B6AE9F] mb-2">O que você comeu?</p>
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3}
          placeholder="Ex: Arroz, feijão, frango grelhado e salada"
          className="w-full rounded-xl border border-[#EDE7DD] p-3 text-sm resize-none focus:outline-none focus:border-[#C9763A]" />
      </div>
      <SaveButton color={color} onClick={() => onSave({ title: mealType, description: desc.trim() || 'Sem detalhes registrados' })} />
    </div>
  );
}

function WaterForm({ onSave }) {
  const [glasses, setGlasses] = useState(1);
  const color = ENTRY_TYPES.water.color;
  return (
    <div className="space-y-6">
      <p className="text-sm text-[#7D766A]">Cada copo equivale a aproximadamente 250 ml</p>
      <div className="flex items-center justify-center gap-6">
        <button onClick={() => setGlasses((g) => Math.max(1, g - 1))}
          className="w-11 h-11 rounded-full border border-[#EDE7DD] flex items-center justify-center" style={{ color }}>
          <Minus size={18} />
        </button>
        <div className="text-center">
          <p className="text-3xl font-serif text-[#2B2A28]">{glasses}</p>
          <p className="text-xs text-[#B6AE9F] mt-1">{glasses * 250} ml</p>
        </div>
        <button onClick={() => setGlasses((g) => g + 1)}
          className="w-11 h-11 rounded-full border border-[#EDE7DD] flex items-center justify-center" style={{ color }}>
          <Plus size={18} />
        </button>
      </div>
      <SaveButton color={color}
        onClick={() => onSave({ title: 'Hidratação', description: `${glasses} copo${glasses > 1 ? 's' : ''} de água (~${glasses * 250} ml)` })} />
    </div>
  );
}

function SleepForm({ onSave }) {
  const [quality, setQuality] = useState(3);
  const [checks, setChecks] = useState({ banheiro: false, acordou: false, dificuldade: false, desconforto: false });
  const color = ENTRY_TYPES.sleep.color;
  const subOptions = [
    { key: 'banheiro',    label: 'Levantou para ir ao banheiro' },
    { key: 'acordou',     label: 'Acordou durante a noite' },
    { key: 'dificuldade', label: 'Dificuldade para pegar no sono' },
    { key: 'desconforto', label: 'Acordou com desconforto abdominal' },
  ];
  const toggle = (k) => setChecks((c) => ({ ...c, [k]: !c[k] }));
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#B6AE9F] mb-2">Qualidade do sono</p>
        <div className="flex gap-2">
          {[1,2,3,4,5].map((i) => (
            <button key={i} onClick={() => setQuality(i)} className="flex-1 h-10 rounded-xl border"
              style={i <= quality ? { background: color, borderColor: color } : { borderColor: '#EDE7DD' }} />
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#B6AE9F] mb-2">Detalhes da noite</p>
        <div className="space-y-2">
          {subOptions.map((opt) => (
            <button key={opt.key} onClick={() => toggle(opt.key)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-[#EDE7DD] text-sm text-[#5C5650] text-left">
              <span>{opt.label}</span>
              <span className="w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ml-3"
                style={checks[opt.key] ? { background: color, borderColor: color } : { borderColor: '#D8D1C4' }}>
                {checks[opt.key] && <Check size={12} className="text-white" />}
              </span>
            </button>
          ))}
        </div>
      </div>
      <SaveButton color={color} onClick={() => {
        const extras = subOptions.filter((o) => checks[o.key]).map((o) => o.label);
        onSave({ title: 'Sono', description: extras.length ? extras.join(' · ') : `Qualidade ${quality}/5`, meta: { quality } });
      }} />
    </div>
  );
}

function ExerciseForm({ onSave }) {
  const [kind, setKind] = useState('Caminhada');
  const [duration, setDuration] = useState(30);
  const [intensity, setIntensity] = useState('Moderada');
  const color = ENTRY_TYPES.exercise.color;
  const kinds = ['Caminhada', 'Musculação', 'Corrida', 'Yoga', 'Outro'];
  const intensities = ['Leve', 'Moderada', 'Intensa'];
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#B6AE9F] mb-2">Tipo</p>
        <div className="flex flex-wrap gap-2">
          {kinds.map((k) => <Chip key={k} active={kind === k} color={color} onClick={() => setKind(k)}>{k}</Chip>)}
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#B6AE9F] mb-2">Duração: {duration} min</p>
        <input type="range" min={5} max={120} step={5} value={duration}
          onChange={(e) => setDuration(+e.target.value)} className="w-full" style={{ accentColor: color }} />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#B6AE9F] mb-2">Intensidade</p>
        <div className="flex gap-2">
          {intensities.map((i) => <Chip key={i} active={intensity === i} color={color} onClick={() => setIntensity(i)}>{i}</Chip>)}
        </div>
      </div>
      <SaveButton color={color}
        onClick={() => onSave({ title: 'Exercício', description: `${kind} · ${duration} min · Intensidade ${intensity.toLowerCase()}` })} />
    </div>
  );
}

function MoodForm({ onSave }) {
  const [mood, setMood] = useState(null);
  const [note, setNote] = useState('');
  const color = ENTRY_TYPES.mood.color;
  const options = [
    { v:1, emoji:'😞', label:'Muito mal' },
    { v:2, emoji:'🙁', label:'Mal' },
    { v:3, emoji:'😐', label:'Neutro' },
    { v:4, emoji:'🙂', label:'Bem' },
    { v:5, emoji:'😄', label:'Muito bem' },
  ];
  return (
    <div className="space-y-5">
      <div className="flex justify-between">
        {options.map((o) => (
          <button key={o.v} onClick={() => setMood(o.v)} className="flex flex-col items-center gap-1.5">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl border"
              style={mood === o.v ? { borderColor: color, background: ENTRY_TYPES.mood.soft } : { borderColor: '#EDE7DD' }}>
              {o.emoji}
            </div>
            <span className="text-[10px] text-[#B6AE9F]">{o.label}</span>
          </button>
        ))}
      </div>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
        placeholder="Algo que queira anotar? (opcional)"
        className="w-full rounded-xl border border-[#EDE7DD] p-3 text-sm resize-none focus:outline-none" />
      <SaveButton color={color} onClick={() => {
        const sel = options.find((o) => o.v === mood) || options[2];
        onSave({ title: 'Humor', description: `${sel.emoji} ${sel.label}${note.trim() ? ' · ' + note.trim() : ''}` });
      }} />
    </div>
  );
}

// ─── Form: Evacuação (RF 3) ───────────────────────────────────────────────────
function EvacuationForm({ onSave }) {
  const [bristol, setBristol] = useState(null);  // 1–7 ou null (RF 3.3 / 3.11)
  const [cor,     setCor]     = useState(null);  // seleção única ou null (RF 3.4)
  const [odor,    setOdor]    = useState(null);  // seleção única ou null (RF 3.5)
  const [esforco, setEsforco] = useState(null);  // 1–5 ou null (RF 3.6)
  const [tempo,   setTempo]   = useState(null);  // 1–120 min ou null (RF 3.7)
  const color = ENTRY_TYPES.evacuation.color;
  const soft  = ENTRY_TYPES.evacuation.soft;

  return (
    <div className="space-y-5">
      {/* Escala de Bristol — rótulos estritamente descritivos (RF 3.3 / 4.2) */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#B6AE9F] mb-2">Escala de Bristol</p>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <button key={n} type="button" onClick={() => setBristol(n)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors"
              style={bristol === n ? { borderColor: color, background: soft } : { borderColor: '#EDE7DD' }}>
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
                style={bristol === n ? { background: color, color: '#fff' } : { background: '#F1ECE3', color: '#7D766A' }}>
                {n}
              </span>
              <span className="text-sm text-[#5C5650] leading-snug">{BRISTOL_DESCRICOES[n]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Cor (seleção única, RF 3.4) */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#B6AE9F] mb-2">Cor</p>
        <div className="flex flex-wrap gap-2">
          {EVAC_CORES.map((c) => (
            <Chip key={c} active={cor === c} color={color} onClick={() => setCor(cor === c ? null : c)}>{c}</Chip>
          ))}
        </div>
      </div>

      {/* Odor (seleção única, RF 3.5) */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#B6AE9F] mb-2">Odor</p>
        <div className="flex flex-wrap gap-2">
          {EVAC_ODORES.map((o) => (
            <Chip key={o} active={odor === o} color={color} onClick={() => setOdor(odor === o ? null : o)}>{o}</Chip>
          ))}
        </div>
      </div>

      {/* Esforço para evacuar (1–5, RF 3.6) */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#B6AE9F] mb-2">Esforço para evacuar</p>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <button key={i} type="button" onClick={() => setEsforco(esforco === i ? null : i)}
              className="flex-1 h-10 rounded-xl border text-sm font-medium transition-colors"
              style={esforco === i ? { background: color, borderColor: color, color: '#fff' } : { borderColor: '#EDE7DD', color: '#7D766A' }}>
              {i}
            </button>
          ))}
        </div>
      </div>

      {/* Tempo gasto (1–120 min, RF 3.7) — opcional, inicia vazio (RF 3.12) */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#B6AE9F] mb-2">Tempo gasto para evacuar</p>
        <div className="flex items-center justify-center gap-6">
          <button type="button" onClick={() => setTempo((t) => Math.max(1, (t ?? 1) - 1))}
            className="w-11 h-11 rounded-full border border-[#EDE7DD] flex items-center justify-center" style={{ color }}>
            <Minus size={18} />
          </button>
          <div className="text-center min-w-[64px]">
            <p className="text-3xl font-serif text-[#2B2A28]">{tempo ?? '—'}</p>
            <p className="text-xs text-[#B6AE9F] mt-1">minutos</p>
          </div>
          <button type="button" onClick={() => setTempo((t) => Math.min(120, (t ?? 0) + 1))}
            className="w-11 h-11 rounded-full border border-[#EDE7DD] flex items-center justify-center" style={{ color }}>
            <Plus size={18} />
          </button>
        </div>
      </div>

      <SaveButton color={color}
        onClick={() => onSave(buildEvacuationEntry({ bristol, cor, odor, esforco, tempo }))} />
    </div>
  );
}

// ─── Entry card ───────────────────────────────────────────────────────────────
function EntryCard({ entry }) {
  const meta = ENTRY_TYPES[entry.type];
  const Icon = meta.icon;
  return (
    <div className="flex gap-3 bg-white rounded-2xl border border-[#EDE7DD] p-3 items-start">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: meta.soft, color: meta.color }}>
        <Icon size={18} strokeWidth={2.2} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="entry-text font-medium text-[#2B2A28] text-sm">{entry.title}</p>
          <span className="text-xs text-[#B6AE9F] tabular-nums shrink-0">{entry.time}</span>
        </div>
        <p className="entry-text text-sm text-[#7D766A] mt-0.5 leading-snug">{entry.description}</p>

        {entry.type === 'pain' && entry.meta?.clouds?.length > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <MiniSilhouette clouds={entry.meta.clouds} intensity={entry.meta.intensity} />
            <span className="text-xs font-medium" style={{ color: meta.color }}>
              Intensidade {entry.meta.intensity}/10
            </span>
          </div>
        )}

        {entry.type === 'sleep' && entry.meta && (
          <div className="mt-2 flex items-center gap-1">
            {[1,2,3,4,5].map((i) => (
              <span key={i} className="w-2 h-2 rounded-full"
                style={i <= entry.meta.quality ? { background: meta.color } : { background: meta.soft }} />
            ))}
            <span className="text-xs text-[#B6AE9F] ml-1">qualidade {entry.meta.quality}/5</span>
          </div>
        )}

        {entry.type === 'evacuation' && entry.meta && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: meta.soft, color: meta.color }}>
              Bristol {entry.meta.bristol}
            </span>
            {entry.meta.tempo && (
              <span className="text-xs text-[#B6AE9F]">{entry.meta.tempo} min</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [entries,    setEntries]    = useState(INITIAL_ENTRIES);
  const [sheetOpen,  setSheetOpen]  = useState(false);
  const [activeForm, setActiveForm] = useState(null);
  const [tema]                      = useState(() => periodoDoDia(horaLocalAtual())); // RF 1.1/1.2
  const [notebook,   setNotebook]   = useState(false);                                // RF 2.1 (padrão off)
  const idRef = useRef(100);

  const dayOrder  = ['hoje', 'ontem'];
  const dayLabels = { hoje: 'Hoje', ontem: 'Ontem' };

  const grouped = {};
  dayOrder.forEach((d) => {
    grouped[d] = entries.filter((e) => e.day === d).sort((a, b) => a.time.localeCompare(b.time));
  });

  function handleSave(type, data) {
    const now  = new Date();
    const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    idRef.current += 1;
    setEntries((prev) => [...prev, { id: idRef.current, day: 'hoje', time, type, ...data }]);
    setActiveForm(null);
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#EDE7DD] sm:p-6 font-sans">
      <div
        data-theme={tema}
        className={`relative w-full max-w-[420px] h-screen sm:h-[844px] sm:rounded-[2.5rem] sm:shadow-2xl overflow-hidden flex flex-col ${notebook ? 'notebook' : ''}`}
        style={{ background: 'linear-gradient(180deg, var(--amb-bg-1) 0%, var(--amb-bg-2) 100%)' }}
      >
        {/* Ambiência decorativa de fundo (atrás de todo o conteúdo) */}
        <AmbianceLayer theme={tema} />

        {/* Header */}
        <header className="relative z-10 px-5 pt-6 pb-3 shrink-0 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: ENTRY_TYPES.pain.color }}>Diário Intestinal</p>
            <h1 className="text-2xl font-serif mt-0.5" style={{ color: 'var(--amb-text)' }}>Sexta-feira</h1>
            <p className="text-sm" style={{ color: 'var(--amb-text)', opacity: 0.65 }}>12 de junho</p>
          </div>
          <NotebookToggle value={notebook} onChange={setNotebook} />
        </header>

        {/* Day summary chips */}
        <div className="relative z-10 px-5 pb-3 flex gap-2 overflow-x-auto shrink-0">
          {Object.entries(ENTRY_TYPES).map(([key, meta]) => {
            const count = grouped.hoje.filter((e) => e.type === key).length;
            if (!count) return null;
            const Icon = meta.icon;
            return (
              <div key={key} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full shrink-0"
                style={{ background: meta.soft, color: meta.color }}>
                <Icon size={12} />
                <span className="text-xs font-medium">{count}</span>
              </div>
            );
          })}
        </div>

        {/* Timeline */}
        <main className="relative z-10 flex-1 overflow-y-auto px-5 pb-28">
          {dayOrder.map((day) => (
            grouped[day].length > 0 && (
              <section key={day} className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-wider mb-3"
                  style={{ color: 'var(--amb-text)', opacity: 0.55 }}>{dayLabels[day]}</p>
                <div className="space-y-3">
                  {grouped[day].map((entry) => <EntryCard key={entry.id} entry={entry} />)}
                </div>
              </section>
            )
          ))}
        </main>

        {/* FAB */}
        <button onClick={() => setSheetOpen(true)}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full text-white flex items-center justify-center active:scale-95 transition-transform z-10"
          style={{ background: '#3D6B66', boxShadow: '0 10px 25px -8px rgba(61,107,102,0.6)' }}>
          <Plus size={26} />
        </button>

        {/* Sheet: type picker */}
        <div className={`absolute inset-0 transition-opacity duration-300 z-20 ${sheetOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
          <div className="absolute inset-0 bg-black/30" onClick={() => setSheetOpen(false)} />
          <div className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-5 pb-8 transition-transform duration-300 ${sheetOpen ? 'translate-y-0' : 'translate-y-full'}`}>
            <div className="w-10 h-1.5 bg-[#EDE7DD] rounded-full mx-auto mb-4" />
            <p className="text-center font-serif text-lg text-[#2B2A28] mb-4">O que você quer registrar?</p>
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(ENTRY_TYPES).map(([key, meta]) => {
                const Icon = meta.icon;
                return (
                  <button key={key}
                    onClick={() => { setSheetOpen(false); setActiveForm(key); }}
                    className="flex flex-col items-center gap-2 py-3 rounded-2xl border border-[#EDE7DD] active:scale-95 transition-transform">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center"
                      style={{ background: meta.soft, color: meta.color }}>
                      <Icon size={20} />
                    </div>
                    <span className="text-xs font-medium text-[#5C5650]">{meta.label}</span>
                  </button>
                );
              })}
            </div>
            <button className="w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-[#D8D1C4] text-[#7D766A] text-sm font-medium">
              <Mic size={16} /> Registrar por voz
            </button>
          </div>
        </div>

        {/* Sheet: detail form */}
        <div className={`absolute inset-0 transition-opacity duration-300 z-30 ${activeForm ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
          <div className="absolute inset-0 bg-black/30" onClick={() => setActiveForm(null)} />
          <div className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl flex flex-col max-h-[92%] transition-transform duration-300 ${activeForm ? 'translate-y-0' : 'translate-y-full'}`}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[#F1ECE3] shrink-0">
              <button onClick={() => { setActiveForm(null); setSheetOpen(true); }} className="text-[#B6AE9F]">
                <ChevronLeft size={20} />
              </button>
              <p className="font-serif text-base text-[#2B2A28]">{activeForm && ENTRY_TYPES[activeForm].label}</p>
              <button onClick={() => setActiveForm(null)} className="text-[#B6AE9F]"><X size={20} /></button>
            </div>
            <div className="px-5 py-4 overflow-y-auto flex-1">
              {activeForm === 'meal'     && <MealForm     onSave={(d) => handleSave('meal',     d)} />}
              {activeForm === 'water'    && <WaterForm    onSave={(d) => handleSave('water',    d)} />}
              {activeForm === 'sleep'    && <SleepForm    onSave={(d) => handleSave('sleep',    d)} />}
              {activeForm === 'pain'     && <PainForm     onSave={(d) => handleSave('pain',     d)} />}
              {activeForm === 'exercise' && <ExerciseForm onSave={(d) => handleSave('exercise', d)} />}
              {activeForm === 'mood'     && <MoodForm     onSave={(d) => handleSave('mood',     d)} />}
              {activeForm === 'evacuation' && <EvacuationForm onSave={(d) => handleSave('evacuation', d)} />}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
