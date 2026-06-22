import digestiveImage from './assets/sisdiges.jpg';
import digestiveClosedImage from './assets/sisdiges_fechado.jpg';
import mascoteImage from './assets/mascote.png';
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  Plus, X, ChevronLeft, Utensils, Droplet, Moon, Flame, Activity, Smile, Mic, Check, Minus,
  Leaf, PenLine, Search, EllipsisVertical, ChevronDown, ChartColumn, Trash2,
  BookOpen, Lightbulb, Target, User, ChevronRight, Calendar, Wind, Pill, Droplets,
} from 'lucide-react';
import {
  BRISTOL_DESCRICOES, EVAC_CORES, EVAC_ODORES, buildEvacuationEntry,
  periodoDoDia, horaLocalAtual, contarPorTipo, removerEntrada,
  GAS_INTENSIDADES, GAS_ODORES, GAS_ALIVIO, GAS_SOM, buildGasEntry,
} from './lib/diary.js';
import {
  gerarHistoricoMock, seriePorDia, mediaMovel,
  dorPorRegiao, correlacaoAguaBristol, intervalosRefeicaoDor, correlacaoDefasada, contextoRegiao, gatilhoAlimentar, gatilhoPorTag,
  faseDoCiclo,
  DIA,
} from './lib/insights.js';

const ENTRY_TYPES = {
  meal:       { label: 'Refeição',   icon: Utensils, color: '#C9763A', soft: '#F6E9DD' },
  water:      { label: 'Água',       icon: Droplet,  color: '#3E8E96', soft: '#DEEFEF' },
  sleep:      { label: 'Sono',       icon: Moon,     color: '#5D5FA0', soft: '#E6E5F4' },
  pain:       { label: 'Dor',        icon: Flame,    color: '#BD5A4A', soft: '#F5E1DD' },
  exercise:   { label: 'Exercício',  icon: Activity, color: '#5E8A4E', soft: '#E4EEDF' },
  mood:       { label: 'Humor',      icon: Smile,    color: '#9A6FA0', soft: '#EFE3EE' },
  evacuation: { label: 'Evacuação',  icon: Leaf,     color: '#8A6D3B', soft: '#EFE7D6' },
  gas:        { label: 'Gases',      icon: Wind,     color: '#7C8CA6', soft: '#E6EAF1' },
  medication: { label: 'Medicamento', icon: Pill,    color: '#3F7E6E', soft: '#DDEBE5' },
  cycle:      { label: 'Ciclo',       icon: Droplets, color: '#B5557A', soft: '#F6E1EC' },
};

// Rótulos amigáveis exibidos nos Chips_de_Resumo_do_Dia (RF 2.3).
const CHIP_LABELS = {
  meal: 'Alimentação', water: 'Hidratação', sleep: 'Sono', pain: 'Sintoma',
  exercise: 'Exercício', mood: 'Humor', evacuation: 'Evacuação', gas: 'Gases',
  medication: 'Medicamento',
  cycle: 'Ciclo',
};

// Abas do Menu_Inferior (RF 3.1). Apenas 'diario' é funcional neste incremento.
const NAV_ITEMS = [
  { key: 'diario',   label: 'Diário',   icon: BookOpen },
  { key: 'insights', label: 'Insights', icon: Lightbulb },
  { key: 'habitos',  label: 'Hábitos',  icon: Target },
  { key: 'perfil',   label: 'Perfil',   icon: User },
];

// Alimentos predefinidos (tags) — inclui gatilhos comuns. O usuário pode adicionar
// os seus (persistidos na sessão; Supabase em fase futura).
const FOOD_TAGS = [
  'Feijão', 'Leite', 'Queijo', 'Café', 'Pão/Trigo', 'Arroz', 'Carne vermelha',
  'Frango', 'Ovo', 'Frituras', 'Refrigerante', 'Açúcar/Doce', 'Fruta', 'Mamão',
  'Banana', 'Verduras/Salada', 'Alho/Cebola', 'Álcool', 'Picante', 'Massa',
];

// Medicamentos/suplementos predefinidos (tags). O usuário pode adicionar os seus
// (persistidos na sessão; Supabase em fase futura). Texto factual, sem prescrição
// nem dosagem (RF 15.6).
const MED_TAGS = [
  'Antibiótico', 'Laxante', 'Probiótico', 'Antidepressivo', 'Anti-inflamatório',
  'Analgésico', 'Antiácido', 'Suplemento', 'Vitamina',
];

// ─── Digestive image (base64 webp) ───────────────────────────────────────────
const DIGESTIVE_IMAGE = digestiveImage;

// ─── Zonas de órgãos (pontos de referência em % da imagem) ───────────────────
// Vários pontos por órgão (calibrados na silhueta) para melhorar a precisão do
// mapeamento de toque → órgão. nearestOrgan escolhe o ponto mais próximo.
const ORGAN_LABELS = {
  esofago: 'Esôfago',
  estomago: 'Estômago',
  figado: 'Fígado',
  intestino_delgado: 'Intestino delgado',
  colon_asc: 'Cólon ascendente',
  colon_trans: 'Cólon transverso',
  colon_desc: 'Cólon descendente',
  colon_sig: 'Cólon sigmoide',
  apendice: 'Apêndice',
  reto: 'Reto / Ânus',
};

const ORGAN_POINTS = {
  esofago: [
    [50.7, 26], [50.7, 27.6], [50.7, 29.2], [50.2, 30.6], [49.8, 32.2], [50.2, 33.8],
    [50.2, 35.1], [50.2, 36.8], [50.2, 38.4], [50.2, 39.7], [51.1, 41.4], [51.6, 42.7],
    [53, 44.3], [54.8, 45.5], [55.7, 46.2], [57, 46.9],
  ],
  estomago: [
    [65.2, 49.6], [60.7, 48.9], [63.4, 48.2], [67, 49.9], [69.3, 50.8], [71.1, 52.6],
    [71.1, 54.7], [71.1, 55.6], [71.1, 56.7], [69.8, 57.9], [66.1, 58.6], [63, 58.6],
    [59.3, 58.8], [55.2, 59], [53, 58.8], [50.7, 58.6], [47, 58.1], [44.3, 58.1],
    [41.6, 58.4], [40.2, 58.8], [38.4, 58.6], [38.4, 57.7], [40.2, 56.3], [43.4, 56.3],
    [44.8, 57.4], [47.5, 56.1], [50.2, 56.3], [55.7, 55.4], [57.5, 54.7], [53, 55.8],
    [60.2, 53.3], [60.7, 51.7], [60.7, 49.9], [64.3, 50.5], [63.9, 51.9], [67.5, 52.4],
    [68.9, 54.2], [64.8, 54], [67.5, 54.7], [65.2, 56.1], [64.3, 54.4], [62.5, 54.7],
    [61.6, 56.3], [68.4, 55.8], [59.8, 57.7], [56.1, 56.5], [58, 55.1], [53, 57.4],
    [66.1, 57.7], [63.4, 57],
  ],
  figado: [
    [55.7, 49.6], [55.7, 51], [53.4, 52.6], [50.2, 53.3], [50.7, 51.2], [50.7, 49.6],
    [48.4, 49.2], [43.4, 48.9], [41.6, 48.9], [39.3, 49.4], [36.1, 49.6], [33.9, 49.6],
    [31.6, 50.1], [29.8, 50.8], [28.4, 51.9], [28.4, 53.3], [28.4, 55.1], [28.9, 56.5],
    [28.9, 57.7], [29.3, 58.6], [30.7, 58.8], [32, 57.9], [34.3, 57.4], [36.1, 55.8],
    [38, 54.7], [40.2, 54], [43, 54], [47.5, 53.1], [51.1, 50.1], [46.1, 51], [43, 50.1],
    [42, 51.5], [41.6, 51.9], [34.8, 53.3], [35.7, 51.7], [38, 52.8], [38.9, 51],
    [33.4, 51], [33, 53.1], [31.6, 54.4], [31.6, 56.1],
  ],
  intestino_delgado: [
    [35.2, 65.9], [38.9, 66.6], [47.5, 67.3], [55.2, 68], [62, 68], [66.6, 67.1],
    [64.3, 66.9], [56.1, 68.2], [51.1, 67.8], [44.8, 67.3], [41.6, 67.1], [34.3, 67.5],
    [34.8, 70.5], [35.7, 72.1], [35.7, 74], [35.2, 75.6], [35.7, 77.7], [36.1, 79.5],
    [37.5, 68.9], [38.4, 71.2], [39.3, 74.2], [40.2, 77.2], [40.2, 79], [43, 79.7],
    [43.9, 77.7], [44.3, 75.6], [43.4, 73.5], [42, 71.9], [42, 68.9], [43.9, 70.5],
    [47.5, 69.8], [50.2, 71.2], [48.9, 73.3], [48, 75.4], [48.4, 77.9], [48.4, 79],
    [51.1, 79.9], [55.2, 78.6], [55.7, 76.5], [53, 76.5], [52.5, 73.7], [53.9, 71.9],
    [55.7, 70.8], [53, 69.4], [59.8, 70.3], [60.2, 67.8], [66.1, 68.7], [64.8, 72.1],
    [60.2, 73.5], [61.6, 71], [58.9, 72.6], [61.1, 74.2], [56.1, 74.4], [58.4, 77.2],
    [58.4, 78.8], [52, 78.3], [62.5, 77], [65.2, 75.1], [64.8, 77.9], [61.6, 79], [56.6, 79.5],
  ],
  colon_asc: [
    [31.6, 79], [29.3, 79], [31.6, 77.7], [29.3, 77], [27.5, 76], [28, 74.9], [31.1, 76],
    [31.6, 74.9], [31.1, 73.7], [28.9, 73.3], [28, 72.8], [28.4, 71.4], [31.1, 72.6],
    [31.1, 71.9], [31.1, 70.1], [28.9, 70.3], [27.5, 69.8], [28.4, 68.2], [28.9, 66.6],
    [29.3, 64.8], [30.2, 63.2], [29.8, 62.5], [32.5, 64.8], [32.5, 67.3], [31.1, 67.8],
    [30.2, 70.1], [30.7, 68.9], [32, 69.4], [27.5, 77.7], [26.6, 74.4], [26.6, 78.6],
    [27, 71.7], [28, 65.9],
  ],
  colon_trans: [
    [30.2, 61.1], [33, 60.2], [33.4, 62.5], [33.4, 63.9], [34.3, 60.9], [35.7, 60],
    [37, 61.8], [37.5, 63.4], [38.9, 63.2], [38.9, 61.3], [40.7, 60.9], [40.7, 62.7],
    [40.2, 64.6], [40.7, 65.2], [44.3, 64.3], [42.5, 62.5], [44.8, 62.9], [46.1, 64.8],
    [48, 65.2], [48, 64.1], [45.7, 62.5], [49.3, 63.2], [50.7, 65], [52, 65.5], [53, 64.3],
    [53.4, 64.1], [54.8, 63.4], [54.8, 65.5], [57, 65.7], [59.3, 65.2], [57.5, 63.9],
    [58.9, 63.6], [61.1, 62.7], [60.2, 64.1], [61.6, 65], [62.5, 64.6], [63.9, 64.6],
    [63.4, 62.9], [63.9, 62.7], [67, 63.4], [67.5, 63.9], [68.4, 62], [65.2, 62.3],
    [66.1, 61.3], [69.3, 60.4], [71.1, 61.3], [71.6, 62.5], [69.8, 63.9], [68.9, 64.1],
  ],
  colon_desc: [
    [72, 65.2], [70.2, 66.4], [72.5, 66.4], [72, 68], [73.4, 68.5], [70.2, 68.7],
    [72.5, 69.8], [70.2, 70.3], [72.5, 71.9], [69.3, 71.9], [71.6, 73.3], [69.3, 73.5],
    [73.4, 74.9], [70.7, 75.1], [68.9, 74.9], [71.6, 76.3], [70.7, 76.7], [69.3, 77],
    [72.5, 77.9], [71.1, 78.1], [69.8, 78.1], [68.9, 78.3], [73.4, 64.3],
  ],
  colon_sig: [
    [54.3, 82.2], [58.4, 81.8], [60.2, 82.2], [63, 82], [63, 80.6], [66.1, 81.3],
    [67, 80.9], [68.9, 80.2], [69.8, 79.3], [57, 81.1], [54.3, 81.6], [52, 81.6],
    [56.1, 80.9], [60.7, 81.1], [64.3, 80.6], [69.8, 79.5], [62, 81.8], [57.5, 82.7],
    [56.1, 83.4], [53.9, 83.4], [52.5, 82.7], [55.7, 82], [62.5, 80.4], [67.5, 79.5], [63.4, 82.2],
  ],
  apendice: [
    [33, 81.6], [30.2, 80.6], [29.8, 82.2], [33.4, 82.5], [35.2, 81.6], [36.1, 82.5],
    [37, 83.2], [36.6, 81.6], [37.5, 82.9], [34.8, 84.3], [32.5, 82.5], [30.7, 81.6],
    [28.9, 81.3], [34.8, 83.4], [32, 82.9],
  ],
  reto: [
    [50.2, 83.6], [49.3, 84.3], [49.3, 85.5], [52, 85], [52, 86.8], [51.1, 87.1],
    [50.7, 88.2], [51.6, 88.9], [51.1, 89.6], [50.7, 89.8], [50.7, 90.3],
  ],
};

