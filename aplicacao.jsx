import { useState, useRef, useCallback } from 'react';
import {
  Plus, X, ChevronLeft, Utensils, Droplet, Moon, Flame, Activity, Smile, Mic, Check, Minus,
} from 'lucide-react';

const ENTRY_TYPES = {
  meal:     { label: 'Refeição',  icon: Utensils, color: '#C9763A', soft: '#F6E9DD' },
  water:    { label: 'Água',      icon: Droplet,  color: '#3E8E96', soft: '#DEEFEF' },
  sleep:    { label: 'Sono',      icon: Moon,     color: '#5D5FA0', soft: '#E6E5F4' },
  pain:     { label: 'Dor',       icon: Flame,    color: '#BD5A4A', soft: '#F5E1DD' },
  exercise: { label: 'Exercício', icon: Activity, color: '#5E8A4E', soft: '#E4EEDF' },
  mood:     { label: 'Humor',     icon: Smile,    color: '#9A6FA0', soft: '#EFE3EE' },
};

// ─── Digestive image (base64 webp) ───────────────────────────────────────────
const DIGESTIVE_IMAGE = 'data:image/webp;base64,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';

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
  const r     = 8 + (intensity / 10) * 6;   // radius in % units  ←  we convert below
  const filterId = `smoke-${id}`;
  return (
    <g>
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
function Silhouette({ clouds, intensity, onTap, compact }) {
  const imgRef = useRef(null);

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
        src={DIGESTIVE_IMAGE}
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

// ─── Form: Dor ────────────────────────────────────────────────────────────────
function PainForm({ onSave }) {
  const [clouds,    setClouds]    = useState([]);
  const [intensity, setIntensity] = useState(5);
  const [kinds,     setKinds]     = useState(new Set());
  const [note,      setNote]      = useState('');
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

  const clearAll = () => setClouds([]);

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
          <Silhouette clouds={clouds} intensity={intensity} onTap={handleTap} />
        </div>
        <p className="text-sm text-[#5C5650] mt-2 min-h-[20px]">
          {uniqueOrgans.length
            ? uniqueOrgans.join(' · ')
            : 'Nenhuma região marcada — toque na ilustração'}
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
          <p className="font-medium text-[#2B2A28] text-sm">{entry.title}</p>
          <span className="text-xs text-[#B6AE9F] tabular-nums shrink-0">{entry.time}</span>
        </div>
        <p className="text-sm text-[#7D766A] mt-0.5 leading-snug">{entry.description}</p>

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
      </div>
    </div>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────
export default function GutDiaryPrototype() {
  const [entries,    setEntries]    = useState(INITIAL_ENTRIES);
  const [sheetOpen,  setSheetOpen]  = useState(false);
  const [activeForm, setActiveForm] = useState(null);
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
      <div className="relative w-full max-w-[420px] h-screen sm:h-[844px] sm:rounded-[2.5rem] sm:shadow-2xl overflow-hidden bg-[#FAF7F2] flex flex-col">

        {/* Header */}
        <header className="px-5 pt-6 pb-3 shrink-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: ENTRY_TYPES.pain.color }}>Diário Intestinal</p>
          <h1 className="text-2xl font-serif text-[#2B2A28] mt-0.5">Sexta-feira</h1>
          <p className="text-sm text-[#B6AE9F]">12 de junho</p>
        </header>

        {/* Day summary chips */}
        <div className="px-5 pb-3 flex gap-2 overflow-x-auto shrink-0">
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
        <main className="flex-1 overflow-y-auto px-5 pb-28">
          {dayOrder.map((day) => (
            grouped[day].length > 0 && (
              <section key={day} className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#B6AE9F] mb-3">{dayLabels[day]}</p>
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
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