const ORGAN_ZONES = Object.entries(ORGAN_POINTS).flatMap(([id, pts]) =>
  pts.map(([cx, cy]) => ({ id, label: ORGAN_LABELS[id], cx, cy })),
);

// Lista única de órgãos (para o seletor da ferramenta de calibração).
const ORGAN_LIST = Object.keys(ORGAN_LABELS).map((id) => ({ id, label: ORGAN_LABELS[id] }));

// Centroide de cada órgão (média dos pontos) — usado no mapa de calor da dor.
const ORGAN_CENTROIDES = Object.entries(ORGAN_POINTS).map(([id, pts]) => ({
  id,
  label: ORGAN_LABELS[id],
  cx: pts.reduce((s, [x]) => s + x, 0) / pts.length,
  cy: pts.reduce((s, [, y]) => s + y, 0) / pts.length,
}));

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
  // Tamanho da marca (em % da imagem). Reduzido para permitir marcações mais
  // detalhadas e próximas, já que agora há muito mais pontos de referência.
  const r     = 2.2 + (intensity / 10) * 1.6;
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
    { top: '5%', left: '12%', s: 2, o: 0.85 },  { top: '7%', left: '34%', s: 3, o: 1 },
    { top: '4%', left: '54%', s: 2, o: 0.7 },   { top: '9%', left: '88%', s: 2, o: 0.8 },
    { top: '14%', left: '22%', s: 2, o: 0.75 }, { top: '12%', left: '46%', s: 3, o: 0.95 },
    { top: '16%', left: '68%', s: 2, o: 0.7 },  { top: '18%', left: '90%', s: 2, o: 0.8 },
    { top: '24%', left: '10%', s: 3, o: 0.9 },  { top: '22%', left: '38%', s: 2, o: 0.7 },
    { top: '27%', left: '60%', s: 2, o: 0.75 }, { top: '25%', left: '82%', s: 2, o: 0.7 },
    { top: '33%', left: '18%', s: 2, o: 0.7 },  { top: '36%', left: '44%', s: 3, o: 0.9 },
    { top: '31%', left: '72%', s: 2, o: 0.7 },  { top: '38%', left: '90%', s: 2, o: 0.75 },
    { top: '44%', left: '8%', s: 2, o: 0.7 },   { top: '42%', left: '32%', s: 2, o: 0.65 },
    { top: '46%', left: '56%', s: 3, o: 0.85 }, { top: '48%', left: '78%', s: 2, o: 0.7 },
    { top: '54%', left: '16%', s: 2, o: 0.65 }, { top: '52%', left: '48%', s: 2, o: 0.6 },
    { top: '57%', left: '70%', s: 2, o: 0.7 },  { top: '55%', left: '92%', s: 2, o: 0.6 },
    { top: '63%', left: '24%', s: 3, o: 0.8 },  { top: '66%', left: '52%', s: 2, o: 0.65 },
    { top: '61%', left: '84%', s: 2, o: 0.6 },  { top: '72%', left: '12%', s: 2, o: 0.6 },
    { top: '74%', left: '40%', s: 2, o: 0.55 }, { top: '70%', left: '66%', s: 3, o: 0.7 },
    { top: '78%', left: '88%', s: 2, o: 0.55 }, { top: '82%', left: '30%', s: 2, o: 0.5 },
    { top: '84%', left: '58%', s: 2, o: 0.55 }, { top: '88%', left: '78%', s: 2, o: 0.45 },
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
          {[
            { top: '13%', left: '3%',   w: 108, o: 0.95 },
            { top: '8%',  left: '40%',  w: 70,  o: 0.78 },
            { top: '22%', left: '60%',  w: 92,  o: 0.9 },
            { top: '31%', right: '8%',  w: 66,  o: 0.72 },
            { top: '40%', left: '10%',  w: 84,  o: 0.7 },
            { top: '50%', right: '20%', w: 60,  o: 0.6 },
            { top: '47%', left: '46%',  w: 54,  o: 0.5 },
          ].map((c, i) => (
            <svg key={i} className="absolute"
              style={{ top: c.top, left: c.left, right: c.right, width: c.w, opacity: c.o }}
              viewBox="0 0 100 44">
              <ellipse cx="30" cy="26" rx="22" ry="13" fill="#ffffff" />
              <ellipse cx="55" cy="22" rx="18" ry="14" fill="#ffffff" />
              <ellipse cx="45" cy="32" rx="30" ry="10" fill="#ffffff" />
            </svg>
          ))}
        </>
      )}

      {theme === 'tarde' && (
        <>
          {/* Sol poente */}
          <div className="absolute" style={{
            top: '9%', right: '13%', width: 86, height: 86, borderRadius: '9999px',
            background: 'radial-gradient(circle, #FFE0B0 0%, #FF9E54 60%, rgba(255,158,84,0) 100%)',
          }} />
          {/* Brilho quente de entardecer */}
          <div className="absolute" style={{
            bottom: '6%', left: '50%', transform: 'translateX(-50%)',
            width: 260, height: 220, borderRadius: '9999px',
            background: 'radial-gradient(circle, rgba(255,176,84,0.45) 0%, rgba(255,176,84,0) 70%)',
          }} />
          {/* Nuvens quentes */}
          {[
            { top: '16%', left: '3%',   w: 104, o: 0.88 },
            { top: '10%', left: '42%',  w: 68,  o: 0.7 },
            { top: '27%', right: '9%',  w: 88,  o: 0.8 },
            { top: '37%', left: '12%',  w: 76,  o: 0.66 },
            { top: '46%', right: '20%', w: 58,  o: 0.55 },
            { top: '44%', left: '48%',  w: 52,  o: 0.5 },
          ].map((c, i) => (
            <svg key={i} className="absolute"
              style={{ top: c.top, left: c.left, right: c.right, width: c.w, opacity: c.o }}
              viewBox="0 0 100 44">
              <ellipse cx="30" cy="26" rx="22" ry="13" fill="#FFF1DD" />
              <ellipse cx="55" cy="22" rx="18" ry="14" fill="#FFF1DD" />
              <ellipse cx="45" cy="32" rx="30" ry="10" fill="#FFF1DD" />
            </svg>
          ))}
        </>
      )}

      {theme === 'noite' && (
        <>
          {/* Lua (crescente via sombra interna na cor do céu) */}
          <div className="absolute" style={{
            top: '7%', right: '14%', width: 56, height: 56, borderRadius: '9999px',
            background: '#F4EFD8', boxShadow: 'inset -15px 7px 0 0 #0C1228',
          }} />
          {/* Estrelas */}
          {STARS.map((st, i) => (
            <span key={i} className="absolute rounded-full" style={{
              top: st.top, left: st.left, width: st.s, height: st.s,
              background: '#FBF7E9', opacity: st.o ?? 0.85,
              boxShadow: st.s >= 3 ? '0 0 4px 1px rgba(251,247,233,0.7)' : 'none',
            }} />
          ))}
        </>
      )}
    </div>
  );
}

// ─── Controle de Fonte Cursiva (RF 4) ────────────────────────────────────────
// Vive na aba Perfil (configuração). Estilo adaptável ao tema de fundo:
// ativo = pílula verde; inativo = contorno com a cor de texto do tema.
function CursivaToggle({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      aria-pressed={value}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors shrink-0"
      style={value
        ? { background: 'var(--brand)', borderColor: 'var(--brand)', color: '#fff' }
        : { borderColor: 'rgba(150,140,120,0.5)', color: 'var(--amb-text)', background: 'rgba(255,255,255,0.18)' }}
    >
      <PenLine size={14} />
      {value ? 'Ativada' : 'Desativada'}
    </button>
  );
}

// Toggle opt-in do acompanhamento de ciclo (RF 16.1). Mesmo padrão visual do
// CursivaToggle; padrão desativado vive no estado do App.
function CycleToggle({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      aria-pressed={value}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors shrink-0"
      style={value
        ? { background: 'var(--brand)', borderColor: 'var(--brand)', color: '#fff' }
        : { borderColor: 'rgba(150,140,120,0.5)', color: 'var(--amb-text)', background: 'rgba(255,255,255,0.18)' }}
    >
      <Droplets size={14} />
      {value ? 'Ativado' : 'Desativado'}
    </button>
  );
}

// ─── Cabeçalho Hero (RF 2.1) ──────────────────────────────────────────────────
// `colapsado` recolhe o hero para uma barra de marca fininha ao rolar a timeline.
// Os dois estados compartilham a mesma árvore (sem remontar) e animam via CSS.
function HeroHeader({ colapsado = false }) {
  return (
    <header
      className={`relative z-10 shrink-0 px-5 overflow-hidden transition-all duration-300 ease-in-out ${colapsado ? 'pt-3 pb-2' : 'pt-6 pb-4'}`}
      style={{ background: 'var(--brand-deep)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/* "Diário" — recolhe suavemente (altura/opacidade) no estado colapsado */}
          <div
            className="overflow-hidden transition-all duration-300 ease-in-out"
            style={{ maxHeight: colapsado ? 0 : '1.75rem', opacity: colapsado ? 0 : 1 }}
          >
            <p className="text-xl font-serif leading-none" style={{ color: 'rgba(255,255,255,0.95)' }}>Diário</p>
          </div>
          <p
            className={`leading-[1.1] transition-all duration-300 ease-in-out ${colapsado ? 'text-2xl mt-0' : 'text-5xl mt-0.5'}`}
            style={{ fontFamily: '"Caveat", "Segoe Print", "Bradley Hand", cursive', color: '#fff' }}>
            Intestinal
          </p>
          {/* Subtítulo — recolhe suavemente no estado colapsado */}
          <div
            className="overflow-hidden transition-all duration-300 ease-in-out"
            style={{ maxHeight: colapsado ? 0 : '3rem', opacity: colapsado ? 0 : 1 }}
          >
            <p className="mt-2 text-sm max-w-[58%]" style={{ color: 'rgba(255,255,255,0.8)' }}>
              Acompanhe seu intestino, entenda seu corpo.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" aria-label="Buscar"
            className={`rounded-full flex items-center justify-center text-white transition-all duration-300 ease-in-out ${colapsado ? 'w-8 h-8' : 'w-9 h-9'}`}
            style={{ background: 'rgba(255,255,255,0.14)' }}>
            <Search size={colapsado ? 16 : 18} />
          </button>
          <button type="button" aria-label="Menu"
            className={`rounded-full flex items-center justify-center text-white transition-all duration-300 ease-in-out ${colapsado ? 'w-8 h-8' : 'w-9 h-9'}`}
            style={{ background: 'rgba(255,255,255,0.14)' }}>
            <EllipsisVertical size={colapsado ? 16 : 18} />
          </button>
        </div>
      </div>

      {/* Mascote — encolhe e sobe para caber na barra fina ao colapsar */}
      <img
        src={mascoteImage}
        alt="Mascote do Diário Intestinal"
        className={`absolute object-contain select-none pointer-events-none drop-shadow-lg transition-all duration-300 ease-in-out ${colapsado ? 'right-14 top-2 w-12 h-12' : 'right-3 top-9 w-28 h-28'}`}
        draggable={false}
      />
    </header>
  );
}

// ─── Card de Resumo do Dia (RF 2.2, 2.3) ──────────────────────────────────────
// `colapsado` recolhe o card para um strip fino (só o cabeçalho), ocultando
// suavemente os chips e a linha do ciclo. Os dados permanecem montados.
function DaySummaryCard({ dateLabel, entries, cicloAtivo = false, colapsado = false }) {
  const contagens = contarPorTipo(entries, 'hoje');
  const itens = Object.keys(ENTRY_TYPES).filter((k) => contagens[k] > 0);

  // "Agora" estável durante a vida do componente (evita chamada impura no render).
  const [agora] = useState(() => Date.now());

  // Fase_do_Ciclo (RF 16.3/16.5): só quando o acompanhamento está ativo e há ao
  // menos um registro de ciclo com data de início. Usa o início mais recente.
  // Texto factual, sem juízo de normalidade ou recomendação (RF 6/16.6).
  let ciclo = null;
  if (cicloAtivo) {
    const inicios = entries
      .filter((e) => e.type === 'cycle' && Number.isFinite(e.meta?.inicioTs))
      .map((e) => e.meta.inicioTs);
    if (inicios.length) {
      const ultimoInicio = Math.max(...inicios);
      const f = faseDoCiclo(ultimoInicio, agora);
      if (f.fase !== 'desconhecida') ciclo = f;
    }
  }

  return (
    <div className={`relative z-20 mx-5 mb-0 shrink-0 rounded-2xl border border-[#EDE7DD] transition-all duration-300 ease-in-out ${colapsado ? 'p-2 -mt-3 shadow-[0_8px_18px_-12px_rgba(0,0,0,0.4)]' : 'p-4 -mt-7 shadow-[0_16px_32px_-12px_rgba(0,0,0,0.5)]'}`}
      style={{ background: 'var(--card)' }}>
      <div className={`flex items-center justify-between gap-2 transition-all duration-300 ease-in-out ${colapsado ? 'mb-0' : 'mb-3'}`}>
        <button type="button" className="titulo-cursivo flex items-center gap-1 text-base font-serif text-[#2B2A28]">
          {dateLabel}
          <ChevronDown size={16} className="text-[#B6AE9F]" />
        </button>
        <span className="titulo-cursivo flex items-center gap-1.5 text-sm font-serif" style={{ color: 'var(--brand)' }}>
          <ChartColumn size={15} />
          Resumo do dia
        </span>
      </div>

      {/* Área recolhível: chips por categoria + eventual linha do ciclo */}
      <div className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: colapsado ? 0 : '320px', opacity: colapsado ? 0 : 1 }}>
        {itens.length === 0 ? (
          <p className="text-sm text-[#B6AE9F]">Nenhum registro hoje ainda.</p>
        ) : (
          <div className="flex gap-4 overflow-x-auto">
            {itens.map((k) => {
              const meta = ENTRY_TYPES[k];
              const Icon = meta.icon;
              return (
                <div key={k} className="flex flex-col items-center gap-1 min-w-[58px] shrink-0">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ background: meta.soft, color: meta.color }}>
                    <Icon size={18} />
                  </div>
                  <span className="text-lg font-semibold leading-none" style={{ color: meta.color }}>{contagens[k]}</span>
                  <span className="text-[11px] text-[#7D766A]">{CHIP_LABELS[k]}</span>
                </div>
              );
            })}
          </div>
        )}

        {ciclo && (
          <p className="mt-3 pt-3 border-t border-[#F1ECE3] text-xs text-[#7D766A]">
            Ciclo: fase {ciclo.fase} (dia {ciclo.diaDoCiclo})
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Menu de Navegação Inferior (RF 3) ────────────────────────────────────────
function NavTab({ item, active, onClick }) {
  const Icon = item.icon;
  return (
    <button type="button" onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className="flex-1 flex flex-col items-center gap-0.5 py-1 transition-colors"
      style={{ color: active ? 'var(--brand)' : '#9A938A' }}>
      <Icon size={20} strokeWidth={active ? 2.4 : 2} />
      <span className="text-[10px] font-medium">{item.label}</span>
    </button>
  );
}

function BottomNav({ abaAtiva, onChangeAba, onAdd }) {
  const [esq, dir] = [NAV_ITEMS.slice(0, 2), NAV_ITEMS.slice(2)];
  return (
    <nav className="absolute bottom-0 left-0 right-0 z-20 flex items-end bg-white border-t border-[#EDE7DD] px-2 pt-2 pb-3"
      style={{ boxShadow: '0 -10px 26px -8px rgba(0,0,0,0.3)' }}>
      {esq.map((item) => (
        <NavTab key={item.key} item={item} active={abaAtiva === item.key} onClick={() => onChangeAba(item.key)} />
      ))}
      <div className="flex-1 flex justify-center">
        <button type="button" onClick={onAdd} aria-label="Adicionar registro"
          className="-mt-7 w-14 h-14 rounded-full text-white flex items-center justify-center active:scale-95 transition-transform"
          style={{ background: 'var(--brand)', boxShadow: '0 10px 22px -8px rgba(31,61,43,0.7)' }}>
          <Plus size={26} />
        </button>
      </div>
      {dir.map((item) => (
        <NavTab key={item.key} item={item} active={abaAtiva === item.key} onClick={() => onChangeAba(item.key)} />
      ))}
    </nav>
  );
}

// ─── Tela reservada para abas futuras (RF 3.6) ────────────────────────────────
function PlaceholderScreen({ item }) {
  const Icon = item.icon;
  return (
    <main className="relative z-10 flex-1 overflow-y-auto px-5 pb-28 flex flex-col items-center justify-center text-center">
      <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
        style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>
        <Icon size={28} />
      </div>
      <p className="titulo-cursivo text-2xl font-serif" style={{ color: 'var(--amb-text)' }}>{item.label}</p>
      <p className="text-sm mt-1" style={{ color: 'var(--amb-text)', opacity: 0.7 }}>Em breve.</p>
    </main>
  );
}

// ─── Tela de Perfil (configurações — hospeda a Fonte Cursiva, RF 4) ───────────
function ProfileScreen({ cursiva, onCursiva, inkLevel, onInk, fontScale, onFont, cicloAtivo, onCiclo }) {
  return (
    <main className="relative z-10 flex-1 overflow-y-auto px-5 pt-3 pb-28">
      <p className="titulo-cursivo text-2xl font-serif mb-4" style={{ color: 'var(--amb-text)' }}>Perfil</p>
      <div className="rounded-2xl bg-white border border-[#EDE7DD] p-4 shadow-[0_10px_24px_-10px_rgba(31,42,40,0.4)]">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#B6AE9F] mb-3">Aparência</p>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="entry-text text-sm font-medium text-[#2B2A28]">Fonte cursiva</p>
            <p className="text-xs text-[#7D766A] mt-0.5">Letra manuscrita nos títulos e nos registros</p>
          </div>
          <CursivaToggle value={cursiva} onChange={onCursiva} />
        </div>

        <div className="mt-4 pt-4 border-t border-[#F1ECE3]">
          <div className="flex items-center justify-between gap-3">
            <p className="entry-text text-sm font-medium text-[#2B2A28]">Intensidade do texto</p>
            <span className="text-xs text-[#7D766A] tabular-nums">{inkLevel}%</span>
          </div>
          <p className="text-xs text-[#7D766A] mt-0.5 mb-2">Deixa as letras dos registros mais fortes ou mais suaves</p>
          <input type="range" min={0} max={100} value={inkLevel}
            onChange={(e) => onInk(Number(e.target.value))}
            className="w-full" style={{ accentColor: 'var(--brand)' }} />
          <p className="entry-text text-sm mt-2 leading-snug" style={{ color: 'var(--ink, #4A443F)' }}>
            Exemplo de texto do registro neste nível de intensidade.
          </p>
        </div>

        <div className="mt-4 pt-4 border-t border-[#F1ECE3]">
          <div className="flex items-center justify-between gap-3">
            <p className="entry-text text-sm font-medium text-[#2B2A28]">Tamanho do texto</p>
            <span className="text-xs text-[#7D766A] tabular-nums">{fontScale}%</span>
          </div>
          <p className="text-xs text-[#7D766A] mt-0.5 mb-2">Aumenta a letra dos registros para facilitar a leitura</p>
          <input type="range" min={100} max={140} step={5} value={fontScale}
            onChange={(e) => onFont(Number(e.target.value))}
            className="w-full" style={{ accentColor: 'var(--brand)' }} />
        </div>
      </div>

      {/* Ciclo menstrual — acompanhamento opt-in (RF 16.1/16.5) */}
      <div className="mt-4 rounded-2xl bg-white border border-[#EDE7DD] p-4 shadow-[0_10px_24px_-10px_rgba(31,42,40,0.4)]">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#B6AE9F] mb-3">Ciclo</p>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="entry-text text-sm font-medium text-[#2B2A28]">Acompanhar ciclo menstrual</p>
            <p className="text-xs text-[#7D766A] mt-0.5">Marque o início da menstruação para ver a fase estimada do ciclo.</p>
          </div>
          <CycleToggle value={cicloAtivo} onChange={onCiclo} />
        </div>
      </div>

      <p className="text-xs mt-4" style={{ color: 'var(--amb-text)', opacity: 0.6 }}>Mais opções de perfil em breve.</p>
    </main>
  );
}

// ─── Insights: gráfico de tendência com crosshair sincronizado ───────────────
function TrendChart({ serie, color, hover, onHover }) {
  if (!serie || serie.length < 2) {
    return <p className="text-xs text-[#9A938A] mt-2">Dados insuficientes para o gráfico.</p>;
  }
  const n = serie.length;
  const vals = serie.map((p) => p.valor);
  const maxV = Math.max(1, ...vals);
  const pts = serie.map((p, i) => `${(i / (n - 1)) * 100},${100 - (p.valor / maxV) * 100}`).join(' ');

  const mover = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - rect.left) / rect.width) * (n - 1));
    onHover(Math.max(0, Math.min(n - 1, i)));
  };

  const x = hover != null && hover >= 0 && hover < n ? (hover / (n - 1)) * 100 : null;
  const y = x != null ? 100 - (serie[hover].valor / maxV) * 100 : null;

  return (
    <div className="relative w-full h-20 mt-2" style={{ touchAction: 'none' }}
      onPointerMove={mover} onPointerDown={mover} onPointerLeave={() => onHover(null)}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" aria-hidden="true">
        <polygon points={`0,100 ${pts} 100,100`} fill={color} opacity="0.12" />
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
          vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      {x != null && (
        <>
          <div className="absolute top-0 bottom-0 w-px" style={{ left: `${x}%`, background: 'rgba(80,70,60,0.35)' }} />
          <div className="absolute w-2.5 h-2.5 rounded-full border-2 border-white"
            style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)', background: color }} />
        </>
      )}
    </div>
  );
}

function MetricCard({ titulo, color, serie, unidade, casas = 0, hover, onHover }) {
  const vals = serie.map((p) => p.valor);
  const media = vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : 0;
  const focado = hover != null && serie[hover] ? serie[hover].valor : null;
  return (
    <div className="rounded-2xl bg-white border border-[#EDE7DD] p-4 shadow-[0_8px_22px_-12px_rgba(31,42,40,0.35)]">
      <div className="flex items-baseline justify-between gap-2">
        <p className="entry-text text-sm font-medium text-[#2B2A28]">{titulo}</p>
        <span className="text-sm font-semibold" style={{ color }}>
          {(focado != null ? focado : media).toFixed(casas)}{unidade}
        </span>
      </div>
      <p className="text-[11px] text-[#9A938A]">{focado != null ? 'no dia em foco' : 'média no período'}</p>
      <TrendChart serie={serie} color={color} hover={hover} onHover={onHover} />
    </div>
  );
}

// ─── Tela de Insights (usa Historico_Mock; Diário usa os registros do dia) ────
function forcaTexto(r) {
  const a = Math.abs(r);
  if (a < 0.2) return 'sem relação clara';
  if (a < 0.4) return 'correlação fraca';
  if (a < 0.6) return 'correlação moderada';
  return 'correlação forte';
}

// Mapa de calor da dor por região do corpo (RF 9.3) — tocar filtra a contagem.
function PainHeatmap({ history }) {
  const counts = useMemo(() => dorPorRegiao(history), [history]);
  const [sel, setSel] = useState(null);
  const ctx = useMemo(() => (sel ? contextoRegiao(history, sel) : null), [sel, history]);
  const valores = Object.values(counts);
  const max = Math.max(1, ...valores);
  const total = valores.reduce((s, x) => s + x, 0);
  return (
    <div className="rounded-2xl bg-white border border-[#EDE7DD] p-4 shadow-[0_8px_22px_-12px_rgba(31,42,40,0.35)]">
      <p className="entry-text text-sm font-medium text-[#2B2A28] mb-1">Onde a dor aparece</p>
      {total === 0 ? (
        <p className="text-xs text-[#9A938A]">Sem registros de dor com região definida.</p>
      ) : (
        <>
          <div className="relative mx-auto" style={{ width: 190, aspectRatio: '374/740' }}>
            <img src={DIGESTIVE_IMAGE} alt="Mapa de dor no corpo"
              className="absolute inset-0 w-full h-full object-contain select-none" draggable={false} />
            {ORGAN_CENTROIDES.map((o) => {
              const c = counts[o.id] || 0;
              if (!c) return null;
              const r = 10 + (c / max) * 22;
              return (
                <button key={o.id} type="button" onClick={() => setSel(o.id)} aria-label={`${o.label}: ${c}`}
                  className="absolute rounded-full" style={{
                    left: `${o.cx}%`, top: `${o.cy}%`, width: r, height: r, transform: 'translate(-50%,-50%)',
                    background: `rgba(189,90,74,${0.3 + (c / max) * 0.5})`,
                    border: sel === o.id ? '2px solid #BD5A4A' : '2px solid rgba(255,255,255,0.7)',
                  }} />
              );
            })}
          </div>
          {sel && ctx ? (
            <div className="mt-3 rounded-xl bg-[#FAF7F2] border border-[#EFE7DD] p-3 text-xs leading-snug" style={{ color: 'var(--ink, #4A443F)' }}>
              <p className="font-semibold" style={{ color: '#2B2A28' }}>{ORGAN_LABELS[sel]}</p>
              <p>{ctx.n} registro(s) · {Math.round(ctx.share * 100)}% das suas dores · intensidade média {ctx.intensidadeMedia.toFixed(1)}/10</p>
              {ctx.aguaNesses != null && ctx.aguaGeral != null && (
                <p className="mt-0.5">Água nesses dias: ~{ctx.aguaNesses.toFixed(1)} copos/dia (sua média: {ctx.aguaGeral.toFixed(1)})</p>
              )}
              {ctx.sonoNesses != null && ctx.sonoGeral != null && (
                <p>Sono nesses dias: ~{ctx.sonoNesses.toFixed(1)}/5 (sua média: {ctx.sonoGeral.toFixed(1)})</p>
              )}
              {ctx.humorMedio != null && (
                <p className="mt-0.5">Humor médio nesses dias: ~{ctx.humorMedio.toFixed(1)}/5</p>
              )}
              {ctx.bristolMedio != null && (
                <p>Consistência média nesses dias: Bristol ~{ctx.bristolMedio.toFixed(1)}</p>
              )}
              {ctx.alimentosFrequentes.length > 0 && (
                <div className="mt-1.5">
                  <p>Alimentos mais registrados nesses dias:</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {ctx.alimentosFrequentes.map((a) => (
                      <span key={a.tag}
                        className="inline-flex items-center rounded-full bg-[#EFE7DD] px-2 py-0.5 text-[11px] text-[#4A443F]">
                        {a.tag} ({a.n})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-center mt-2 text-[#9A938A]">Toque numa região para ver os detalhes</p>
          )}
        </>
      )}
    </div>
  );
}

// Card de cruzamento com explicação expansível ("O que isso significa?").
function CrossCard({ titulo, explicacao, children }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="rounded-2xl bg-white border border-[#EDE7DD] p-4 shadow-[0_8px_22px_-12px_rgba(31,42,40,0.35)]">
      <p className="entry-text text-sm font-medium text-[#2B2A28] mb-1">{titulo}</p>
      {children}
      <button type="button" onClick={() => setAberto((a) => !a)}
        className="mt-2 text-xs font-medium underline" style={{ color: 'var(--brand)' }}>
        {aberto ? 'ocultar' : 'O que isso significa?'}
      </button>
      {aberto && (
        <p className="text-xs mt-1 leading-snug" style={{ color: '#6E665E' }}>{explicacao}</p>
      )}
    </div>
  );
}

// Linha do tempo da dor — "scrubber" estilo player: arrastar revela as dores
// marcadas ao longo do tempo, numa janela deslizante (RF 9.7).
function PainScrubber({ history }) {
  const pains = useMemo(() => history
    .filter((e) => e.type === 'pain' && e.organ && ORGAN_POINTS[e.organ])
    .map((e) => {
      const pts = ORGAN_POINTS[e.organ];
      const [x, y] = pts[Math.abs(Math.floor(e.ts / 60000)) % pts.length];
      return { ts: e.ts, x, y, intensity: e.intensity || 5 };
    })
    .sort((a, b) => a.ts - b.ts), [history]);
  const [pos, setPos] = useState(100);

  if (pains.length < 2) return null;

  const min = pains[0].ts;
  const max = pains[pains.length - 1].ts;
  const focusTs = min + (pos / 100) * (max - min);
  // Janela móvel proporcional ao período exibido (~1/4 do span dos dados).
  const span = max - min;
  const janela = Math.max(DIA, Math.round(span / 4));
  const diasJanela = Math.max(1, Math.round(janela / DIA));

  return (
    <div className="rounded-2xl bg-white border border-[#EDE7DD] p-4 shadow-[0_8px_22px_-12px_rgba(31,42,40,0.35)]">
      <div className="flex items-baseline justify-between mb-1">
        <p className="entry-text text-sm font-medium text-[#2B2A28]">Linha do tempo da dor</p>
        <span className="text-xs tabular-nums text-[#7D766A]">{fmtData(focusTs, true)}</span>
      </div>
      <div className="relative mx-auto" style={{ width: 190, aspectRatio: '374/740' }}>
        <img src={DIGESTIVE_IMAGE} alt="Silhueta" className="absolute inset-0 w-full h-full object-contain select-none" draggable={false} />
        {pains.map((p, i) => {
          const dt = focusTs - p.ts;
          if (dt < 0 || dt > janela) return null;
          const rec = 1 - dt / janela;
          const r = 8 + (p.intensity / 10) * 8;
          return (
            <span key={i} className="absolute rounded-full" style={{
              left: `${p.x}%`, top: `${p.y}%`, width: r, height: r, transform: 'translate(-50%,-50%)',
              background: corIntensidade(p.intensity), opacity: 0.25 + rec * 0.7,
              border: '1px solid rgba(255,255,255,0.85)',
            }} />
          );
        })}
      </div>
      <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))}
        className="w-full mt-3" style={{ accentColor: 'var(--brand)' }} aria-label="Linha do tempo da dor" />
      <p className="text-[11px] text-[#9A938A] mt-1">Arraste para percorrer as dores marcadas no período selecionado (janela móvel de ~{diasJanela} dia(s)).</p>
    </div>
  );
}

// Cards de cruzamento factual (RF 9.4–9.6), incluindo correlação defasada.
function CrossingsSection({ history }) {
  const ab = useMemo(() => correlacaoAguaBristol(history), [history]);
  const rd = useMemo(() => intervalosRefeicaoDor(history, 6), [history]);
  const sd = useMemo(() => {
    const sono = seriePorDia(history, 'sleep', 'quality', 'media').map((p) => p.valor);
    const dor = seriePorDia(history, 'pain', 'intensity', 'media').map((p) => p.valor);
    return correlacaoDefasada(sono, dor, 4, 14);
  }, [history]);
  const gat = useMemo(() => gatilhoAlimentar(history, 'gas', 12), [history]);
  const med = useMemo(() => gatilhoPorTag(history, 'medication', 'gas', 12), [history]);

  const txt = { color: 'var(--ink, #4A443F)' };
  const sub = 'text-[11px] text-[#9A938A] mt-1';
  const insuf = <p className="text-xs text-[#9A938A]">Dados insuficientes — continue registrando.</p>;

  return (
    <div className="space-y-3">
      <CrossCard titulo="Água e consistência (Bristol)"
        explicacao="Comparo quanta água você bebe por dia com a consistência média das fezes (escala de Bristol). O número r vai de −1 a +1: perto de 0 indica pouca relação; perto de ±1, relação mais forte. É uma observação dos seus dados — não é causa nem diagnóstico.">
        {ab.status === 'ok' ? (
          <>
            <p className="entry-text text-sm leading-snug" style={txt}>
              {ab.r > 0.2 ? 'Nos dias com mais água, a consistência registrada tende a ser mais macia (Bristol mais alto).'
                : ab.r < -0.2 ? 'Nos dias com mais água, a consistência registrada tende a ser mais firme (Bristol mais baixo).'
                  : 'Não há relação clara entre água e a consistência nos seus registros.'}
            </p>
            <p className={sub}>{forcaTexto(ab.r)} · r = {ab.r.toFixed(2)} · {ab.n} dias</p>
          </>
        ) : insuf}
      </CrossCard>

      <CrossCard titulo="Refeição → dor (tempo até aparecer)"
        explicacao="Olho quanto tempo costuma passar entre uma refeição e uma dor que aparece em seguida (até 6 h depois) e mostro o tempo típico. Isso não significa que a refeição causou a dor — é só o intervalo observado nos seus registros.">
        {rd.status === 'ok' ? (
          <>
            <p className="entry-text text-sm leading-snug" style={txt}>
              A dor costuma aparecer ~{rd.mediana.toFixed(1)} h após as refeições.
            </p>
            <p className={sub}>em {rd.n} ocasiões (janela de 6 h)</p>
          </>
        ) : insuf}
      </CrossCard>

      <CrossCard titulo="Sono e dor (com defasagem)"
        explicacao="Testo se a qualidade do sono de um dia se relaciona com a intensidade da dor registrada alguns dias depois. A 'defasagem' é esse atraso (em dias) com a relação mais forte. Correlação não é causa — é um padrão observado nos seus registros.">
        {sd.status === 'ok' ? (
          <>
            <p className="entry-text text-sm leading-snug" style={txt}>
              Nos seus registros, a qualidade do sono se relaciona com a intensidade da dor com defasagem de ~{sd.lag} dia(s).
            </p>
            <p className={sub}>{forcaTexto(sd.r)} · r = {sd.r.toFixed(2)} · {sd.n} pares</p>
          </>
        ) : insuf}
      </CrossCard>

      <CrossCard titulo="Alimento e gases"
        explicacao="Comparo a frequência de gases logo após refeições que tinham um alimento vs. refeições sem ele, usando o horário (mesmo atravessando a madrugada). É uma observação dos seus dados — não prova que o alimento causa os gases.">
        {gat.status === 'ok' ? (
          <>
            <p className="entry-text text-sm leading-snug" style={txt}>
              Após refeições com {gat.tag}, você registrou gases em até {gat.janelaHoras}h em {Math.round(gat.taxaCom * 100)}% das vezes (sem {gat.tag}: {Math.round(gat.taxaSem * 100)}%).
            </p>
            {gat.risco != null && gat.risco >= 1.5 && (
              <p className="entry-text text-sm leading-snug" style={txt}>
                Isso é ~{gat.risco.toFixed(1)}x mais frequente do que sem {gat.tag}.
              </p>
            )}
            <p className={sub}>{gat.n} refeições com {gat.tag}</p>
          </>
        ) : insuf}
      </CrossCard>

      <CrossCard titulo="Medicamento e sintoma"
        explicacao="Comparo a frequência de gases logo após registros de um medicamento vs. registros sem ele, usando o horário (mesmo atravessando a madrugada). É uma observação dos seus dados — não prova que o medicamento causa o sintoma.">
        {med.status === 'ok' ? (
          <>
            <p className="entry-text text-sm leading-snug" style={txt}>
              Após registros de {med.tag}, você registrou gases em até {med.janelaHoras}h em {Math.round(med.taxaCom * 100)}% das vezes (sem {med.tag}: {Math.round(med.taxaSem * 100)}%).
            </p>
            {med.risco != null && med.risco >= 1.5 && (
              <p className="entry-text text-sm leading-snug" style={txt}>
                Isso é ~{med.risco.toFixed(1)}x mais frequente do que sem {med.tag}.
              </p>
            )}
            <p className={sub}>{med.n} registros com {med.tag}</p>
          </>
        ) : insuf}
      </CrossCard>
    </div>
  );
}

// Utilitários de data para o calendário/Insights.
const SEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DIA_MS = 24 * 60 * 60 * 1000;
function inicioDiaUTC(ts) { const d = new Date(ts); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); }
function fmtData(ts, comDiaSemana) {
  const d = new Date(ts);
  const base = `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  return comDiaSemana ? `${SEM[d.getUTCDay()]} ${base}` : base;
}

// Mini-calendário mensal: toca um dia (seleção única) ou um segundo dia (intervalo).
function CalendarPicker({ minTs, maxTs, range, onRange, single = false }) {
  const [mes, setMes] = useState(() => { const d = new Date(range.fim); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; });
  const minD = inicioDiaUTC(minTs);
  const maxD = inicioDiaUTC(maxTs);
  const primeiro = Date.UTC(mes.y, mes.m, 1);
  const diaSemInicio = new Date(primeiro).getUTCDay();
  const diasNoMes = new Date(Date.UTC(mes.y, mes.m + 1, 0)).getUTCDate();
  const podeVoltar = primeiro > minD;
  const podeAvancar = Date.UTC(mes.y, mes.m + 1, 1) <= maxD;
  const iniD = inicioDiaUTC(range.ini);
  const fimD = inicioDiaUTC(range.fim);

  const tapDia = (dia) => {
    const ts = Date.UTC(mes.y, mes.m, dia);
    if (ts < minD || ts > maxD) return;
    if (single) {
      onRange({ ini: ts, fim: ts });
    } else if (iniD === fimD && ts !== iniD) {
      onRange({ ini: Math.min(iniD, ts), fim: Math.max(iniD, ts) + DIA_MS - 1 });
    } else {
      onRange({ ini: ts, fim: ts + DIA_MS - 1 });
    }
  };

  const cells = [];
  for (let i = 0; i < diaSemInicio; i += 1) cells.push(null);
  for (let d = 1; d <= diasNoMes; d += 1) cells.push(d);

  return (
    <div className="rounded-2xl bg-white border border-[#EDE7DD] p-3 mt-2 shadow-[0_8px_22px_-12px_rgba(31,42,40,0.35)]">
      <div className="flex items-center justify-between mb-2">
        <button type="button" disabled={!podeVoltar} aria-label="Mês anterior"
          onClick={() => setMes(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }))}
          className="w-7 h-7 flex items-center justify-center text-[#7D766A] disabled:opacity-30"><ChevronLeft size={18} /></button>
        <span className="text-sm font-medium text-[#2B2A28]">{MES[mes.m]} {mes.y}</span>
        <button type="button" disabled={!podeAvancar} aria-label="Próximo mês"
          onClick={() => setMes(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }))}
          className="w-7 h-7 flex items-center justify-center text-[#7D766A] disabled:opacity-30"><ChevronRight size={18} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {SEM.map((s) => <span key={s} className="text-[10px] text-[#B6AE9F]">{s}</span>)}
        {cells.map((d, i) => {
          if (d == null) return <span key={`e${i}`} />;
          const ts = Date.UTC(mes.y, mes.m, d);
          const dentro = ts >= minD && ts <= maxD;
          const sel = ts >= iniD && ts <= fimD;
          return (
            <button key={d} type="button" disabled={!dentro} onClick={() => tapDia(d)}
              className="h-7 rounded-md text-xs transition-colors"
              style={sel ? { background: 'var(--brand)', color: '#fff' } : { color: dentro ? '#5C5650' : '#D8D1C4' }}>
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function InsightsScreen() {
  const history = useMemo(() => gerarHistoricoMock(), []);
  const bounds = useMemo(() => {
    const ts = history.map((e) => e.ts);
    return { min: Math.min(...ts), max: Math.max(...ts) };
  }, [history]);
  const lastDay = inicioDiaUTC(bounds.max);
  const preset = (nn) => ({ ini: lastDay - (nn - 1) * DIA_MS, fim: lastDay + DIA_MS - 1 });

  const [range, setRange] = useState(() => preset(30));
  const [presetAtivo, setPresetAtivo] = useState(30);
  const [calAberto, setCalAberto] = useState(false);
  const [hover, setHover] = useState(null);
  const [suavizar, setSuavizar] = useState(false);

  const aplicaPreset = (nn) => { setRange(preset(nn)); setPresetAtivo(nn); setHover(null); };
  const aplicaRange = (r) => { setRange(r); setPresetAtivo(null); setHover(null); };

  const hist = useMemo(() => history.filter((e) => e.ts >= range.ini && e.ts <= range.fim), [history, range]);

  const prep = (type, campo, modo) => {
    const s = seriePorDia(hist, type, campo, modo);
    return suavizar ? mediaMovel(s, 7) : s;
  };
  const agua = prep('water', 'glasses', 'soma');
  const dor = prep('pain', 'intensity', 'media');
  const sono = prep('sleep', 'quality', 'media');
  const humor = prep('mood', 'score', 'media');
  const exercicio = prep('exercise', 'minutes', 'soma');

  const umDia = inicioDiaUTC(range.ini) === inicioDiaUTC(range.fim);
  const rangeLabel = umDia ? fmtData(range.ini, true) : `${fmtData(range.ini)} – ${fmtData(range.fim)}`;
  const foco = hover != null && agua[hover] ? fmtData(agua[hover].dia, true) : rangeLabel;

  const periodos = [7, 30, 60, 90];
  const btn = (ativo) => (ativo
    ? { background: 'var(--brand)', borderColor: 'var(--brand)', color: '#fff' }
    : { borderColor: 'rgba(150,140,120,0.4)', color: 'var(--amb-text)', background: 'rgba(255,255,255,0.5)' });

  return (
    <main className="relative z-10 flex-1 overflow-y-auto px-5 pb-28">
      <div className="sticky top-0 z-20 -mx-5 px-5 pt-3 pb-2"
        style={{ background: 'var(--amb-bg-1)', boxShadow: '0 6px 12px -10px rgba(0,0,0,0.5)' }}>
        <div className="flex items-baseline justify-between">
          <p className="titulo-cursivo text-2xl font-serif" style={{ color: 'var(--amb-text)' }}>Insights</p>
          <span className="text-xs tabular-nums" style={{ color: 'var(--amb-text)', opacity: 0.85 }}>{foco}</span>
        </div>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {periodos.map((p) => (
            <button key={p} type="button" onClick={() => aplicaPreset(p)}
              className="px-3 py-1 rounded-full text-xs font-medium border transition-colors"
              style={btn(presetAtivo === p)}>{p}d</button>
          ))}
          <button type="button" aria-label="Escolher no calendário" onClick={() => setCalAberto((v) => !v)}
            className="px-2.5 py-1 rounded-full border flex items-center" style={btn(calAberto || presetAtivo === null)}>
            <Calendar size={14} />
          </button>
          <button type="button" onClick={() => setSuavizar((v) => !v)} aria-pressed={suavizar}
            className="ml-auto px-3 py-1 rounded-full text-xs font-medium border transition-colors" style={btn(suavizar)}>
            Suavizar
          </button>
        </div>
        {calAberto && (
          <CalendarPicker minTs={bounds.min} maxTs={bounds.max} range={range} onRange={aplicaRange} />
        )}
      </div>

      {/* Backdrop transparente: fecha o calendário ao clicar fora. O CalendarPicker
          vive na toolbar (z-20), acima deste backdrop (z-10), então não se fecha
          ao ser clicado; cliques nos cards abaixo fecham. */}
      {calAberto && <div className="fixed inset-0 z-10" onClick={() => setCalAberto(false)} />}

      <div className="space-y-3 mt-3">
        <MetricCard titulo="Hidratação" color={ENTRY_TYPES.water.color} serie={agua} unidade=" copos/dia" casas={suavizar ? 1 : 0} hover={hover} onHover={setHover} />
        <MetricCard titulo="Intensidade da dor" color={ENTRY_TYPES.pain.color} serie={dor} unidade="/10" casas={1} hover={hover} onHover={setHover} />
        <MetricCard titulo="Qualidade do sono" color={ENTRY_TYPES.sleep.color} serie={sono} unidade="/5" casas={1} hover={hover} onHover={setHover} />
        <MetricCard titulo="Humor" color={ENTRY_TYPES.mood.color} serie={humor} unidade="/5" casas={1} hover={hover} onHover={setHover} />
        <MetricCard titulo="Exercício" color={ENTRY_TYPES.exercise.color} serie={exercicio} unidade=" min/dia" casas={0} hover={hover} onHover={setHover} />
      </div>

      <p className="titulo-cursivo text-lg font-serif mt-5 mb-2" style={{ color: 'var(--amb-text)' }}>Onde dói</p>
      <PainHeatmap history={hist} />
      <div className="mt-3"><PainScrubber history={hist} /></div>

      <p className="titulo-cursivo text-lg font-serif mt-5 mb-2" style={{ color: 'var(--amb-text)' }}>Cruzamentos</p>
      <CrossingsSection history={hist} />

      <p className="text-[11px] mt-4 leading-snug" style={{ color: 'var(--amb-text)', opacity: 0.6 }}>
        Use os botões 7/30/60/90 ou o calendário (dia ou intervalo) — todas as seções seguem o mesmo período. Observações dos seus próprios registros; não substituem avaliação profissional.
      </p>
    </main>
  );
}

// ─── Calibração de pontos de dor (FERRAMENTA TEMPORÁRIA / DEV) ─────────────────
// Permite tocar na silhueta e capturar coordenadas (cx, cy em % da imagem) já no
// formato do ORGAN_ZONES. Remover após concluir o mapeamento.
function CalibrationOverlay({ onClose }) {
  const boxRef = useRef(null);
  const [organId, setOrganId] = useState(ORGAN_LIST[0].id);
  const [points, setPoints] = useState([]);
  const organ = ORGAN_LIST.find((o) => o.id === organId);

  const handleClick = (e) => {
    const r = boxRef.current.getBoundingClientRect();
    const cx = Math.round(((e.clientX - r.left) / r.width) * 1000) / 10;
    const cy = Math.round(((e.clientY - r.top) / r.height) * 1000) / 10;
    const p = { id: organ.id, label: organ.label, cx, cy };
    setPoints((prev) => [...prev, p]);
    console.log(`{ id: '${p.id}', label: '${p.label}', cx: ${cx}, cy: ${cy} },`);
  };

  const linhas = points
    .map((p) => `  { id: '${p.id}', label: '${p.label}', cx: ${p.cx}, cy: ${p.cy} },`)
    .join('\n');

  return (
    <div className="absolute inset-0 z-40 bg-white flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#EDE7DD] shrink-0">
        <p className="font-serif text-base text-[#2B2A28]">Calibração de pontos</p>
        <button type="button" onClick={onClose} className="text-[#B6AE9F]"><X size={20} /></button>
      </div>

      <div className="px-4 py-3 shrink-0">
        <label className="text-xs font-semibold uppercase tracking-wide text-[#B6AE9F]">Órgão atual</label>
        <select value={organId} onChange={(e) => setOrganId(e.target.value)}
          className="w-full mt-1 rounded-xl border border-[#EDE7DD] p-2 text-sm">
          {ORGAN_LIST.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <p className="text-xs text-[#7D766A] mt-1">Toque na ilustração para capturar pontos do órgão selecionado.</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div ref={boxRef} onClick={handleClick}
          className="relative mx-auto cursor-crosshair" style={{ width: 220, aspectRatio: '374/740' }}>
          <img src={DIGESTIVE_IMAGE} alt="Silhueta" className="absolute inset-0 w-full h-full object-contain select-none" draggable={false} />
          {points.map((p, i) => (
            <span key={i} className="absolute rounded-full"
              style={{ left: `${p.cx}%`, top: `${p.cy}%`, width: 8, height: 8, transform: 'translate(-50%,-50%)', background: '#BD5A4A', border: '1px solid #fff' }} />
          ))}
        </div>

        <div className="flex items-center justify-between mt-3 mb-1">
          <span className="text-xs text-[#7D766A]">{points.length} ponto(s)</span>
          <button type="button" onClick={() => setPoints([])} className="text-xs text-[#BD5A4A]">Limpar</button>
        </div>
        <textarea readOnly value={linhas} rows={8}
          onFocus={(e) => e.target.select()}
          className="w-full rounded-xl border border-[#EDE7DD] p-2 text-xs font-mono resize-none"
          placeholder="As coordenadas capturadas aparecem aqui…" />
      </div>
    </div>
  );
}

// ─── Form: Dor ────────────────────────────────────────────────────────────────
function PainForm({ onSave }) {
  const [clouds,    setClouds]    = useState([]);
  const [intensity, setIntensity] = useState(5);
  const [kinds,     setKinds]     = useState(new Set());
  const [showOrgans, setShowOrgans] = useState(false);
  const color = ENTRY_TYPES.pain.color;
  const kindOptions = ['Cólica', 'Queimação', 'Pressão', 'Pontada', 'Distensão'];

  const handleTap = ({ x, y, organ }) => {
    setClouds((prev) => {
      // toggle: remove apenas se o toque cair bem em cima de um ponto já marcado
      // (raio pequeno para permitir marcações próximas sem desmarcar a vizinha)
      const idx = prev.findIndex((c) => Math.abs(c.x - x) < 2.5 && Math.abs(c.y - y) < 2.5);
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
            style={{ color: showOrgans ? '#BD5A4A' : 'var(--brand)', borderColor: showOrgans ? '#F5E1DD' : '#EDE7DD' }}
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
      <SaveButton color={color} onClick={() => {
        const kindStr = kinds.size ? Array.from(kinds).join(' · ') : '';
        const orgStr  = uniqueOrgans.join(' · ');
        const desc    = [kindStr, orgStr].filter(Boolean).join(' · ') || 'Dor abdominal';
        onSave({ title: 'Dor abdominal', description: desc, meta: { clouds, intensity } });
      }} />
    </div>
  );
}

// ─── Other forms (meal, water, sleep, exercise, mood) ────────────────────────
function MealForm({ onSave, customFoods, onAddCustom }) {
  const [mealType, setMealType] = useState('Café da manhã');
  const [tags, setTags] = useState(new Set());
  const [novo, setNovo] = useState('');
  const [detalhes, setDetalhes] = useState(false);
  const [ritmo, setRitmo] = useState(null);
  const [saciedade, setSaciedade] = useState(null);
  const color = ENTRY_TYPES.meal.color;
  const types = ['Café da manhã', 'Almoço', 'Jantar', 'Lanche'];
  const RITMOS = ['Rápido', 'Normal', 'Devagar'];
  const SACIEDADE = ['Leve', 'Satisfeito', 'Muito cheio'];
  const todasTags = [...FOOD_TAGS, ...customFoods];

  const toggleTag = (t) => setTags((s) => { const n = new Set(s); if (n.has(t)) n.delete(t); else n.add(t); return n; });
  const addCustom = () => {
    const t = novo.trim();
    if (!t) return;
    if (!FOOD_TAGS.includes(t) && !customFoods.includes(t)) onAddCustom(t);
    setTags((s) => new Set(s).add(t));
    setNovo('');
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#B6AE9F] mb-2">Tipo de refeição</p>
        <div className="flex flex-wrap gap-2">
          {types.map((t) => <Chip key={t} active={mealType === t} color={color} onClick={() => setMealType(t)}>{t}</Chip>)}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#B6AE9F] mb-2">Alimentos</p>
        <div className="flex flex-wrap gap-2">
          {todasTags.map((t) => <Chip key={t} active={tags.has(t)} color={color} onClick={() => toggleTag(t)}>{t}</Chip>)}
        </div>
        <div className="flex gap-2 mt-2">
          <input value={novo} onChange={(e) => setNovo(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
            placeholder="Adicionar alimento…"
            className="flex-1 rounded-xl border border-[#EDE7DD] p-2 text-sm focus:outline-none" />
          <button type="button" onClick={addCustom}
            className="w-10 rounded-xl text-white flex items-center justify-center" style={{ background: color }}>
            <Plus size={18} />
          </button>
        </div>
      </div>

      <button type="button" onClick={() => setDetalhes((d) => !d)}
        className="text-xs font-medium underline" style={{ color: 'var(--brand)' }}>
        {detalhes ? '− menos detalhes' : '+ detalhes (opcional)'}
      </button>

      {detalhes && (
        <>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#B6AE9F] mb-2">Ritmo ao comer</p>
            <div className="flex flex-wrap gap-2">
              {RITMOS.map((r) => <Chip key={r} active={ritmo === r} color={color} onClick={() => setRitmo(ritmo === r ? null : r)}>{r}</Chip>)}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#B6AE9F] mb-2">Como ficou depois?</p>
            <div className="flex flex-wrap gap-2">
              {SACIEDADE.map((s) => <Chip key={s} active={saciedade === s} color={color} onClick={() => setSaciedade(saciedade === s ? null : s)}>{s}</Chip>)}
            </div>
          </div>
        </>
      )}

      <SaveButton color={color} onClick={() => {
        const lista = [...tags];
        const desc = lista.length ? lista.join(' · ') : 'Sem alimentos marcados';
        onSave({ title: mealType, description: desc, meta: { tags: lista, ritmo, saciedade } });
      }} />
    </div>
  );
}

// Registro de Medicamento (RF 15) — espelha o MealForm (tags predefinidas +
// personalizadas), de baixa fricção e sem campos obrigatórios. Sem prescrição,
// dosagem obrigatória, diagnóstico ou recomendação (RF 15.6).
function MedicationForm({ onSave, customMeds, onAddCustom }) {
  const [tags, setTags] = useState(new Set());
  const [novo, setNovo] = useState('');
  const color = ENTRY_TYPES.medication.color;
  const todasTags = [...MED_TAGS, ...customMeds];

  const toggleTag = (t) => setTags((s) => { const n = new Set(s); if (n.has(t)) n.delete(t); else n.add(t); return n; });
  const addCustom = () => {
    const t = novo.trim();
    if (!t) return;
    if (!MED_TAGS.includes(t) && !customMeds.includes(t)) onAddCustom(t);
    setTags((s) => new Set(s).add(t));
    setNovo('');
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#B6AE9F] mb-2">Medicamentos</p>
        <div className="flex flex-wrap gap-2">
          {todasTags.map((t) => <Chip key={t} active={tags.has(t)} color={color} onClick={() => toggleTag(t)}>{t}</Chip>)}
        </div>
        <div className="flex gap-2 mt-2">
          <input value={novo} onChange={(e) => setNovo(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
            placeholder="Adicionar medicamento…"
            className="flex-1 rounded-xl border border-[#EDE7DD] p-2 text-sm focus:outline-none" />
          <button type="button" onClick={addCustom}
            className="w-10 rounded-xl text-white flex items-center justify-center" style={{ background: color }}>
            <Plus size={18} />
          </button>
        </div>
      </div>

      <SaveButton color={color} onClick={() => {
        const lista = [...tags];
        const desc = lista.length ? lista.join(' · ') : 'Sem medicamento marcado';
        onSave({ title: 'Medicamento', description: desc, meta: { tags: lista } });
      }} />
    </div>
  );
}

// Registro de Ciclo (RF 16.2/16.4) — fricção mínima: só a data de início é
// obrigatória (default = hoje). Fluxo, cólica e contraceptivo são opcionais e
// revelados via "+ detalhes". Texto factual, sem diagnóstico ou recomendação
// (RF 6/16.6). Salva mesmo só com a data.
function CycleForm({ onSave }) {
  // Limites do calendário e seleção inicial em epoch ms (UTC), início do dia.
  // Lazy initializer evita chamar Date.now() de forma impura no corpo do render.
  const [maxTs] = useState(() => inicioDiaUTC(Date.now()));
  const minTs = maxTs - 365 * DIA;
  const [inicioTs, setInicioTs] = useState(() => inicioDiaUTC(Date.now()));
  const [detalhes, setDetalhes] = useState(false);
  const [fluxo, setFluxo] = useState(null);          // 'Leve'|'Moderado'|'Intenso' ou null
  const [colica, setColica] = useState(null);        // 1–5 ou null
  const [contraceptivo, setContraceptivo] = useState(null); // true|false|null
  const color = ENTRY_TYPES.cycle.color;
  const FLUXOS = ['Leve', 'Moderado', 'Intenso'];

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#B6AE9F]">Início da menstruação</p>
          <span className="text-xs tabular-nums text-[#7D766A]">{fmtData(inicioTs, true)}</span>
        </div>
        <CalendarPicker single minTs={minTs} maxTs={maxTs}
          range={{ ini: inicioTs, fim: inicioTs }} onRange={(r) => setInicioTs(r.ini)} />
      </div>

      <button type="button" onClick={() => setDetalhes((d) => !d)}
        className="text-xs font-medium underline" style={{ color: 'var(--brand)' }}>
        {detalhes ? '− menos detalhes' : '+ detalhes (opcional)'}
      </button>

      {detalhes && (
        <>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#B6AE9F] mb-2">Fluxo</p>
            <div className="flex flex-wrap gap-2">
              {FLUXOS.map((f) => <Chip key={f} active={fluxo === f} color={color} onClick={() => setFluxo(fluxo === f ? null : f)}>{f}</Chip>)}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#B6AE9F] mb-2">Cólica</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <button key={i} type="button" onClick={() => setColica(colica === i ? null : i)}
                  className="flex-1 h-10 rounded-xl border text-sm font-medium transition-colors"
                  style={colica === i ? { background: color, borderColor: color, color: '#fff' } : { borderColor: '#EDE7DD', color: '#7D766A' }}>
                  {i}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#B6AE9F] mb-2">Contraceptivo</p>
            <div className="flex gap-2">
              <Chip active={contraceptivo === true} color={color} onClick={() => setContraceptivo(contraceptivo === true ? null : true)}>Sim</Chip>
              <Chip active={contraceptivo === false} color={color} onClick={() => setContraceptivo(contraceptivo === false ? null : false)}>Não</Chip>
            </div>
          </div>
        </>
      )}

      <SaveButton color={color} onClick={() => {
        // inicioTs já é epoch ms (UTC), início do dia escolhido no calendário.
        const desc = fluxo ? `Início da menstruação · fluxo ${fluxo.toLowerCase()}` : 'Início da menstruação';
        onSave({
          title: 'Ciclo',
          description: desc,
          meta: { inicio: true, inicioTs, fluxo, colica, contraceptivo },
        });
      }} />
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
      <SaveButton color={color} onClick={() => {
        const sel = options.find((o) => o.v === mood) || options[2];
        onSave({ title: 'Humor', description: `${sel.emoji} ${sel.label}` });
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
  const [conforto, setConforto] = useState(null); // nota subjetiva 1–5 ou null (RF 10)
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

      {/* Nota subjetiva de conforto (1–5, opcional — RF 10) */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#B6AE9F] mb-2">Como você se sentiu? (opcional)</p>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <button key={i} type="button" onClick={() => setConforto(conforto === i ? null : i)}
              className="flex-1 h-10 rounded-xl border text-sm font-medium transition-colors"
              style={conforto === i ? { background: color, borderColor: color, color: '#fff' } : { borderColor: '#EDE7DD', color: '#7D766A' }}>
              {i}
            </button>
          ))}
        </div>
      </div>

      <SaveButton color={color}
        onClick={() => onSave(buildEvacuationEntry({ bristol, cor, odor, esforco, tempo, conforto }))} />
    </div>
  );
}

// ─── Etapa de Observação (empurrão suave antes de salvar) ─────────────────────
function ObservationStep({ onConfirm }) {
  const [note, setNote] = useState('');
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);
  const Rec = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

  const toggleMic = () => {
    if (!Rec) return;
    if (listening) { if (recRef.current) recRef.current.stop(); return; }
    try {
      const r = new Rec();
      r.lang = 'pt-BR';
      r.interimResults = false;
      r.continuous = false;
      r.onresult = (e) => {
        const t = Array.from(e.results).map((x) => x[0].transcript).join(' ');
        setNote((prev) => (prev ? `${prev} ${t}` : t));
      };
      r.onend = () => setListening(false);
      r.onerror = () => setListening(false);
      recRef.current = r;
      setListening(true);
      r.start();
    } catch {
      setListening(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="titulo-cursivo font-serif text-lg text-[#2B2A28]">Quer anotar uma observação?</p>
        <p className="text-sm text-[#7D766A] mt-1">Uma nota rápida enriquece seu histórico — algo que vai além dos números.</p>
      </div>
      <div className="relative">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          autoFocus
          placeholder="Ex: começou ~40 min após o almoço, junto com estufamento…"
          className="w-full rounded-xl border border-[#EDE7DD] p-3 pr-12 text-sm resize-none focus:outline-none"
        />
        <button type="button" onClick={toggleMic} disabled={!Rec}
          aria-label="Ditar observação por voz"
          title={Rec ? 'Ditar por voz' : 'Ditado por voz não suportado neste navegador'}
          className="absolute right-2 bottom-2 w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-40"
          style={listening ? { background: '#E53935', color: '#fff' } : { background: 'var(--brand-soft)', color: 'var(--brand)' }}>
          <Mic size={18} />
        </button>
      </div>
      <SaveButton color="var(--brand)" onClick={() => onConfirm(note.trim())} label="Salvar registro" />
      <button type="button" onClick={() => onConfirm('')}
        className="w-full py-2.5 rounded-2xl border text-sm font-medium"
        style={{ borderColor: '#E4DDD2', color: '#7D766A', background: '#FAF7F2' }}>
        Salvar sem observação
      </button>
    </div>
  );
}

// ─── Form: Gases ──────────────────────────────────────────────────────────────
function GasForm({ onSave }) {
  const [intensidade, setIntensidade] = useState(null);
  const [odor, setOdor] = useState(null);
  const [alivio, setAlivio] = useState(null);
  const [som, setSom] = useState(null);
  const color = ENTRY_TYPES.gas.color;

  const linha = (label, opcoes, val, set) => (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-[#B6AE9F] mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {opcoes.map((o) => (
          <Chip key={o} active={val === o} color={color} onClick={() => set(val === o ? null : o)}>{o}</Chip>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {linha('Intensidade', GAS_INTENSIDADES, intensidade, setIntensidade)}
      {linha('Odor', GAS_ODORES, odor, setOdor)}
      {linha('Alívio', GAS_ALIVIO, alivio, setAlivio)}
      {linha('Som', GAS_SOM, som, setSom)}
      <SaveButton color={color} onClick={() => onSave(buildGasEntry({ intensidade, odor, alivio, som }))} />
    </div>
  );
}

// ─── Entry card ───────────────────────────────────────────────────────────────
// Cor da intensidade de dor: verde (baixa) → vermelho (alta).
function corIntensidade(v) {
  const n = Math.max(1, Math.min(10, Number(v) || 1));
  const hue = Math.round(120 - ((n - 1) / 9) * 120);
  return `hsl(${hue}, 65%, 42%)`;
}

// Barra tipo termômetro (verde → vermelho) com marcador na intensidade.
function IntensityBar({ value }) {
  const n = Math.max(1, Math.min(10, Number(value) || 1));
  const pct = ((n - 1) / 9) * 100;
  return (
    <div className="relative h-2 rounded-full mt-2"
      style={{ background: 'linear-gradient(90deg,#4CAF50,#A8C34A,#F2C200,#F08C2E,#E53935)' }}>
      <span className="absolute top-1/2 w-4 h-4 rounded-full border-2 border-white"
        style={{ left: `${pct}%`, transform: 'translate(-50%,-50%)', background: corIntensidade(n), boxShadow: '0 1px 3px rgba(0,0,0,0.35)' }} />
    </div>
  );
}

// Texto que recolhe/expande quando longo (ver mais / ver menos).
function ExpandableText({ text, max = 90 }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  const longo = text.length > max;
  const exibir = !longo || open ? text : `${text.slice(0, max).trimEnd()}…`;
  return (
    <>
      {exibir}
      {longo && (
        <button type="button"
          onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
          className="ml-1 text-xs font-medium underline align-baseline"
          style={{ color: 'var(--brand)' }}>
          {open ? 'ver menos' : 'ver mais'}
        </button>
      )}
    </>
  );
}

// ─── Zoom da silhueta (overlay sobre a tela, sem sair do Diário) ──────────────
function SilhouetteZoom({ entry, onClose }) {
  const organs = [...new Set((entry.meta?.clouds || []).map((c) => c.organLabel).filter(Boolean))];
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center p-6"
      style={{ background: 'rgba(20,18,16,0.55)', backdropFilter: 'blur(2px)' }} onClick={onClose}>
      <div className="relative bg-white rounded-3xl p-4 w-full max-w-[330px]" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="Fechar"
          className="absolute right-3 top-3 z-10 text-[#B6AE9F]"><X size={20} /></button>
        <p className="titulo-cursivo font-serif text-base text-[#2B2A28] mb-1">{entry.title} · {entry.time}</p>
        {entry.meta && (
          <p className="text-xs mb-2" style={{ color: corIntensidade(entry.meta.intensity) }}>
            Intensidade {entry.meta.intensity}/10
          </p>
        )}
        <Silhouette clouds={entry.meta?.clouds || []} intensity={entry.meta?.intensity || 5} showOrgans />
        {organs.length > 0 && (
          <p className="text-xs text-center text-[#7D766A] mt-2">{organs.join(' · ')}</p>
        )}
        <p className="text-[10px] text-center text-[#B6AE9F] mt-2">Toque fora para fechar</p>
      </div>
    </div>
  );
}

function EntryCard({ entry, onDelete, onZoom }) {
  const meta = ENTRY_TYPES[entry.type];
  const Icon = meta.icon;
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="relative flex-1 min-w-0 flex gap-3 bg-white rounded-2xl border border-[#EDE7DD] p-3 items-start shadow-[0_10px_22px_-8px_rgba(31,42,40,0.4)]">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: meta.soft, color: meta.color }}>
        <Icon size={18} strokeWidth={2.2} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="entry-text font-medium text-[#2B2A28] text-[0.95em] break-words">{entry.title}</p>
        <p className="entry-text text-[0.95em] mt-0.5 leading-snug break-words" style={{ color: 'var(--ink, #4A443F)' }}>
          <ExpandableText text={entry.description} />
        </p>

        {entry.type === 'pain' && entry.meta && (
          <div className="mt-2 rounded-2xl p-3 flex items-center gap-3" style={{ background: meta.soft }}>
            <div className="flex-1 min-w-0">
              <p className="entry-text text-xs font-medium" style={{ color: '#6E5F57' }}>Intensidade da dor</p>
              <p className="entry-text text-2xl font-semibold leading-none mt-0.5"
                style={{ color: corIntensidade(entry.meta.intensity) }}>
                {entry.meta.intensity}/10
              </p>
              <IntensityBar value={entry.meta.intensity} />
            </div>
            {entry.meta.clouds?.length > 0 && (
              <button type="button" onClick={() => onZoom && onZoom(entry)} aria-label="Ampliar silhueta"
                className="shrink-0 rounded-2xl overflow-hidden bg-white p-1 cursor-zoom-in" style={{ width: 88 }}>
                <Silhouette clouds={entry.meta.clouds} intensity={entry.meta.intensity} showOrgans />
              </button>
            )}
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
              <span className="text-xs text-[#7D766A]">{entry.meta.tempo} min</span>
            )}
            {entry.meta.conforto && (
              <span className="text-xs text-[#7D766A]">Conforto {entry.meta.conforto}/5</span>
            )}
          </div>
        )}

        {/* Observação (qualquer tipo) — distinta da descrição (barra à esquerda), recolhível */}
        {entry.meta?.note && (
          <div className="mt-1.5 pl-2 border-l-2" style={{ borderColor: 'var(--brand-soft)' }}>
            <p className="entry-text text-xs leading-snug break-words" style={{ color: 'var(--ink-soft, #6E665E)' }}>
              <ExpandableText text={entry.meta.note} />
            </p>
          </div>
        )}
      </div>

      {/* Menu de Ações do Registro (RF 2.6, 2.7) */}
      <div className="relative shrink-0">
        <button type="button" aria-label="Ações do registro" aria-haspopup="menu" aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
          className="w-7 h-7 rounded-full flex items-center justify-center text-[#B6AE9F] hover:bg-[#F1ECE3]">
          <EllipsisVertical size={16} />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div role="menu" className="absolute right-0 top-8 z-20 bg-white rounded-xl border border-[#EDE7DD] shadow-md py-1 min-w-[132px]">
              <button type="button" role="menuitem"
                onClick={() => { setMenuOpen(false); onDelete(entry.id); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[#F8EDEA]"
                style={{ color: '#BD5A4A' }}>
                <Trash2 size={14} /> Remover
              </button>
            </div>
          </>
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
  const [cursiva,    setCursiva]    = useState(true);                                 // RF 4.1 (padrão ligado)
  const [abaAtiva,   setAbaAtiva]   = useState('diario');                             // RF 3.2 (padrão Diário)
  const [calibrando, setCalibrando] = useState(false);                                // ferramenta dev (temporária)
  const [pending,    setPending]    = useState(null);                                 // etapa de observação antes de salvar
  const [customFoods, setCustomFoods] = useState([]);                                 // tags de alimentos personalizadas (sessão)
  const [customMeds, setCustomMeds]   = useState([]);                                 // tags de medicamentos personalizadas (sessão)
  const [inkLevel,   setInkLevel]   = useState(55);                                   // intensidade (brilho) da cor do texto
  const [fontScale,  setFontScale]  = useState(100);                                  // tamanho do texto dos registros (%)
  const [zoom,       setZoom]       = useState(null);                                   // entrada com silhueta ampliada
  const [cicloAtivo, setCicloAtivo] = useState(false);                                  // acompanhamento de ciclo opt-in (RF 16.1)
  const [diarioScroll, setDiarioScroll] = useState(0);                                  // posição de rolagem da timeline (collapse-on-scroll)
  const idRef = useRef(100);

  // Cabeçalho recolhível: ao rolar a timeline além do limiar, Hero e Resumo encolhem.
  // O gate por aba garante que Perfil/Hábitos nunca exibam o estado recolhido.
  const heroColapsado = abaAtiva === 'diario' && diarioScroll > 40;

  // Atalho oculto para a ferramenta de calibração de pontos (dev): Ctrl+Shift+K
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'K' || e.key === 'k')) {
        e.preventDefault();
        setCalibrando((c) => !c);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const dayOrder  = ['hoje', 'ontem'];
  const dayLabels = { hoje: 'Registros do dia', ontem: 'Ontem' };

  const grouped = {};
  dayOrder.forEach((d) => {
    grouped[d] = entries.filter((e) => e.day === d).sort((a, b) => a.time.localeCompare(b.time));
  });

  function persistEntry(type, data) {
    const now  = new Date();
    const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    idRef.current += 1;
    setEntries((prev) => [...prev, { id: idRef.current, day: 'hoje', time, type, ...data }]);
  }

  // Passo 1: ao salvar, abre a etapa de observação (empurrão suave) em vez de
  // persistir imediatamente.
  function requestSave(type, data) {
    setPending({ type, data });
  }

  // Passo 2: confirma com (ou sem) observação e persiste o registro.
  function commitSave(note) {
    if (!pending) return;
    const { type, data } = pending;
    const meta = { ...(data.meta || {}) };
    if (note) meta.note = note;
    const finalData = { ...data };
    if (Object.keys(meta).length) finalData.meta = meta;
    persistEntry(type, finalData);
    setPending(null);
    setActiveForm(null);
  }

  function handleDelete(id) {
    setEntries((prev) => removerEntrada(prev, id)); // RF 2.7 (núcleo puro)
  }

  const inkL = 38 - (inkLevel / 100) * 22;            // 38% (mais claro) → 16% (mais forte)
  const inkColor = `hsl(30, 8%, ${inkL}%)`;
  const inkSoftColor = `hsl(30, 7%, ${inkL + 10}%)`;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#EDE7DD] sm:p-6 font-sans">
      <div
        data-theme={tema}
        className={`relative w-full max-w-[420px] h-screen sm:h-[844px] sm:rounded-[2.5rem] sm:shadow-2xl overflow-hidden flex flex-col ${cursiva ? 'cursiva' : ''}`}
        style={{ background: 'linear-gradient(180deg, var(--amb-bg-1) 0%, var(--amb-bg-2) 100%)', '--ink': inkColor, '--ink-soft': inkSoftColor, '--font-scale': fontScale / 100 }}
      >
        {/* Ambiência decorativa de fundo (atrás de todo o conteúdo) */}
        <AmbianceLayer theme={tema} />

        {abaAtiva !== 'insights' && <HeroHeader colapsado={heroColapsado} />}

        {abaAtiva === 'diario' ? (
          <>
            {/* Card de Resumo do Dia (RF 2.2, 2.3) — elevado e com sombra sobre os eventos */}
            <DaySummaryCard dateLabel="Sexta-feira, 12 de junho" entries={entries} cicloAtivo={cicloAtivo} colapsado={heroColapsado} />

            {/* Timeline conectada (RF 2.4–2.8) */}
            <main className="relative z-10 flex-1 overflow-y-auto px-5 pb-28"
              onScroll={(e) => setDiarioScroll(e.currentTarget.scrollTop)}
              style={{ fontSize: 'calc(1rem * var(--font-scale, 1))' }}>
              {dayOrder.map((day) => (
                grouped[day].length > 0 && (
                  <section key={day} className="mb-6">
                    <p className="titulo-cursivo text-lg font-serif mb-3" style={{ color: 'var(--amb-text)' }}>{dayLabels[day]}</p>
                    <div className="relative">
                      {/* Fio_Conector: linha vertical pontilhada passando pelos círculos de horário */}
                      <span aria-hidden="true" className="absolute top-3 bottom-3"
                        style={{ left: '27px', borderLeftWidth: 2, borderLeftStyle: 'dotted', borderLeftColor: 'var(--amb-text)', opacity: 0.4 }} />
                      <div className="space-y-3">
                        {grouped[day].map((entry) => {
                          const meta = ENTRY_TYPES[entry.type];
                          return (
                            <div key={entry.id} className="relative flex gap-3 items-start">
                              {/* Horário à esquerda, dentro de um círculo ligado pelo fio */}
                              <div className="w-14 shrink-0 flex justify-center pt-1">
                                <span className="relative z-[1] w-12 h-12 rounded-full flex items-center justify-center text-[11px] font-semibold tabular-nums"
                                  style={{ background: 'var(--card)', border: `2px solid ${meta.color}`, color: meta.color, boxShadow: '0 4px 10px -3px rgba(0,0,0,0.38)' }}>
                                  {entry.time}
                                </span>
                              </div>
                              <EntryCard entry={entry} onDelete={handleDelete} onZoom={setZoom} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </section>
                )
              ))}
            </main>
          </>
        ) : abaAtiva === 'insights' ? (
          <InsightsScreen />
        ) : abaAtiva === 'perfil' ? (
          <ProfileScreen cursiva={cursiva} onCursiva={setCursiva} inkLevel={inkLevel} onInk={setInkLevel} fontScale={fontScale} onFont={setFontScale} cicloAtivo={cicloAtivo} onCiclo={setCicloAtivo} />
        ) : (
          <PlaceholderScreen item={NAV_ITEMS.find((i) => i.key === abaAtiva)} />
        )}

        {/* Menu de Navegação Inferior (RF 3) */}
        <BottomNav abaAtiva={abaAtiva} onChangeAba={setAbaAtiva} onAdd={() => setSheetOpen(true)} />

        {/* Ferramenta temporária de calibração de pontos (dev) */}
        {calibrando && <CalibrationOverlay onClose={() => setCalibrando(false)} />}

        {/* Zoom da silhueta do registro de dor */}
        {zoom && <SilhouetteZoom entry={zoom} onClose={() => setZoom(null)} />}

        {/* Sheet: type picker */}
        <div className={`absolute inset-0 transition-opacity duration-300 z-20 ${sheetOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
          <div className="absolute inset-0 bg-black/30" onClick={() => setSheetOpen(false)} />
          <div className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-5 pb-8 transition-transform duration-300 ${sheetOpen ? 'translate-y-0' : 'translate-y-full'}`}>
            <div className="w-10 h-1.5 bg-[#EDE7DD] rounded-full mx-auto mb-4" />
            <p className="titulo-cursivo text-center font-serif text-lg text-[#2B2A28] mb-4">O que você quer registrar?</p>
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(ENTRY_TYPES).filter(([key]) => key !== 'cycle' || cicloAtivo).map(([key, meta]) => {
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
          <div className="absolute inset-0 bg-black/30" onClick={() => { setPending(null); setActiveForm(null); }} />
          <div className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl flex flex-col max-h-[92%] transition-transform duration-300 ${activeForm ? 'translate-y-0' : 'translate-y-full'}`}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[#F1ECE3] shrink-0">
              <button onClick={() => { if (pending) setPending(null); else { setActiveForm(null); setSheetOpen(true); } }} className="text-[#B6AE9F]">
                <ChevronLeft size={20} />
              </button>
              <p className="titulo-cursivo font-serif text-base text-[#2B2A28]">{activeForm && ENTRY_TYPES[activeForm].label}</p>
              <button onClick={() => { setPending(null); setActiveForm(null); }} className="text-[#B6AE9F]"><X size={20} /></button>
            </div>
            <div className="px-5 py-4 overflow-y-auto flex-1">
              {pending ? (
                <ObservationStep onConfirm={commitSave} />
              ) : (
                <>
                  {activeForm === 'meal'     && <MealForm     onSave={(d) => requestSave('meal', d)} customFoods={customFoods} onAddCustom={(t) => setCustomFoods((c) => [...c, t])} />}
                  {activeForm === 'water'    && <WaterForm    onSave={(d) => requestSave('water',    d)} />}
                  {activeForm === 'sleep'    && <SleepForm    onSave={(d) => requestSave('sleep',    d)} />}
                  {activeForm === 'pain'     && <PainForm     onSave={(d) => requestSave('pain',     d)} />}
                  {activeForm === 'exercise' && <ExerciseForm onSave={(d) => requestSave('exercise', d)} />}
                  {activeForm === 'mood'     && <MoodForm     onSave={(d) => requestSave('mood',     d)} />}
                  {activeForm === 'evacuation' && <EvacuationForm onSave={(d) => requestSave('evacuation', d)} />}
                  {activeForm === 'gas' && <GasForm onSave={(d) => requestSave('gas', d)} />}
                  {activeForm === 'medication' && <MedicationForm onSave={(d) => requestSave('medication', d)} customMeds={customMeds} onAddCustom={(t) => setCustomMeds((c) => [...c, t])} />}
                  {activeForm === 'cycle' && <CycleForm onSave={(d) => requestSave('cycle', d)} />}
                </>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
