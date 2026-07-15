import digestiveClosedImage from './assets/sisdiges_fechado.jpg';
import mascoteImage from './assets/mascote.png';
import capaExemplo from './assets/capaexemplo.jpg';
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  Plus, X, ChevronLeft, Utensils, Droplet, Moon, Flame, Activity, Smile, Mic, Check, Minus,
  Leaf, PenLine, EllipsisVertical, ChartColumn, Trash2, Pencil,
  BookOpen, Lightbulb, GraduationCap, User, ChevronDown, ChevronRight, Calendar, Wind, Pill, Droplets,
  ArrowLeft, Cast, Lock, Play, Clock, BarChart3, CheckCircle2, ShoppingBag, Heart, Pencil as PencilIcon,
  Scale, Stethoscope, HelpCircle,
} from 'lucide-react';
import OnboardingModal from './components/OnboardingModal';
import {
  BRISTOL_DESCRICOES, EVAC_CORES, EVAC_ODORES, buildEvacuationEntry,
  periodoDoDia, horaLocalAtual, contarPorTipo, removerEntrada,
  GAS_INTENSIDADES, GAS_ODORES, GAS_ALIVIO, GAS_SOM, buildGasEntry,
} from './lib/diary.js';
import {
  gerarHistoricoMock, seriePorDia, mediaMovel,
  correlacaoAguaBristol, intervalosRefeicaoDor, correlacaoDefasada, gatilhoAlimentar, gatilhoPorTag,
  faseDoCiclo,
  DIA,
} from './lib/insights.js';
import RelatoriasIAScreen from './components/RelatoriasIAScreen';
import RelatorioExpressScreen from './components/RelatorioExpressScreen';
import PainHeatmap from './components/PainHeatmap';
import BristolImage from './components/BristolImage';
import { CORES_TINT, BRISTOL_CURTOS, COR_PADRAO_TINT } from './lib/bristol-tints.js';
import bristol1 from './assets/bristol/bristol-1.png';
import bristol2 from './assets/bristol/bristol-2.png';
import bristol3 from './assets/bristol/bristol-3.png';
import bristol4 from './assets/bristol/bristol-4.png';
import bristol5 from './assets/bristol/bristol-5.png';
import bristol6 from './assets/bristol/bristol-6.png';
import bristol7 from './assets/bristol/bristol-7.png';

const BRISTOL_IMGS = { 1: bristol1, 2: bristol2, 3: bristol3, 4: bristol4, 5: bristol5, 6: bristol6, 7: bristol7 };
import { CONDICOES_LABELS, loadProfile, saveProfile, isOnboarded } from './lib/profile.js';
import { proximaConsulta, addConsulta, removeConsulta } from './lib/consulta.js';

const ENTRY_TYPES = {
  exercise:   { label: 'Exercício',  icon: Activity, color: '#5E8A4E', soft: '#E4EEDF' },
  mood:       { label: 'Humor',      icon: Smile,    color: '#9A6FA0', soft: '#EFE3EE' },
  medicalvisit: { label: 'Consulta', icon: Stethoscope, color: '#5B8C91', soft: '#E0EFF0' },
  medication: { label: 'Medicamento', icon: Pill,    color: '#3F7E6E', soft: '#DDEBE5' },
  cycle:      { label: 'Ciclo',      icon: Droplets, color: '#B5557A', soft: '#F6E1EC' },
  weight:     { label: 'Peso',       icon: Scale,    color: '#7C6F5A', soft: '#EFE9DE' },
  sleep:      { label: 'Sono',       icon: Moon,     color: '#5D5FA0', soft: '#E6E5F4' },
  gas:        { label: 'Gases',      icon: Wind,     color: '#7C8CA6', soft: '#E6EAF1' },
  evacuation: { label: 'Evacuação',  icon: Leaf,     color: '#8A6D3B', soft: '#EFE7D6' },
  pain:       { label: 'Dor',        icon: Flame,    color: '#BD5A4A', soft: '#F5E1DD' },
  water:      { label: 'Água',       icon: Droplet,  color: '#3E8E96', soft: '#DEEFEF' },
  meal:       { label: 'Refeição',   icon: Utensils, color: '#C9763A', soft: '#F6E9DD' },
  duvida:     { label: 'Dúvida',     icon: HelpCircle, color: '#6B5B95', soft: '#EAE6F2' },
};

// Rótulos amigáveis exibidos nos Chips_de_Resumo_do_Dia (RF 2.3).
const CHIP_LABELS = {
  meal: 'Alimentação', water: 'Hidratação', sleep: 'Sono', pain: 'Sintoma',
  exercise: 'Exercício', mood: 'Humor', evacuation: 'Evacuação', gas: 'Gases',
  medication: 'Medicamento',
  cycle: 'Ciclo',
  weight: 'Peso',
  medicalvisit: 'Consultas',
  duvida: 'Dúvidas',
};

// Abas do Menu_Inferior (RF 3.1). "Aulas" substitui a antiga aba "Hábitos".
// Ordem: Diário, Insights, Aulas, Perfil. A navegação por gesto (swipe) usa
// ABAS = NAV_ITEMS.map(...), então a aba Aulas entra automaticamente no swipe.
// PLANO FUTURO (não implementado aqui): adicionar uma aba/área "Relatórios"
// com relatórios gerados por IA a partir dos dados do diário.
const NAV_ITEMS = [
  { key: 'diario',   label: 'Diário',   icon: BookOpen },
  { key: 'insights', label: 'Insights', icon: Lightbulb },
  { key: 'aulas',    label: 'Aulas',    icon: GraduationCap },
  { key: 'perfil',   label: 'Perfil',   icon: User },
];

// Ordem das abas para navegação por gesto (swipe horizontal entre abas).
const ABAS = NAV_ITEMS.map((i) => i.key);

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

const SPECIALTY_TAGS = [
  'Médico geral', 'Gastroenterologista', 'Nutricionista',
  'Proctologista', 'Endocrinologista', 'Cirurgião geral',
  'Psicólogo', 'Psiquiatra',
];

const OBSERVATION_PROMPTS = {
  meal: {
    titulo: 'Observações sobre a refeição',
    placeholder: 'Ex: comi mais rápido que o normal, senti estufamento depois… (ou use o microfone)',
  },
  water: {
    titulo: 'Observações sobre a hidratação',
    placeholder: 'Ex: fiquei com muita sede à tarde, bebi além do registrado… (ou use o microfone)',
  },
  sleep: {
    titulo: 'Observações sobre o sono',
    placeholder: 'Ex: acordei várias vezes com cólica, difícil pegar no sono… (ou use o microfone)',
  },
  pain: {
    titulo: 'Observações sobre a dor',
    placeholder: 'Ex: começou ~40 min após o almoço, junto com estufamento… (ou use o microfone)',
  },
  exercise: {
    titulo: 'Observações sobre o exercício',
    placeholder: 'Ex: senti tontura no meio da caminhada, precisei parar… (ou use o microfone)',
  },
  mood: {
    titulo: 'Observações sobre o humor',
    placeholder: 'Ex: estresse no trabalho, discuti com alguém… (ou use o microfone)',
  },
  evacuation: {
    titulo: 'Observações sobre a evacuação',
    placeholder: 'Ex: senti que não esvaziei completamente, ardeu um pouco… (ou use o microfone)',
  },
  gas: {
    titulo: 'Observações sobre os gases',
    placeholder: 'Ex: depois do café da manhã, muito estufamento… (ou use o microfone)',
  },
  medication: {
    titulo: 'Observações sobre o medicamento',
    placeholder: 'Ex: depois de tomar, senti enjoo leve por 1h… (ou use o microfone)',
  },
  cycle: {
    titulo: 'Observações sobre o ciclo',
    placeholder: 'Ex: cólica mais forte que o normal, dor nas costas… (ou use o microfone)',
  },
  weight: {
    titulo: 'Observações sobre o peso',
    placeholder: 'Ex: comecei dieta nova, sinto mais fome… (ou use o microfone)',
  },
  medicalvisit: {
    titulo: 'Observações sobre a consulta',
    placeholder: 'Diagnóstico, orientações, prescrições, retorno… (ou use o microfone)',
  },
  duvida: {
    titulo: 'Dúvida ou observação',
    placeholder: 'Ex: quero perguntar ao médico se isso pode ser intolerância… (ou use o microfone)',
  },
};

// ─── Aulas (vídeo-aulas) — FASE 1: dados mockados ────────────────────────────
// Estrutura pronta para depois vir do Supabase. Os campos capa/preview/links
// ficam null por enquanto (sem imagens): a UI renderiza um placeholder com
// gradiente da marca. Trocar a fonte de dados não muda a lógica de UI.
// Textos em primeira pessoa (experiência/rotina), sem alegações clínicas.
const AULAS = [
  {
    id: 'cafe',
    titulo: 'Super café da manhã/tarde',
    subtitulo: 'Meu preparo da manhã e da tarde',
    descricao: 'Como eu preparo meu café da manhã e da tarde, o que parei de comer e novidades que incluí.',
    preco: 10.0,
    duracao: '12 min',
    nivel: 'Iniciante',
    autor: 'Nut. Camila Souza',
    idioma: 'pt-BR',
    aprendizados: [
      'Como eu monto meu café da manhã e da tarde',
      'O que eu parei de comer e o que incluí de novo',
      'Dicas práticas do meu dia a dia',
    ],
    capa: capaExemplo,
    preview: 'https://player-vz-bc28bfd0-ef8.tv.pandavideo.com.br/embed/?v=334bdb0c-39b2-496e-8263-adf09a122eb4',
    // Exemplo: vídeo via Panda Video (embed/iframe).
    links: {
      video: 'https://player-vz-bc28bfd0-ef8.tv.pandavideo.com.br/embed/?v=334bdb0c-39b2-496e-8263-adf09a122eb4',
      pdf: null,
      produtos: [
        { titulo: 'Balança de cozinha digital', link: 'https://meli.la/2z2PyUu' },
        { titulo: 'Potes herméticos de vidro', link: 'https://meli.la/2z2PyUu' },
      ],
    },
    badge: 'Alimentação',
  },
  {
    id: 'almoco',
    titulo: 'Super almoço/jantar',
    subtitulo: 'Meu preparo do almoço e do jantar',
    descricao: 'Como eu preparo meu almoço e jantar, o que parei de comer e o que incluí de novo.',
    preco: 10.0,
    duracao: '12 min',
    nivel: 'Iniciante',
    autor: 'Nut. Camila Souza',
    idioma: 'pt-BR',
    aprendizados: [
      'Como eu monto meu almoço e meu jantar',
      'O que eu parei de comer e o que incluí de novo',
      'Dicas práticas do meu dia a dia',
    ],
    capa: null,
    preview: 'https://embed-ssl.wistia.com/deliveries/e81023b76ba1d8f3e382d6dad3d9f04d79769d81.bin?disposition=attachment&filename=1000110160.mp4',
    // Exemplo: arquivo .mp4 direto (player nativo). Link da Wistia (deliveries).
    links: {
      video: 'https://embed-ssl.wistia.com/deliveries/e81023b76ba1d8f3e382d6dad3d9f04d79769d81.bin?disposition=attachment&filename=1000110160.mp4',
      pdf: null,
      produtos: [
        { titulo: 'Frigideira antiaderente', link: 'https://meli.la/2z2PyUu' },
        { titulo: 'Azeite de oliva extra virgem', link: 'https://meli.la/2z2PyUu' },
      ],
    },
    badge: 'Alimentação',
  },
  {
    id: 'rotina',
    titulo: 'Minha rotina',
    subtitulo: 'Água, chás, sono e exercícios',
    descricao: 'Como tomo água, quais chás uso, sono, exercícios — toda a minha experiência com esses detalhes.',
    preco: 10.0,
    duracao: '14 min',
    nivel: 'Iniciante',
    autor: 'Nut. Camila Souza',
    idioma: 'pt-BR',
    aprendizados: [
      'Como eu organizo minha hidratação e meus chás',
      'Como cuido do meu sono e dos meus exercícios',
      'Dicas práticas do meu dia a dia',
    ],
    capa: null,
    preview: 'https://www.youtube.com/embed/kyKUVaj5bEo?si=mNqKibe3zhQhduIW',
    // Exemplo: vídeo do YouTube (embed/iframe).
    links: {
      video: 'https://www.youtube.com/embed/kyKUVaj5bEo?si=mNqKibe3zhQhduIW',
      pdf: null,
      produtos: [],
    },
    badge: 'Rotina',
  },
  {
    id: 'kefir',
    titulo: 'Como produzir Kefir sem muda',
    subtitulo: 'Meu passo a passo do zero',
    descricao: 'Meu passo a passo para produzir kefir do zero, sem precisar de muda.',
    preco: 27.0,
    duracao: '20 min',
    nivel: 'Intermediário',
    autor: 'Nut. Camila Souza',
    idioma: 'pt-BR',
    aprendizados: [
      'Como eu começo o kefir sem muda',
      'Como acompanho cada etapa do preparo',
      'Dicas práticas para manter no dia a dia',
    ],
    capa: null,
    preview: 'https://fast.wistia.net/embed/iframe/wscmoabhou',
    // Exemplo: embed da Wistia em IFRAME (player nativo da Wistia, ao contrário
    // do link .mp4 do curso "almoço", que é o arquivo bruto). O ID após
    // /embed/iframe/ é o "media hashed id" do vídeo na sua conta Wistia.
    links: {
      video: 'https://fast.wistia.net/embed/iframe/wscmoabhou',
      pdf: null,
      produtos: [
        { titulo: 'Peneira de inox fina', link: 'https://meli.la/2z2PyUu' },
        { titulo: 'Pote de vidro 1L', link: 'https://meli.la/2z2PyUu' },
      ],
    },
    badge: 'Preparo',
  },
  {
    id: 'conversas',
    titulo: 'Conversas profundas sobre saúde intestinal',
    subtitulo: 'Baseadas em biografias importantes',
    descricao: 'Conversas baseadas em biografias importantes sobre o tema, abordando vários tópicos.',
    preco: 19.0,
    duracao: '35 min',
    nivel: 'Avançado',
    autor: 'Nut. Camila Souza',
    idioma: 'pt-BR',
    aprendizados: [
      'Os temas que eu trago a partir de biografias',
      'Os tópicos que eu costumo conectar nas conversas',
      'Reflexões práticas para o dia a dia',
    ],
    capa: null,
    preview: 'https://iframe.mediadelivery.net/embed/574163/da1f60ec-ce91-4f82-8017-82633914dcd9',
    // Exemplo: embed do Bunny Stream (bunny.net) em IFRAME. Formato:
    // iframe.mediadelivery.net/embed/{libraryId}/{videoId}. O link "/play/..."
    // do painel é a página do player; para incorporar use "/embed/...".
    links: {
      video: 'https://iframe.mediadelivery.net/embed/574163/da1f60ec-ce91-4f82-8017-82633914dcd9',
      pdf: null,
      produtos: [],
    },
    badge: 'Conversas',
  },
];

// Pacotes/ofertas. O combo "Tudo" reúne os 4 primeiros cursos. "conversas" é avulso.
const AULAS_COMBO = {
  id: 'combo-tudo',
  titulo: 'Leve tudo',
  subtitulo: 'Os 4 cursos essenciais num só pacote',
  itens: ['cafe', 'almoco', 'rotina', 'kefir'],
  precoDe: 57.0, // soma dos avulsos (10 + 10 + 10 + 27)
  preco: 37.0,   // preço promocional do combo
};

// Formata um número para moeda pt-BR (vírgula decimal): 10 → "R$ 10,00".
function formatarPreco(valor) {
  return `R$ ${Number(valor).toFixed(2).replace('.', ',')}`;
}

// Detecta o tipo de vídeo a partir da URL para escolher o player adequado.
// 'mp4' → player nativo <video>; 'iframe' → embed (YouTube, Panda, Wistia, etc.).
// Reconhece arquivos diretos (.mp4/.webm/.ogg) e o padrão .bin?...filename=...mp4
// (entregas da Wistia). Qualquer outro link é tratado como embed/iframe.
function tipoDeVideo(url) {
  if (!url) return null;
  const u = String(url).toLowerCase();
  if (/\.(mp4|webm|ogv|ogg|mov|m4v)(\?|#|$)/.test(u)) return 'mp4';
  if (/[?&]filename=[^&]*\.(mp4|webm|ogv|ogg|mov|m4v)/.test(u)) return 'mp4';
  return 'iframe';
}

// ─── Digestive image (silhueta fechada — sem órgãos) ─────────────────────────
const DIGESTIVE_IMAGE = digestiveClosedImage;
import { REGION_LIST, REGION_POINTS, REGION_LEGACY_TO_REGION, ORGAN_LEGACY_TO_REGION, nearestRegion, resolveRegionLabel } from './lib/organs.js';

const INITIAL_ENTRIES = [
  { id: 1, day: 'hoje',  time: '07:43', type: 'meal',     title: 'Café da manhã',  description: '2 fatias de bolo de chocolate' },
  { id: 2, day: 'hoje',  time: '08:23', type: 'water',    title: 'Hidratação',     description: '3 copos de água (~750 ml)' },
  { id: 3, day: 'hoje',  time: '11:45', type: 'water',    title: 'Hidratação',     description: '2 copos de água (~500 ml)' },
  { id: 4, day: 'hoje',  time: '12:21', type: 'meal',     title: 'Almoço',         description: 'Arroz, carne gordurosa e refrigerante' },
  { id: 5, day: 'hoje',  time: '14:50', type: 'pain',     title: 'Dor abdominal',  description: 'Cólica · Gases intensos · Cólon sigmoide', meta: { clouds: [{ x: 65, y: 82, organ: 'colon_sig' }], intensity: 7 } },
  { id: 6, day: 'ontem', time: '18:30', type: 'exercise', title: 'Exercício',      description: 'Caminhada · 30 min · Intensidade leve' },
  { id: 7, day: 'ontem', time: '23:10', type: 'sleep',    title: 'Sono',           description: 'Levantou 2x à noite · Acordou com desconforto abdominal', meta: { quality: 3 } },
  { id: 8, day: 'ontem', time: '07:30', type: 'weight',   title: 'Peso',           description: '76,2 kg',                                     meta: { weight: 76.2 } },
  { id: 9, day: 'ontem', time: '14:00', type: 'medicalvisit', title: 'Gastroenterologista', description: 'Consulta com Gastroenterologista', meta: { especialidade: 'Gastroenterologista', note: 'Retirar lactose por 2 semanas, retorno em 30 dias' } },
];

// Silhouette + PainCloud extraídos para src/components/Silhouette.jsx (reusados
// no PainForm, SilhouetteZoom e no novo Relatório Express). Comportamento idêntico.
import Silhouette from './components/Silhouette';

// ─── Shared primitives ────────────────────────────────────────────────────────
function SaveButton({ color, onClick, label = 'Próximo' }) {
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

// ─── Cabeçalho Hero (RF 2.1) ──────────────────────────────────────────────────
// `colapsado` recolhe o hero para uma barra de marca fininha ao rolar a timeline.
// Sem transição — troca instantânea de estado para evitar travamento.
const CURSIVE_STACK = '"Caveat", "Segoe Print", "Bradley Hand", cursive';

function HeroHeader({ colapsado = false }) {
  return (
    <header
      className="relative z-10 shrink-0 px-5 overflow-hidden"
      style={{
        background:
          'radial-gradient(120% 90% at 88% 4%, rgba(120,196,140,0.22) 0%, rgba(120,196,140,0) 55%), linear-gradient(165deg, var(--brand) 0%, var(--brand-deep) 62%)',
        paddingTop: colapsado ? '0.75rem' : '1.5rem',
        paddingBottom: colapsado ? '0.5rem' : '2.25rem',
        borderBottomLeftRadius: colapsado ? 16 : 28,
        borderBottomRightRadius: colapsado ? 16 : 28,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className="overflow-hidden pr-3"
            style={{
              maxHeight: colapsado ? 0 : '7rem',
              opacity: colapsado ? 0 : 1,
            }}
          >
            <p className="text-2xl leading-[1.25]" style={{ fontFamily: CURSIVE_STACK, color: 'rgba(255,255,255,0.95)' }}>Meu diário</p>
            <p className="text-5xl leading-[1.25] -mt-1" style={{ fontFamily: CURSIVE_STACK, color: '#fff' }}>
              Intestinal
            </p>
          </div>
          <div
            className="overflow-hidden pr-3"
            style={{
              maxHeight: colapsado ? '3.25rem' : 0,
              opacity: colapsado ? 1 : 0,
            }}
          >
            <p className="text-2xl leading-[1.3] whitespace-nowrap" style={{ fontFamily: CURSIVE_STACK, color: '#fff' }}>
              Meu diário intestinal
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" aria-label="Menu"
            className="rounded-full flex items-center justify-center text-white"
            style={{
              background: 'rgba(255,255,255,0.14)',
              width: colapsado ? 32 : 36,
              height: colapsado ? 32 : 36,
            }}>
            <EllipsisVertical size={colapsado ? 16 : 18} />
          </button>
        </div>
      </div>

      <img
        src={mascoteImage}
        alt="Mascote do Diário Intestinal"
        className="absolute right-3 top-2 w-24 h-24 object-contain select-none pointer-events-none drop-shadow-lg"
        style={{
          transformOrigin: 'top right',
          transform: colapsado ? 'translate(-40px, -2px) scale(0.33)' : 'translateZ(0)',
        }}
        draggable={false}
      />
    </header>
  );
}

// ─── Card de Resumo do Dia (RF 2.2, 2.3) ──────────────────────────────────────
// `colapsado` recolhe o card para um strip fino (só o cabeçalho), ocultando
// suavemente os chips e a linha do ciclo. Os dados permanecem montados.
function DaySummaryCard({ dateLabel, entries, colapsado = false, onExpand }) {
  const contagens = contarPorTipo(entries, 'hoje');
  const itens = Object.keys(ENTRY_TYPES).filter((k) => contagens[k] > 0);

  // "Agora" estável durante a vida do componente (evita chamada impura no render).
  const [agora] = useState(() => Date.now());

  // Fase_do_Ciclo (RF 16.3/16.5): quando há ao menos um registro de ciclo com
  // data de início. Usa o início mais recente. Texto factual, sem juízo de
  // normalidade ou recomendação (RF 6/16.6).
  let ciclo = null;
  const inicios = entries
    .filter((e) => e.type === 'cycle' && Number.isFinite(e.meta?.inicioTs))
    .map((e) => e.meta.inicioTs);
  if (inicios.length) {
    const ultimoInicio = Math.max(...inicios);
    const f = faseDoCiclo(ultimoInicio, agora);
    if (f.fase !== 'desconhecida') ciclo = f;
  }

  return (
    <div
      className={`day-summary-mesh relative z-20 mx-5 mb-0 shrink-0 overflow-hidden rounded-2xl border border-[#EDE7DD] ${colapsado ? 'p-2 -mt-3 shadow-[0_8px_18px_-12px_rgba(0,0,0,0.4)] cursor-pointer' : 'p-4 -mt-5 shadow-[0_16px_32px_-12px_rgba(0,0,0,0.5)]'}`}
      {...(colapsado ? { onClick: onExpand, role: 'button', 'aria-expanded': false, tabIndex: 0 } : {})}>
      <div className={`relative z-[1] flex items-center justify-between gap-2 ${colapsado ? 'mb-0' : 'mb-3'}`}>
        <span className="titulo-cursivo flex items-center gap-1.5 text-sm font-serif" style={{ color: 'var(--brand)' }}>
          <ChartColumn size={15} />
          Resumo do dia
        </span>
        <span className="titulo-cursivo text-base font-serif text-[#2B2A28]">
          {dateLabel}
        </span>
      </div>

      {/* Área recolhível: chips por categoria + eventual linha do ciclo */}
      <div className="relative z-[1] overflow-hidden"
        style={{ maxHeight: colapsado ? 0 : '320px', opacity: colapsado ? 0 : 1 }}>
        {itens.length === 0 ? (
          <p className="text-sm text-[#B6AE9F]">Nenhum registro hoje ainda.</p>
        ) : (
          <div data-noswipe className="flex gap-4 overflow-x-auto">
            {itens.map((k) => {
              const meta = ENTRY_TYPES[k];
              const Icon = meta.icon;
              return (
                <div key={k} className="flex flex-col items-center gap-1 min-w-[58px] shrink-0">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ background: meta.soft, color: meta.color, border: `1px solid ${meta.color}59`, boxShadow: `0 2px 6px -1px rgba(0,0,0,0.22), inset 0 0 0 1px ${meta.color}1f` }}>
                    <Icon size={18} strokeWidth={2.4} />
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
    <nav className="absolute bottom-0 left-0 right-0 z-20 flex items-end bg-white border-t border-[#EDE7DD] px-2 pt-2"
      style={{ boxShadow: '0 -10px 26px -8px rgba(0,0,0,0.3)', paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}>
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

// ─── Aulas (vídeo-aulas pagas) — FASE 1 (somente front-end) ───────────────────
// Tela cheia com cabeçalho próprio (não usa o HeroHeader do Diário). Catálogo
// estilo "Netflix" com cards grandes; ao tocar abre a sub-view de detalhe.
// Compras são SIMULADAS (Set local) — sem backend/pagamento real. A estrutura
// de dados (AULAS/AULAS_COMBO) já prevê os campos para vir do Supabase depois.

// Placeholder visual de prévia: gradiente da marca + ícone Play central. Usado
// enquanto capa/preview/links forem null (ainda sem vídeo/imagem).
function PreviewPlaceholder({ children, capa }) {
  return (
    <div
      className="absolute inset-0"
      style={{
        background:
          'radial-gradient(120% 90% at 80% 10%, rgba(120,196,140,0.35) 0%, rgba(120,196,140,0) 55%), linear-gradient(160deg, #2C4A38 0%, var(--brand-deep) 70%)',
      }}
    >
      {capa && (
        <img src={capa} alt="" className="absolute inset-0 w-full h-full object-cover" />
      )}
      {children}
    </div>
  );
}

// Player de vídeo agnóstico de provedor. Detecta mp4 (player nativo) ou embed
// (iframe: YouTube, Panda, Wistia, etc.). Trocar o link em AULAS troca o servidor
// de vídeo sem mudar a UI. Em fase futura os links virão do Supabase com URL
// assinada para conteúdo pago.
function VideoPlayer({ url, titulo }) {
  if (tipoDeVideo(url) === 'mp4') {
    return (
      <video
        src={url}
        controls
        autoPlay
        playsInline
        className="absolute inset-0 w-full h-full"
        style={{ background: '#000' }}
      >
        Seu navegador não suporta vídeo incorporado.
      </video>
    );
  }
  return (
    <iframe
      src={url}
      title={titulo || 'Vídeo da aula'}
      className="absolute inset-0 w-full h-full"
      style={{ border: 0, background: '#000' }}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
      allowFullScreen
    />
  );
}

// Card de curso no catálogo: vídeo de prévia embutido + botão de compra ou
// acesso. Não é um <button> único pois contém player de vídeo e botões.
function AulaCard({ aula, liberado, onComprar, onAcessar }) {
  const temPreview = !!aula.preview;

  return (
    <div
      className="relative w-full rounded-3xl overflow-hidden text-left shadow-[0_18px_36px_-16px_rgba(0,0,0,0.65)]"
      style={{ aspectRatio: '9 / 16' }}
    >
      {/* Vídeo de prévia ou capa */}
      {temPreview ? (
        <VideoPlayer url={aula.preview} titulo={`Prévia: ${aula.titulo}`} />
      ) : (
        <PreviewPlaceholder capa={aula.capa}>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(246,210,184,0.92)', color: '#3A2E25' }}>
              <Play size={28} fill="#3A2E25" />
            </span>
          </div>
        </PreviewPlaceholder>
      )}

      {/* Selo de status (canto superior esquerdo) */}
      <div className="absolute top-3 left-3 z-10">
        {liberado ? (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
            style={{ background: 'rgba(120,196,140,0.92)', color: '#11241A' }}>
            <CheckCircle2 size={13} /> Liberado
          </span>
        ) : (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
            style={{ background: 'rgba(12,18,16,0.7)', color: '#F2ECE3' }}>
            <Lock size={13} /> Bloqueado
          </span>
        )}
      </div>

      {/* Badge categoria (canto superior direito) */}
      {aula.badge && (
        <span className="absolute top-3 right-3 z-10 px-2.5 py-1 rounded-full text-[11px] font-semibold"
          style={{ background: 'rgba(255,255,255,0.16)', color: '#F2ECE3' }}>
          {aula.badge}
        </span>
      )}

      {/* Rodapé com título/subtítulo + botão de ação sobre gradiente escuro */}
      <div className="absolute bottom-0 left-0 right-0 p-4"
        style={{ background: 'linear-gradient(to top, rgba(8,14,11,0.95) 0%, rgba(8,14,11,0.7) 55%, rgba(8,14,11,0) 100%)' }}>
        <p className="text-2xl leading-tight" style={{ fontFamily: CURSIVE_STACK, color: '#FFFFFF' }}>
          {aula.titulo}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'rgba(242,236,227,0.82)' }}>{aula.subtitulo}</p>
        {liberado ? (
          <button type="button" onClick={onAcessar}
            className="w-full mt-3 py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2"
            style={{ background: '#F6D2B8', color: '#3A2E25' }}>
            <Play size={16} fill="#3A2E25" /> Acessar conteúdo
          </button>
        ) : (
          <button type="button" onClick={onComprar}
            className="w-full mt-3 py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2"
            style={{ background: '#F6D2B8', color: '#3A2E25' }}>
            <Lock size={16} /> Comprar agora {formatarPreco(aula.preco)}
          </button>
        )}
      </div>
    </div>
  );
}

// Sub-view de detalhe de um curso: vídeo da aula completa + meta + aprendizados
// + produtos. Acessada via botão "Acessar conteúdo" no card (catálogo). O vídeo
// inicia automaticamente (autoPlay no VideoPlayer).
function AulaDetalhe({ aula, indice, onVoltar }) {
  const numero = String(indice + 1).padStart(2, '0');
  const temVideo = !!aula.links?.video;

  return (
    <div className="px-4 pt-3">
      {/* Voltar */}
      <button type="button" onClick={onVoltar} aria-label="Voltar ao catálogo"
        className="flex items-center gap-1.5 mb-3 px-3 py-1.5 rounded-full text-sm font-medium"
        style={{ background: 'rgba(255,255,255,0.12)', color: '#F2ECE3' }}>
        <ArrowLeft size={16} /> Voltar
      </button>

      {/* 1. Player 9/16: vídeo da aula */}
      <div className="relative w-full rounded-3xl overflow-hidden shadow-[0_18px_36px_-16px_rgba(0,0,0,0.7)]"
        style={{ aspectRatio: '9 / 16' }}>
        {temVideo ? (
          <VideoPlayer url={aula.links.video} titulo={aula.titulo} />
        ) : (
          <PreviewPlaceholder capa={aula.capa}>
            <span className="absolute top-3 right-3 z-10 px-2.5 py-1 rounded-full text-[11px] font-semibold"
              style={{ background: 'rgba(120,196,140,0.92)', color: '#11241A' }}>
              AULA {numero}
            </span>
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-sm px-6 text-center" style={{ color: 'rgba(242,236,227,0.7)' }}>
                Vídeo em breve
              </p>
            </div>
          </PreviewPlaceholder>
        )}
      </div>

      {/* 2. Título + subtítulo */}
      <h2 className="text-3xl mt-5 leading-tight" style={{ fontFamily: CURSIVE_STACK, color: '#FFFFFF' }}>
        {aula.titulo}
      </h2>
      <p className="text-sm mt-1" style={{ color: 'rgba(242,236,227,0.82)' }}>{aula.descricao}</p>

      {/* 4. Meta */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-4 text-xs" style={{ color: 'rgba(242,236,227,0.78)' }}>
        <span className="flex items-center gap-1.5"><Clock size={14} /> {aula.duracao}</span>
        <span className="flex items-center gap-1.5"><BarChart3 size={14} /> Nível {aula.nivel}</span>
        <span className="flex items-center gap-1.5"><User size={14} /> {aula.autor}</span>
      </div>

      {/* 5. Divisor */}
      <div className="my-5 h-px" style={{ background: 'rgba(242,236,227,0.18)' }} />

      {/* 6. Aprendizados */}
      <p className="text-2xl" style={{ fontFamily: CURSIVE_STACK, color: '#9FD8AE' }}>
        Nesta aula você vai aprender:
      </p>
      <ul className="mt-3 space-y-2.5">
        {aula.aprendizados.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: '#F2ECE3' }}>
            <CheckCircle2 size={18} className="shrink-0 mt-0.5" style={{ color: '#7FC88C' }} />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      {/* 6b. Produtos */}
      {aula.links.produtos.length > 0 && (
        <div className="mt-6">
          <p className="text-base font-semibold" style={{ color: '#CDEBD5' }}>
            Produtos mencionados
          </p>
          <div className="mt-3 space-y-2.5">
            {aula.links.produtos.map((prod, i) => (
              <a key={i}
                href={prod.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-2xl p-3 transition-opacity hover:opacity-85"
                style={{ background: 'rgba(255,255,255,0.07)' }}>
                <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(205,235,213,0.15)', color: '#9FD8AE' }}>
                  <ShoppingBag size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate" style={{ color: '#F2ECE3' }}>{prod.titulo}</p>
                </div>
                <span className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full"
                  style={{ background: 'rgba(246,210,184,0.15)', color: '#F6D2B8' }}>
                  Comprar agora
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Tela principal da aba Aulas (catálogo + detalhe). Sem data-noswipe: o swipe
// horizontal continua navegando entre abas; a rolagem do catálogo é vertical.
function AulasScreen({ selecionado, onSelecionado }) {
  const [comprados, setComprados] = useState(() => new Set());

  const liberar = useCallback((ids) => {
    setComprados((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  const aulaSel = selecionado ? AULAS.find((a) => a.id === selecionado) : null;
  const indiceSel = selecionado ? AULAS.findIndex((a) => a.id === selecionado) : -1;
  const comboLiberado = AULAS_COMBO.itens.every((id) => comprados.has(id));

  return (
    <main
      className="relative z-10 flex-1 overflow-y-auto pb-28"
      style={{ background: 'var(--brand-deep)' }}
    >
      {/* Cabeçalho próprio (sticky) */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-5 py-3"
        style={{ background: 'var(--brand-deep)' }}>
        <div className="flex items-center gap-2">
          <Leaf size={22} style={{ color: '#9FD8AE' }} />
          <p className="text-3xl leading-none" style={{ fontFamily: CURSIVE_STACK, color: '#FFFFFF' }}>Aulas</p>
        </div>
        <button type="button" aria-label="Transmitir"
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.12)', color: '#F2ECE3' }}>
          <Cast size={18} />
        </button>
      </header>

      {aulaSel ? (
        <AulaDetalhe
          aula={aulaSel}
          indice={indiceSel}
          onVoltar={() => onSelecionado(null)}
        />
      ) : (
        <div className="px-4 pt-1">
          {!comboLiberado && (
          <div className="rounded-3xl p-5 shadow-[0_18px_36px_-16px_rgba(0,0,0,0.6)]"
            style={{ background: 'linear-gradient(150deg, #34543F 0%, #1E3328 100%)', border: '1px solid rgba(159,216,174,0.25)' }}>
            <p className="text-3xl leading-tight" style={{ fontFamily: CURSIVE_STACK, color: '#FFFFFF' }}>
              {AULAS_COMBO.titulo}
            </p>
            <p className="text-sm mt-1" style={{ color: 'rgba(242,236,227,0.82)' }}>{AULAS_COMBO.subtitulo}</p>
            <div className="flex items-center gap-2 mt-3">
              <span className="text-sm line-through" style={{ color: 'rgba(242,236,227,0.6)' }}>
                de {formatarPreco(AULAS_COMBO.precoDe)}
              </span>
              <span className="text-2xl font-bold" style={{ color: '#F6D2B8' }}>
                por {formatarPreco(AULAS_COMBO.preco)}
              </span>
            </div>
            <button type="button" onClick={() => liberar(AULAS_COMBO.itens)}
              className="w-full mt-4 py-3 rounded-2xl text-base font-semibold"
              style={{ background: '#F6D2B8', color: '#3A2E25' }}>
              Adquirir combo {formatarPreco(AULAS_COMBO.preco)}
            </button>
            <p className="text-[11px] text-center mt-2" style={{ color: 'rgba(242,236,227,0.6)' }}>
              Demonstração — compra simulada (pagamento em breve)
            </p>
          </div>
          )}

          {/* Catálogo vertical */}
          <div className="mt-5 space-y-5">
            {AULAS.map((aula) => (
              <AulaCard
                key={aula.id}
                aula={aula}
                liberado={comprados.has(aula.id)}
                onComprar={() => liberar([aula.id])}
                onAcessar={() => onSelecionado(aula.id)}
              />
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

// ─── Tela de Perfil (configurações — hospeda a Fonte Cursiva, RF 4) ───────────
function ProfileScreen({ cursiva, onCursiva, inkLevel, onInk, fontScale, onFont, profile, onEditarProfile }) {
  const condLabels = (profile?.condicoes || []).map(id => CONDICOES_LABELS[id] || id).join(', ');
  const biometria = [
    profile?.idade ? `${profile.idade} anos` : null,
    profile?.peso ? `${profile.peso} kg` : null,
    profile?.altura ? `${profile.altura} cm` : null,
  ].filter(Boolean).join(' - ');
  const [showAparencia, setShowAparencia] = useState(false);
  return (
    <main className="relative z-10 flex-1 overflow-y-auto px-5 pt-3 pb-28">
      <p className="titulo-cursivo text-2xl font-serif mb-4" style={{ color: 'var(--amb-text)' }}>Perfil</p>

      {/* Meus dados de saúde */}
      <div className="rounded-2xl bg-white border border-[#EDE7DD] p-4 shadow-[0_10px_24px_-10px_rgba(31,42,40,0.4)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Heart size={16} style={{ color: '#BD5A4A' }} />
            <p className="text-xs font-semibold uppercase tracking-wide text-[#B6AE9F]">Meus dados de saúde</p>
          </div>
          <button type="button" onClick={onEditarProfile}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg text-[#4A8A5C] transition-colors"
            style={{ background: 'rgba(74,138,92,0.08)' }}>
            <PencilIcon size={12} />
            Editar
          </button>
        </div>
        <div className="mt-3 space-y-1.5">
          {profile?.nome ? (
            <p className="text-sm font-medium text-[#2B2A28]">{profile.nome}</p>
          ) : (
            <p className="text-sm text-[#9A938A] italic">Nenhum dado preenchido ainda.</p>
          )}
          {biometria && (
            <p className="text-xs text-[#7D766A]">{biometria}</p>
          )}
          {condLabels && (
            <p className="text-xs text-[#7D766A]"><span className="font-medium">Condições:</span> {condLabels}</p>
          )}
          {profile?.outros && (
            <p className="text-xs text-[#7D766A]"><span className="font-medium">Outras:</span> {profile.outros}</p>
          )}
        </div>
        <p className="text-[11px] text-[#9A938A] mt-2 leading-snug">
          Estes dados enriquecem o Relatório de IA com contexto clínico personalizado.
        </p>
      </div>

      {/* Aparência (retrátil) */}
      <div className="mt-4 rounded-2xl bg-white border border-[#EDE7DD] p-4 shadow-[0_10px_24px_-10px_rgba(31,42,40,0.4)]">
        <button type="button" onClick={() => setShowAparencia(!showAparencia)}
          className="w-full flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#B6AE9F]">Aparência</p>
          <ChevronDown size={16} className={`transition-transform duration-200 ${showAparencia ? 'rotate-180' : ''}`}
            style={{ color: '#B6AE9F' }} />
        </button>
        {showAparencia && (
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="entry-text text-sm font-medium text-[#2B2A28]">Fonte cursiva</p>
                <p className="text-xs text-[#7D766A] mt-0.5">Letra manuscrita nos títulos e nos registros</p>
              </div>
              <CursivaToggle value={cursiva} onChange={onCursiva} />
            </div>

            <div className="pt-4 border-t border-[#F1ECE3]">
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

            <div className="pt-4 border-t border-[#F1ECE3]">
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
        )}
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
    <div data-noswipe className="relative w-full h-20 mt-2" style={{ touchAction: 'none' }}
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

// PainHeatmap extraído para src/components/PainHeatmap.jsx (reutilizado no
// Relatório IA). Comportamento idêntico; `interactive` default true.

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
function PainScrubber({ history, onScrub }) {
  const pains = useMemo(() => history
    .filter((e) => e.type === 'pain' && (e.organ || e.meta?.clouds?.[0]?.organ || e.meta?.clouds?.[0]?.region))
    .map((e) => {
      const cloud = e.meta?.clouds?.[0] || {};
      const organ = e.organ || cloud.organ || cloud.region;
      const mapped = ORGAN_LEGACY_TO_REGION[organ] || REGION_LEGACY_TO_REGION[organ] || organ;
      const pts = REGION_POINTS[mapped];
      if (!pts || !pts.length) return null;
      const [x, y] = pts[Math.abs(Math.floor(e.ts / 60000)) % pts.length];
      return { ts: e.ts, x, y, intensity: e.intensity || e.meta?.intensity || 5 };
    })
    .filter(Boolean)
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
    <div data-noswipe className="rounded-2xl bg-white border border-[#EDE7DD] p-4 shadow-[0_8px_22px_-12px_rgba(31,42,40,0.35)]">
      <div className="flex items-baseline justify-between mb-1">
        <p className="entry-text text-sm font-medium text-[#2B2A28]">Linha do tempo da dor</p>
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
      <input type="range" min={0} max={100} value={pos}
        onChange={(e) => {
          const val = Number(e.target.value);
          setPos(val);
          if (onScrub) onScrub(min + (val / 100) * (max - min));
        }}
        onPointerDown={() => onScrub && onScrub(min + (pos / 100) * (max - min))}
        onPointerUp={() => onScrub && onScrub(null)}
        onPointerCancel={() => onScrub && onScrub(null)}
        onTouchStart={() => onScrub && onScrub(min + (pos / 100) * (max - min))}
        onTouchEnd={() => onScrub && onScrub(null)}
        onMouseDown={() => onScrub && onScrub(min + (pos / 100) * (max - min))}
        onMouseUp={() => onScrub && onScrub(null)}
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
    <div data-noswipe className="rounded-2xl bg-white border border-[#EDE7DD] p-3 mt-2 shadow-[0_8px_22px_-12px_rgba(31,42,40,0.35)]">
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



// ─── ConsultaCard: próxima consulta + countdown no topo de Insights ──────────
// Conceito único de "próxima consulta" compartilhado entre Relatórios IA e
// Relatório Express. Modelo array-based em lib/consulta.js (Supabase-ready).
function ConsultaCard() {
  const [proxima, setProxima] = useState(() => proximaConsulta());
  const [editando, setEditando] = useState(false);
  const [draft, setDraft] = useState('');

  const refresh = useCallback(() => setProxima(proximaConsulta()), []);
  useEffect(() => { refresh(); }, [refresh]);

  const diasFaltam = useMemo(() => {
    if (!proxima || !proxima.data) return null;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const alvo = new Date(proxima.data + 'T00:00:00');
    return Math.round((alvo - hoje) / 86400000);
  }, [proxima]);

  const minTs = useMemo(() => inicioDiaUTC(Date.now()), []);
  const maxTs = useMemo(() => Date.UTC(new Date().getFullYear() + 2, 11, 31), []);
  const draftTs = useMemo(() => draft ? Date.parse(draft + 'T00:00:00') : Date.now(), [draft]);
  const onPickDate = useCallback((r) => setDraft(new Date(r.ini).toISOString().slice(0, 10)), []);

  const abrirEdicao = () => {
    setDraft(proxima?.data || '');
    setEditando(true);
  };

  const handleSave = () => {
    const v = (draft || '').trim();
    const prev = proximaConsulta();
    if (prev) removeConsulta(prev.id);
    if (v) addConsulta({ data: v });
    setProxima(proximaConsulta());
    setEditando(false);
  };

  const handleRemove = () => {
    if (proxima) removeConsulta(proxima.id);
    setProxima(null);
    setEditando(false);
  };

  const fmtDataLonga = (iso) => {
    try {
      const d = new Date(iso + 'T00:00:00');
      return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    } catch { return iso; }
  };

  if (!proxima && !editando) {
    return (
      <div className="rounded-2xl bg-white border border-[#EDE7DD] p-3 mb-3 shadow-[0_6px_18px_-12px_rgba(31,42,40,0.35)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Calendar size={16} style={{ color: '#7D766A' }} />
          <p className="text-xs text-[#7D766A]">Nenhuma consulta agendada.</p>
        </div>
        <button type="button" onClick={abrirEdicao}
          className="shrink-0 px-3 py-1 rounded-full text-xs font-medium text-white"
          style={{ background: 'var(--brand)' }}>
          Adicionar
        </button>
      </div>
    );
  }

  if (editando || !proxima) {
    return (
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          <Calendar size={16} style={{ color: '#7D766A' }} />
          <p className="text-xs font-medium text-[#2B2A28]">Data da próxima consulta</p>
        </div>
        <CalendarPicker single
          minTs={minTs} maxTs={maxTs}
          range={{ ini: draftTs, fim: draftTs }}
          onRange={onPickDate} />
        <div className="flex gap-2 mt-2">
          {draft && (
            <button type="button" onClick={handleSave}
              className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: 'var(--brand)' }}>
              Salvar
            </button>
          )}
          {proxima && (
            <button type="button" onClick={handleRemove} aria-label="Remover consulta"
              className="shrink-0 w-9 flex items-center justify-center rounded-xl text-[#BD5A4A] border"
              style={{ borderColor: 'rgba(189,90,74,0.3)' }}>
              <Trash2 size={14} />
            </button>
          )}
          <button type="button" onClick={() => setEditando(false)}
            className="shrink-0 px-3 py-2 rounded-xl text-sm text-[#7D766A]">
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  const diasTexto = diasFaltam === 0 ? 'é hoje' : diasFaltam === 1 ? 'é amanhã' : `faltam ${diasFaltam} dias`;
  const urgente = diasFaltam != null && diasFaltam <= 4;

  return (
    <button type="button" onClick={abrirEdicao}
      className="w-full text-left rounded-2xl border p-3 mb-3 shadow-[0_6px_18px_-12px_rgba(31,42,40,0.35)] transition-colors"
      style={{
        background: urgente ? 'linear-gradient(135deg, #FFF8F0 0%, #FFF2E6 100%)' : '#FFFFFF',
        borderColor: urgente ? 'rgba(201,118,58,0.4)' : '#EDE7DD',
      }}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Calendar size={16} style={{ color: urgente ? '#C9763A' : '#7D766A' }} />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: urgente ? '#C9763A' : '#B6AE9F' }}>
              Próxima consulta
            </p>
            <p className="text-sm font-medium text-[#2B2A28] capitalize">{fmtDataLonga(proxima.data)}</p>
          </div>
        </div>
        <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold"
          style={{
            background: urgente ? 'rgba(201,118,58,0.15)' : 'rgba(74,138,92,0.1)',
            color: urgente ? '#C9763A' : 'var(--brand)',
          }}>
          {diasTexto}
        </span>
      </div>
    </button>
  );
}

function InsightsScreen({ calAberto, onCalAberto, entries }) {
  const history = useMemo(() => gerarHistoricoMock(), []);
  const bounds = useMemo(() => {
    const ts = history.map((e) => e.ts);
    return { min: Math.min(...ts), max: Math.max(...ts) };
  }, [history]);
  const lastDay = inicioDiaUTC(bounds.max);
  const preset = (nn) => ({ ini: lastDay - (nn - 1) * DIA_MS, fim: lastDay + DIA_MS - 1 });

  const [range, setRange] = useState(() => preset(30));
  const [presetAtivo, setPresetAtivo] = useState(30);
  const [hover, setHover] = useState(null);
  const [scrubTs, setScrubTs] = useState(null);
  const [suavizar, setSuavizar] = useState(false);
  const [aba, setAba] = useState('insights');

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
  const peso = prep('weight', 'weight', 'media');

  const umDia = inicioDiaUTC(range.ini) === inicioDiaUTC(range.fim);
  const rangeLabel = umDia ? fmtData(range.ini, true) : `${fmtData(range.ini)} – ${fmtData(range.fim)}`;
  
  let foco = rangeLabel;
  let isScrubbing = false;
  if (scrubTs != null) {
    foco = fmtData(scrubTs, true);
    isScrubbing = true;
  } else if (hover != null && agua[hover]) {
    foco = fmtData(agua[hover].dia, true);
    isScrubbing = true;
  }

  const periodos = [7, 30, 60, 90];
  const btn = (ativo) => (ativo
    ? { background: 'var(--brand)', borderColor: 'var(--brand)', color: '#fff' }
    : { borderColor: 'rgba(150,140,120,0.4)', color: 'var(--amb-text)', background: 'rgba(255,255,255,0.5)' });

  return (
    <main className="relative z-10 flex-1 overflow-y-auto px-5 pb-28">
      {/* ── Cabeçalho fixo ──────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 -mx-5 px-5 pt-3 pb-2"
        style={{ background: 'var(--amb-bg-1)', boxShadow: '0 6px 12px -10px rgba(0,0,0,0.5)' }}>

        {/* Tabs em cursiva substituem o título */}
        <div className="flex items-center gap-5">
          {[
            { key: 'insights',   label: 'Insights',      ariaLabel: 'Aba interna Insights' },
            { key: 'relatorios', label: 'Relatórios IA', ariaLabel: 'Aba interna Relatórios IA' },
            { key: 'express',    label: 'Express',       ariaLabel: 'Aba interna Relatório Express' },
          ].map(({ key, label, ariaLabel }) => (
            <button key={key} type="button" onClick={() => setAba(key)}
              aria-label={ariaLabel}
              className="titulo-cursivo text-2xl font-serif pb-0.5 transition-all"
              style={{
                color:       'var(--amb-text)',
                opacity:     aba === key ? 1 : 0.38,
                borderBottom: aba === key
                  ? '2px solid var(--brand)'
                  : '2px solid transparent',
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* ConsultaCard: próxima consulta + countdown (só IA/Express) */}
        {aba !== 'insights' && <ConsultaCard />}

        {/* Seletores de período (só na aba Insights) */}
        {aba === 'insights' && (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {periodos.map((p) => (
              <button key={p} type="button" onClick={() => aplicaPreset(p)}
                className="px-3 py-1 rounded-full text-xs font-medium border transition-colors"
                style={btn(presetAtivo === p)}>{p}d</button>
            ))}
            <button type="button" aria-label="Escolher no calendário" onClick={() => onCalAberto(!calAberto)}
              className="px-2.5 py-1 rounded-full border flex items-center" style={btn(calAberto || presetAtivo === null)}>
              <Calendar size={14} />
            </button>
            <button type="button" onClick={() => setSuavizar((v) => !v)} aria-pressed={suavizar}
              className="ml-auto px-3 py-1 rounded-full text-xs font-medium border transition-colors" style={btn(suavizar)}>
              Suavizar
            </button>
          </div>
        )}

        {/* ── Badge central fixado no painel superior ──────── */}
        {aba === 'insights' && (
          <div className="flex justify-center mt-3">
            <span
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold tabular-nums transition-all duration-200"
              style={isScrubbing
                ? {
                    background: 'var(--brand)',
                    color: '#fff',
                    boxShadow: '0 4px 12px -2px rgba(74,138,92,0.45)',
                  }
                : {
                    background: 'rgba(255,255,255,0.62)',
                    color: 'var(--amb-text)',
                    border: '1px solid rgba(150,140,120,0.25)',
                  }
              }>
              {foco}
            </span>
          </div>
        )}

        {calAberto && (
          <CalendarPicker minTs={bounds.min} maxTs={bounds.max} range={range} onRange={aplicaRange} />
        )}
      </div>

      {/* Backdrop transparente: fecha o calendário ao clicar fora */}
      {calAberto && <div className="fixed inset-0 z-10" onClick={() => onCalAberto(false)} />}

      {/* ── Conteúdo principal ──────────────────────────────────────────── */}
      {aba === 'insights' ? (
        <>
          <div className="space-y-3 mt-2">
            <MetricCard titulo="Hidratação" color={ENTRY_TYPES.water.color} serie={agua} unidade=" copos/dia" casas={suavizar ? 1 : 0} hover={hover} onHover={setHover} />
            <MetricCard titulo="Intensidade da dor" color={ENTRY_TYPES.pain.color} serie={dor} unidade="/10" casas={1} hover={hover} onHover={setHover} />
            <MetricCard titulo="Qualidade do sono" color={ENTRY_TYPES.sleep.color} serie={sono} unidade="/5" casas={1} hover={hover} onHover={setHover} />
            <MetricCard titulo="Humor" color={ENTRY_TYPES.mood.color} serie={humor} unidade="/5" casas={1} hover={hover} onHover={setHover} />
            <MetricCard titulo="Exercício" color={ENTRY_TYPES.exercise.color} serie={exercicio} unidade=" min/dia" casas={0} hover={hover} onHover={setHover} />
            <MetricCard titulo="Peso" color={ENTRY_TYPES.weight.color} serie={peso} unidade=" kg" casas={1} hover={hover} onHover={setHover} />
          </div>

          <p className="titulo-cursivo text-lg font-serif mt-5 mb-2" style={{ color: 'var(--amb-text)' }}>Onde dói</p>
          <PainHeatmap history={hist} />
          <div className="mt-3"><PainScrubber history={hist} onScrub={setScrubTs} /></div>

          <p className="titulo-cursivo text-lg font-serif mt-5 mb-2" style={{ color: 'var(--amb-text)' }}>Cruzamentos</p>
          <CrossingsSection history={hist} />

          <p className="text-[11px] mt-4 leading-snug" style={{ color: 'var(--amb-text)', opacity: 0.6 }}>
            Use os botões 7/30/60/90 ou o calendário (dia ou intervalo) — todas as seções seguem o mesmo período. Observações dos seus próprios registros; não substituem avaliação profissional.
          </p>
        </>
      ) : aba === 'relatorios' ? (
        <div className="mt-3">
          <RelatoriasIAScreen entries={entries} />
        </div>
      ) : (
        <div className="mt-3">
          <RelatorioExpressScreen entries={entries} />
        </div>
      )}
    </main>
  );
}

// ─── Calibração de pontos de dor (FERRAMENTA TEMPORÁRIA / DEV) ─────────────────
// Permite tocar na silhueta fechada e capturar coordenadas (cx, cy em %) das
// 10 REGIÕES corporais genéricas (conformidade bem-estar). Ativação: Ctrl+Shift+K.
function CalibrationOverlay({ onClose }) {
  const boxRef = useRef(null);
  const [regionId, setRegionId] = useState(REGION_LIST[0].id);
  const [points, setPoints] = useState([]);
  const region = REGION_LIST.find((o) => o.id === regionId);

  const handleClick = (e) => {
    const r = boxRef.current.getBoundingClientRect();
    const cx = Math.round(((e.clientX - r.left) / r.width) * 1000) / 10;
    const cy = Math.round(((e.clientY - r.top) / r.height) * 1000) / 10;
    const p = { id: region.id, label: region.label, cx, cy };
    setPoints((prev) => [...prev, p]);
    console.log(`  [${cx}, ${cy}],  // ${p.label}`);
  };

  const linhas = points
    .map((p) => `[${p.cx}, ${p.cy}],  // ${p.label}`)
    .join('\n');

  return (
    <div className="absolute inset-0 z-40 bg-white flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#EDE7DD] shrink-0">
        <p className="font-serif text-base text-[#2B2A28]">Calibração — Regiões corporais</p>
        <button type="button" onClick={onClose} className="text-[#B6AE9F]"><X size={20} /></button>
      </div>

      <div className="px-4 py-3 shrink-0">
        <label className="text-xs font-semibold uppercase tracking-wide text-[#B6AE9F]">Região atual</label>
        <select value={regionId} onChange={(e) => setRegionId(e.target.value)}
          className="w-full mt-1 rounded-xl border border-[#EDE7DD] p-2 text-sm">
          {REGION_LIST.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <p className="text-xs text-[#7D766A] mt-1">Toque na silhueta fechada para capturar pontos da região selecionada.</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div ref={boxRef} onClick={handleClick}
          className="relative mx-auto cursor-crosshair" style={{ width: 220, aspectRatio: '374/740' }}>
          <img src={DIGESTIVE_IMAGE} alt="Silhueta fechada" className="absolute inset-0 w-full h-full object-contain select-none" draggable={false} />
          {points.map((p, i) => (
            <span key={i} className="absolute rounded-full"
              style={{ left: `${p.cx}%`, top: `${p.cy}%`, width: 8, height: 8, transform: 'translate(-50%,-50%)', background: '#BD5A4A', border: '1px solid #fff' }} />
          ))}
        </div>

        <div className="flex items-center justify-between mt-3 mb-1">
          <span className="text-xs text-[#7D766A]">{points.length} ponto(s) — região: {region.label}</span>
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
  const color = ENTRY_TYPES.pain.color;
  const kindOptions = ['Cólica', 'Queimação', 'Pressão', 'Pontada', 'Distensão'];

  const handleTap = ({ x, y, region }) => {
    if (!region) return;
    setClouds((prev) => {
      // toggle: remove apenas se o toque cair bem em cima de um ponto já marcado
      // (raio pequeno para permitir marcações próximas sem desmarcar a vizinha)
      const idx = prev.findIndex((c) => Math.abs(c.x - x) < 2.5 && Math.abs(c.y - y) < 2.5);
      if (idx !== -1) return prev.filter((_, i) => i !== idx);
      return [...prev, { x, y, region: region.id, regionLabel: region.label }];
    });
  };

  const clearAll = () => {
    setClouds([]);
  };

  const toggleKind = (k) => setKinds((s) => {
    const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n;
  });

  const uniqueRegions = [...new Set(clouds.map((c) => c.regionLabel))];

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
        <p className="text-sm text-center mt-3 min-h-[20px]">
          {clouds.length === 0 ? (
            <span className="text-[#5C5650]">Nenhuma região marcada — toque na silhueta</span>
          ) : (
            <span className="font-semibold" style={{ color }}>{uniqueRegions.join(' · ')}</span>
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
        const regStr  = uniqueRegions.join(' · ');
        const desc    = [kindStr, regStr].filter(Boolean).join(' · ') || 'Dor abdominal';
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

// ─── Registro de Consulta (F2) ───────────────────────────────────────────────
// Seleção de especialidade (chips) + texto livre/ditado sobre a consulta.
// A observação por voz (ObservationStep) complementa o texto digitado.
function MedicalVisitForm({ onSave, customSpecialties, onAddCustom }) {
  const [especialidade, setEspecialidade] = useState('');
  const [novo, setNovo] = useState('');
  const color = ENTRY_TYPES.medicalvisit.color;
  const todasTags = [...SPECIALTY_TAGS, ...customSpecialties];

  const addCustom = () => {
    const t = novo.trim();
    if (!t) return;
    if (!SPECIALTY_TAGS.includes(t) && !customSpecialties.includes(t)) onAddCustom(t);
    setEspecialidade(t);
    setNovo('');
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#B6AE9F] mb-2">Especialidade do profissional</p>
        <div className="flex flex-wrap gap-2">
          {todasTags.map((t) => <Chip key={t} active={especialidade === t} color={color} onClick={() => setEspecialidade(t)}>{t}</Chip>)}
        </div>
        <div className="flex gap-2 mt-2">
          <input value={novo} onChange={(e) => setNovo(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
            placeholder="Adicionar especialidade…"
            className="flex-1 rounded-xl border border-[#EDE7DD] p-2 text-sm focus:outline-none" />
          <button type="button" onClick={addCustom}
            className="w-10 rounded-xl text-white flex items-center justify-center" style={{ background: color }}>
            <Plus size={18} />
          </button>
        </div>
      </div>

      <SaveButton color={color} onClick={() => {
        const nome = especialidade || 'Consulta';
        onSave({ title: nome, description: `Consulta com ${nome}`, meta: { especialidade } });
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

// ─── Form: Peso (registro de peso corporal) ─────────────────────────────────
function WeightForm({ onSave }) {
  const [weight, setWeight] = useState(70.0);
  const color = ENTRY_TYPES.weight.color;
  return (
    <div className="space-y-6">
      <p className="text-sm text-[#7D766A]">Registre seu peso corporal atual</p>
      <div className="text-center">
        <p className="text-5xl font-serif text-[#2B2A28]">{weight.toFixed(1).replace('.', ',')}</p>
        <p className="text-xs text-[#B6AE9F] mt-1">kg</p>
      </div>
      <div className="px-2">
        <input
          type="range"
          min={30}
          max={200}
          step={0.1}
          value={weight}
          onChange={(e) => setWeight(parseFloat(e.target.value))}
          className="w-full bristol-color-slider"
          style={{ background: `linear-gradient(to right, ${color} 0%, ${color} ${((weight - 30) / 170) * 100}%, #EDE7DD ${((weight - 30) / 170) * 100}%, #EDE7DD 100%)` }}
          aria-label="Peso em quilogramas"
        />
        <div className="flex justify-between text-[10px] text-[#B6AE9F] mt-1 px-0.5">
          <span>30 kg</span>
          <span>200 kg</span>
        </div>
      </div>
      <SaveButton color={color}
        onClick={() => onSave({ title: 'Peso', description: `${weight.toFixed(1).replace('.', ',')} kg`, meta: { weight: weight } })} />
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
      {/* Escala de Bristol — grid de imagens com tintagem dinâmica (RF 3.3 / 4.2) */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#B6AE9F] mb-2">Escala de Bristol</p>
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => {
            const isSel = bristol === n;
            const hex = isSel ? (CORES_TINT[cor] || COR_PADRAO_TINT) : COR_PADRAO_TINT;
            return (
              <button key={n} type="button" onClick={() => setBristol(n)}
                aria-label={`Tipo ${n}: ${BRISTOL_DESCRICOES[n]}`}
                className="flex flex-col items-center rounded-xl border overflow-hidden transition-all"
                style={isSel ? { borderColor: color, background: soft } : { borderColor: '#EDE7DD' }}>
                <span className="h-5 flex items-center justify-center text-[10px] font-semibold w-full"
                  style={isSel ? { background: color, color: '#fff' } : { background: '#F1ECE3', color: '#7D766A' }}>
                  {n}
                </span>
                <BristolImage src={BRISTOL_IMGS[n]} tintColor={hex} alt={`Tipo ${n}`}
                  className="w-full h-auto select-none" />
                <span className="block text-[10px] text-[#7D766A] leading-snug text-center px-1 py-1 w-full">{BRISTOL_CURTOS[n]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Cor — slider com 7 stops discretos (RF 3.4) */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#B6AE9F] mb-2">Cor das fezes</p>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={6}
            step={1}
            value={cor ? EVAC_CORES.indexOf(cor) : 1}
            onChange={(e) => setCor(EVAC_CORES[Number(e.target.value)])}
            className="flex-1 bristol-color-slider"
            aria-label="Selecionar cor das fezes"
          />
          <span className="text-xs font-medium text-[#5C5650] min-w-[80px] text-right" style={{ color: CORES_TINT[cor] || '#7D766A' }}>
            {cor || 'Marrom'}
          </span>
        </div>

        <p className="text-[10px] text-[#9A938A] mt-2 leading-relaxed italic">
          As imagens acima são uma referência visual. Na prática, formato e cor podem variar — escolha a opção mais próxima do que você observou.
        </p>
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

// ─── Etapa "Isso aconteceu agora?" (F2) ─────────────────────────────────────
// Pergunta se o registro foi agora, hoje mais cedo ou ontem, antes de
// prosseguir para a observação por voz.
function TimestampStep({ onTimestamp }) {
  const [escolha, setEscolha] = useState(null); // 'agora' | 'hoje' | 'ontem'
  const [hora, setHora] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const timeInputRef = useRef(null);
  const precisaHora = escolha === 'hoje' || escolha === 'ontem';

  useEffect(() => {
    if (precisaHora && timeInputRef.current) {
      timeInputRef.current.focus();
    }
  }, [precisaHora]);

  const [hStr, mStr] = hora.split(':');
  const hNum = parseInt(hStr, 10);
  const mNum = parseInt(mStr, 10);
  const horaValida = !isNaN(hNum) && !isNaN(mNum) && hNum >= 0 && hNum <= 23 && mNum >= 0 && mNum <= 59 && hStr?.length === 2 && mStr?.length === 2;

  const agoraMin = new Date().getHours() * 60 + new Date().getMinutes();
  const entradaMin = hNum * 60 + mNum;
  const horaFutura = escolha === 'hoje' && horaValida && entradaMin > agoraMin;

  function confirmar() {
    if (escolha === 'agora') onTimestamp(null);
    else if (escolha === 'hoje') onTimestamp({ day: 'hoje', time: hora });
    else if (escolha === 'ontem') onTimestamp({ day: 'ontem', time: hora });
  }

  const podeConfirmar = escolha !== null && (!precisaHora || (horaValida && !horaFutura));

  const opcoes = [
    { key: 'agora', label: 'Agora', sub: 'Usar horário atual' },
    { key: 'hoje', label: 'Hoje, mais cedo', sub: 'Escolher horário' },
    { key: 'ontem', label: 'Ontem', sub: 'Escolher horário' },
  ];

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-[#7D766A]">Isso aconteceu agora?</p>
      <div className="flex flex-col gap-2">
        {opcoes.map(({ key, label, sub }) => (
          <button key={key} type="button" onClick={() => setEscolha(key)}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all
              ${escolha === key ? 'ring-2' : 'border border-[#EDE7DD]'}
            `}
            style={{
              background: escolha === key ? '#F5F0E8' : '#FFFBF6',
              ringColor: escolha === key ? 'var(--brand)' : 'transparent',
            }}>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0
              ${escolha === key ? 'border-[var(--brand)]' : 'border-[#D4CBB8]'}`}>
              {escolha === key && <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--brand)' }} />}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-[#2B2A28]">{label}</p>
              <p className="text-xs text-[#B6AE9F]">{sub}</p>
            </div>
          </button>
        ))}
      </div>
      {precisaHora && (
        <div className="flex items-center justify-center gap-2">
          <Clock size={18} className="text-[#B6AE9F]" />
          <input type="text" inputMode="numeric" placeholder="HH:MM" maxLength={5}
            ref={timeInputRef}
            value={hora}
            onChange={(e) => {
              const input = e.target;
              const cursor = input.selectionStart;
              const val = input.value;
              const beforeDigits = val.slice(0, cursor).replace(/\D/g, '').length;
              const digits = val.replace(/\D/g, '').slice(0, 4);
              const formatted = digits.length >= 2 ? digits.slice(0, 2) + ':' + digits.slice(2) : digits;
              setHora(formatted);
              requestAnimationFrame(() => {
                try {
                  let pos = 0, count = 0;
                  while (pos < formatted.length && count < beforeDigits) {
                    if (formatted[pos] !== ':') count++;
                    pos++;
                  }
                  input.setSelectionRange(pos, pos);
                } catch {}
              });
            }}
            className="text-xl font-semibold text-[#2B2A28] bg-transparent border-b-2 border-[#EDE7DD] outline-none px-3 py-2 w-24 text-center tabular-nums" />
          {precisaHora && horaValida && horaFutura && (
            <p className="text-xs text-red-500 ml-1">Horário não pode ser no futuro</p>
          )}
          {precisaHora && !horaValida && hora.length === 5 && (
            <p className="text-xs text-red-500 ml-1">Horário inválido</p>
          )}
        </div>
      )}
      <button type="button" onClick={confirmar} disabled={!podeConfirmar}
        className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
        style={{ background: 'var(--brand)' }}>
        Confirmar
      </button>
    </div>
  );
}

// ─── Etapa de Observação (empurrão suave antes de salvar) ─────────────────────
// Usa Whisper via Cloudflare Pages Function (/api/transcribe) como método
// primário de transcrição. Faz fallback para Web Speech API se o endpoint
// não estiver disponível (ex.: desenvolvimento local sem wrangler).
// Funciona no estilo push-to-talk (estilo WhatsApp): pressiona e segura o
// microfone para gravar; solta para enviar ao Whisper e transcrever.
function ObservationStep({ onConfirm, prompt }) {
  const [note, setNote] = useState('');
  const [discutir, setDiscutir] = useState(false);
  const [prioridade, setPrioridade] = useState(3);

  // Estados da gravação
  const [recState, setRecState] = useState('idle'); // 'idle' | 'recording' | 'transcribing' | 'error'
  const [recError, setRecError] = useState('');
  const [timeLeft, setTimeLeft] = useState(30);

  const MAX_REC_SECONDS = 30;

  // Refs de gravação
  const mediaRecRef = useRef(null);
  const chunksRef   = useRef([]);
  const streamRef   = useRef(null);
  const timerRef    = useRef(null);
  const shouldRecordRef = useRef(false);

  // Web Speech API — fallback para dev local sem wrangler
  const WebSpeech = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;

  // ── Limpa o stream de microfone e timer ao desmontar ────────────────────────
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // ── Para a gravação e dispara onstop → transcribeBlob ──────────────────────
  const stopRecording = useCallback(() => {
    clearInterval(timerRef.current);
    timerRef.current = null;
    setTimeLeft(MAX_REC_SECONDS);
    mediaRecRef.current?.stop();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // ── Envia o blob de áudio para a Pages Function ─────────────────────────────
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
      if (text) setNote((prev) => (prev ? `${prev} ${text}` : text));
      setRecState('idle');
    } catch (err) {
      console.error('[ObservationStep] Whisper error:', err);
      const msg = err.message || '';
      if (/fetch|NetworkError|Failed to fetch|HTTP 5/.test(msg)) {
        setRecError('Sem conexão com o servidor. Escreva manualmente por gentileza.');
      } else {
        setRecError('Não foi possível transcrever. Tente digitar manualmente.');
      }
      setRecState('error');
    }
  }, []);

  // ── Inicia a gravação com MediaRecorder ─────────────────────────────────────
  const startRecording = useCallback(async () => {
    setRecError('');
    chunksRef.current = [];
    setTimeLeft(MAX_REC_SECONDS);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Se o usuário soltou antes do microfone ser ativado, aborta
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

      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        if (blob.size > 0) transcribeBlob(blob);
        else setRecState('idle');
      };

      rec.start();
      setRecState('recording');

      // Timer regressivo de 30s — para automaticamente ao fim
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            stopRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      console.error('[ObservationStep] Microfone negado:', err);
      setRecError('Permissão de microfone negada. Verifique as configurações do navegador.');
      setRecState('error');
    }
  }, [transcribeBlob, stopRecording]);

  // ── Fallback: Web Speech API (desenvolvimento local) ────────────────────────
  const webSpeechRef = useRef(null);
  const toggleWebSpeech = useCallback(() => {
    if (!WebSpeech) return;
    if (recState === 'recording') {
      webSpeechRef.current?.stop();
      return;
    }
    setRecError('');
    try {
      const r = new WebSpeech();
      r.lang = 'pt-BR';
      r.interimResults = false;
      r.continuous = false;
      r.onresult = (e) => {
        const t = Array.from(e.results).map((x) => x[0].transcript).join(' ');
        setNote((prev) => (prev ? `${prev} ${t}` : t));
      };
      r.onend  = () => setRecState('idle');
      r.onerror = () => { setRecState('error'); setRecError('Falha no reconhecimento de voz.'); };
      webSpeechRef.current = r;
      r.start();
      setRecState('recording');
    } catch {
      setRecState('error');
      setRecError('Reconhecimento de voz não suportado.');
    }
  }, [recState, WebSpeech]);

  const hasMicApi  = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  const micSupported = hasMicApi || !!WebSpeech;

  // ── Push-to-talk: handlers de pointer ──────────────────────────────────────
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

  // Fallback toggle para Web Speech API (dev local sem mic API)
  const handleMicClickFallback = useCallback(() => {
    if (hasMicApi) return;
    toggleWebSpeech();
  }, [hasMicApi, toggleWebSpeech]);

  return (
    <div className="space-y-4">
      <div>
        <p className="titulo-cursivo font-serif text-xl text-[#2B2A28]">{prompt?.titulo || 'Quer anotar uma observação?'}</p>
        <p className="text-sm text-[#7D766A] mt-1">Uma nota rápida enriquece seu histórico — algo que vai além dos números.</p>
      </div>

      {/* ── Card de gravação (push-to-talk ativo) ────────────────────────── */}
      {recState === 'recording' && (
        <div className="rounded-xl border border-[#D8D1C4] p-5 flex flex-col items-center gap-3"
          style={{ background: 'rgba(47,107,67,0.04)' }}>
          {/* Mascote com pulso lento */}
          <img
            src={mascoteImage}
            alt=""
            className="w-16 h-16 object-contain animate-mascote-pulse"
          />
          {/* Texto com breathing */}
          <p className="text-sm font-medium text-[#2B2A28] animate-breathing">
            Estou te escutando
            <span className="dots-anim">
              <span>.</span><span>.</span><span>.</span>
            </span>
          </p>
          {/* Timer com bolinha pulsante */}
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#E53935] animate-pulse" />
            <span className="text-xs font-medium text-[#E53935]">{timeLeft}s</span>
          </div>
          {/* Barras de onda sonora */}
          <div className="flex items-end gap-1 h-8">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="w-1.5 rounded-full animate-wave-bar"
                style={{
                  height: `${35 + i * 15}%`,
                  background: 'var(--brand)',
                  animationDelay: `${i * 0.12}s`,
                }}
              />
            ))}
          </div>
          {/* Instrução */}
          <p className="text-xs text-[#B6AE9F]">Solte para enviar</p>
        </div>
      )}

      {/* ── Indicador de transcrição ─────────────────────────────────────── */}
      {recState === 'transcribing' && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(242,194,0,0.10)', border: '1px solid rgba(242,194,0,0.3)' }}>
          <div className="w-4 h-4 border-2 border-[#9A7A00] border-t-transparent rounded-full animate-spinner" />
          <span className="text-xs font-medium text-[#9A7A00]">Transcrevendo…</span>
        </div>
      )}

      {/* ── Erro ─────────────────────────────────────────────────────────── */}
      {recState === 'error' && recError && (
        <div className="px-3 py-2 rounded-xl text-xs"
          style={{ background: 'rgba(189,90,74,0.08)', border: '1px solid rgba(189,90,74,0.25)', color: '#BD5A4A' }}>
          {recError}
        </div>
      )}

      {/* ── Textarea + botão microfone ──────────────────────────────────────
          O botão fica sempre no mesmo lugar (absolute) para que os eventos
          de pointer (push-to-talk) funcionem corretamente. */}
      <div className="relative">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          autoFocus
          disabled={recState === 'transcribing' || recState === 'recording'}
          placeholder={prompt?.placeholder || "Ex: começou ~40 min após o almoço, junto com estufamento… (ou use o microfone)"}
          className="w-full rounded-xl border border-[#EDE7DD] p-3 pr-12 text-sm resize-none focus:outline-none disabled:opacity-60"
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
            onClick={handleMicClickFallback}
            disabled={!micSupported || recState === 'transcribing'}
            aria-label="Ditar observação por voz"
            title={micSupported ? 'Ditar observação por voz' : 'Microfone não disponível neste navegador'}
            className="absolute right-2 bottom-2 w-9 h-9 rounded-full flex items-center justify-center transition-colors disabled:opacity-40"
            style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}
          >
            <Mic size={18} />
          </button>
        )}
      </div>

      {/* ── Hints ────────────────────────────────────────────────────────── */}
      {micSupported && recState === 'idle' && (
        <p className="text-[11px] text-[#B6AE9F] -mt-2">
          🎙 Pressione e segure o microfone para gravar
        </p>
      )}
      {micSupported && recState === 'recording' && (
        <p className="text-[11px] text-[#B6AE9F] -mt-1 text-center">
          A gravação para automaticamente em 30s
        </p>
      )}

      {/* ── Selecionar para discutir na consulta ─────────────────────────── */}
      {recState !== 'recording' && (
        <div className="space-y-3 pt-1">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <div onClick={() => setDiscutir((d) => !d)}
              className="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors"
              style={{
                borderColor: discutir ? 'var(--brand)' : '#D8D1C4',
                background: discutir ? 'var(--brand)' : 'transparent',
              }}>
              {discutir && <Check size={13} className="text-white" strokeWidth={3} />}
            </div>
            <span className="text-sm text-[#2B2A28]">Salvar este registro para discutir com o médico</span>
          </label>

          {discutir && (
            <div className="pl-7 space-y-1.5">
              <p className="text-xs font-medium text-[#7D766A]">Defina o nível de prioridade dessa dúvida ou observação</p>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#B6AE9F] w-8 text-right shrink-0">Baixa</span>
                <div className="flex gap-1.5 flex-1 justify-center">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => setPrioridade(n)}
                      className="w-7 h-7 rounded-full text-xs font-bold transition-all"
                      style={{
                        background: n <= prioridade ? 'var(--brand)' : '#EDE7DD',
                        color: n <= prioridade ? '#fff' : '#B6AE9F',
                        transform: n === prioridade ? 'scale(1.15)' : 'scale(1)',
                      }}>
                      {n}
                    </button>
                  ))}
                </div>
                <span className="text-[11px] text-[#B6AE9F] w-8 shrink-0">Alta</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Botões de confirmação (ocultos durante gravação) ─────────────── */}
      {recState !== 'recording' && (
        <>
          <SaveButton color="var(--brand)" onClick={() => onConfirm({ note: note.trim(), discutir, prioridade })} label="Salvar registro" />
          <button
            type="button"
            onClick={() => onConfirm({ note: '', discutir, prioridade })}
            className="w-full py-2.5 rounded-2xl border text-sm font-medium"
            style={{ borderColor: '#E4DDD2', color: '#7D766A', background: '#FAF7F2' }}
          >
            Salvar sem observação
          </button>
        </>
      )}
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

// ─── Form: Dúvida — texto livre + microfone push-to-talk ───────────────────
// Evento especial: registra perguntas que o usuário quer fazer ao médico.
// A IA refina essas dúvidas no relatório (pergunta_original → pergunta + motivo + mecanismo).
// Microfone replica a lógica do ObservationStep (Whisper via /api/transcribe).
function DuvidaForm({ onSave }) {
  const [texto, setTexto] = useState('');
  const [prioridade, setPrioridade] = useState(3);
  const [recState, setRecState] = useState('idle');
  const [recError, setRecError] = useState('');
  const [timeLeft, setTimeLeft] = useState(30);
  const MAX_REC_SECONDS = 30;
  const mediaRecRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const shouldRecordRef = useRef(false);
  const color = ENTRY_TYPES.duvida.color;

  const WebSpeech = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;
  const hasMicApi = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  const micSupported = hasMicApi || !!WebSpeech;

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
      if (text) setTexto((prev) => (prev ? `${prev} ${text}` : text));
      setRecState('idle');
    } catch (err) {
      console.error('[DuvidaForm] Whisper error:', err);
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
      console.error('[DuvidaForm] Microfone negado:', err);
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

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <HelpCircle size={18} style={{ color }} />
        <p className="text-sm text-[#7D766A]">
          Anote qualquer dúvida que quiser levar ao médico. A IA vai refiná-la no relatório com base no seu diário.
        </p>
      </div>

      {recState === 'recording' && (
        <div className="rounded-xl border border-[#D8D1C4] p-5 flex flex-col items-center gap-3"
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
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(242,194,0,0.10)', border: '1px solid rgba(242,194,0,0.3)' }}>
          <div className="w-4 h-4 border-2 border-[#9A7A00] border-t-transparent rounded-full animate-spinner" />
          <span className="text-xs font-medium text-[#9A7A00]">Transcrevendo…</span>
        </div>
      )}

      {recState === 'error' && recError && (
        <div className="px-3 py-2 rounded-xl text-xs"
          style={{ background: 'rgba(189,90,74,0.08)', border: '1px solid rgba(189,90,74,0.25)', color: '#BD5A4A' }}>
          {recError}
        </div>
      )}

      <div className="relative">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          disabled={recState === 'transcribing' || recState === 'recording'}
          placeholder="Ex: será que a lactose me faz mal? / Dor depois de comer pão é normal? / Quando devo fazer colonoscopia?"
          className="w-full min-h-[120px] p-3 pr-12 rounded-xl text-sm border resize-y focus:outline-none disabled:opacity-60"
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

      {micSupported && recState === 'idle' && (
        <p className="text-[11px] text-[#9A938A] -mt-2">
          🎙 Pressione e segure o microfone para gravar sua dúvida.
        </p>
      )}

      {/* ── Prioridade para discussão na consulta ──────────────────────────── */}
      <div>
        <p className="text-xs font-medium text-[#7D766A] mb-2">Prioridade para discutir na consulta</p>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#B6AE9F] w-8 text-right shrink-0">Baixa</span>
          <div className="flex gap-1.5 flex-1 justify-center">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setPrioridade(n)}
                className="w-7 h-7 rounded-full text-xs font-bold transition-all"
                style={{
                  background: n <= prioridade ? color : '#EDE7DD',
                  color: n <= prioridade ? '#fff' : '#B6AE9F',
                  transform: n === prioridade ? 'scale(1.15)' : 'scale(1)',
                }}>
                {n}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-[#B6AE9F] w-8 shrink-0">Alta</span>
        </div>
      </div>

      <SaveButton color={color} label="Salvar dúvida"
        onClick={() => {
          if (!texto.trim()) return;
          onSave({ title: 'Dúvida', description: texto.trim(), meta: { status: 'pendente', discutir_consulta: true, prioridade } });
        }} />
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

function EntryCard({ entry, onDelete, onZoom, onEdit, onToggleStatus }) {
  const meta = ENTRY_TYPES[entry.type];
  const Icon = meta.icon;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Fecha o menu ao tocar/clicar fora dele. Usa pointerdown (+ touchstart por
  // garantia em alguns navegadores móveis) no document — confiável no toque,
  // diferente do backdrop fixo que falhava em mobile. O alvo dentro do menuRef
  // (inclui o próprio botão de toggle) não dispara o fechamento.
  useEffect(() => {
    if (!menuOpen) return;
    const handleOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('pointerdown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [menuOpen]);

  return (
    <div className="relative flex-1 min-w-0 flex gap-3 bg-white rounded-2xl border border-[#EDE7DD] p-3 items-start shadow-[0_10px_22px_-8px_rgba(31,42,40,0.4)]">
      {/* Marca d'água sutil do ícone do tipo (decorativa, atrás do conteúdo).
          Recortada por um contêiner próprio com overflow-hidden para não vazar
          dos cantos arredondados, sem precisar de overflow-hidden no card raiz
          (que recortaria o dropdown do menu em cards baixos). */}
      <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none" aria-hidden="true"
        style={{ zIndex: 0 }}>
        <div className="absolute -right-2 -bottom-3" style={{ color: meta.color, opacity: 0.07 }}>
          <Icon size={88} strokeWidth={1.5} />
        </div>
      </div>

      <div className="relative z-[1] w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: meta.soft, color: meta.color, border: `1px solid ${meta.color}59`, boxShadow: `0 2px 6px -1px rgba(0,0,0,0.22), inset 0 0 0 1px ${meta.color}1f` }}>
        <Icon size={18} strokeWidth={2.4} />
      </div>
      <div className="relative z-[1] flex-1 min-w-0">
        <p className="entry-text font-medium text-[#2B2A28] text-[0.95em] break-words">{entry.title}</p>
        <p className="entry-text text-[0.95em] mt-0.5 leading-snug break-words" style={{ color: 'var(--ink, #4A443F)' }}>
          <ExpandableText text={entry.description} />
        </p>

        {entry.meta?.discutir_consulta && entry.meta?.prioridade && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => {
                const cor = entry.meta.prioridade >= 4 ? '#BD5A4A' : entry.meta.prioridade >= 3 ? '#C9763A' : '#4A8A5C';
                return (
                  <span key={n} className="w-1.5 h-1.5 rounded-full"
                    style={{ background: n <= entry.meta.prioridade ? cor : '#EDE7DD' }} />
                );
              })}
            </span>
            <span className="text-[10px] text-[#B6AE9F]">Discutir na consulta</span>
          </div>
        )}

        {entry.type === 'pain' && entry.meta && (
          <div className="mt-2 rounded-2xl p-4 flex flex-col items-center shadow-[0_2px_8px_-3px_rgba(0,0,0,0.18)]" style={{ background: meta.soft }}>
            {entry.meta.clouds?.length > 0 && (
              <button type="button" onClick={() => onZoom && onZoom(entry)} aria-label="Ampliar silhueta"
                className="shrink-0 rounded-2xl overflow-hidden bg-white p-1 cursor-zoom-in mb-3" style={{ width: 120 }}>
                <Silhouette clouds={entry.meta.clouds} intensity={entry.meta.intensity} showOrgans />
              </button>
            )}
            <div className="w-full flex flex-col items-center text-center">
              <div className="w-full max-w-[200px]">
                <IntensityBar value={entry.meta.intensity} />
              </div>
              <p className="entry-text text-[11px] font-semibold uppercase tracking-wider mt-2.5"
                style={{ color: corIntensidade(entry.meta.intensity) }}>
                Intensidade {entry.meta.intensity}/10
              </p>
            </div>
          </div>
        )}

        {entry.type === 'sleep' && entry.meta && (
          <div className="mt-2 flex items-center gap-1">
            {[1,2,3,4,5].map((i) => (
              <span key={i} className="w-2 h-2 rounded-full"
                style={i <= entry.meta.quality
                  ? { background: meta.color, boxShadow: '0 1px 3px -1px rgba(0,0,0,0.35)' }
                  : { background: meta.soft, boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.10)' }} />
            ))}
            <span className="text-xs text-[#B6AE9F] ml-1">qualidade {entry.meta.quality}/5</span>
          </div>
        )}

        {entry.type === 'evacuation' && entry.meta && (
          <div className="mt-2 flex items-start gap-2.5">
            <BristolImage
              src={BRISTOL_IMGS[entry.meta.bristol] || bristol4}
              tintColor={CORES_TINT[entry.meta.cor] || COR_PADRAO_TINT}
              alt={`Bristol ${entry.meta.bristol}`}
              className="w-14 h-auto rounded-lg shrink-0"
            />
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full shadow-[0_2px_5px_-2px_rgba(0,0,0,0.22)]"
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

        {entry.type === 'duvida' && (
          <button type="button"
            onClick={() => onToggleStatus && onToggleStatus(entry)}
            className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors"
            style={
              entry.meta?.status === 'resolvida'
                ? { background: 'rgba(74,138,92,0.12)', color: '#4A8A5C' }
                : { background: 'rgba(107,91,149,0.10)', color: '#6B5B95' }
            }>
            {entry.meta?.status === 'resolvida' ? (
              <><CheckCircle2 size={11} /> Resolvida</>
            ) : (
              <><HelpCircle size={11} /> Pendente — tocar para resolver</>
            )}
          </button>
        )}
      </div>

      {/* Menu de Ações do Registro (RF 2.6, 2.7) */}
      <div ref={menuRef} className="relative z-[1] shrink-0">
        <button type="button" aria-label="Ações do registro" aria-haspopup="menu" aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
          className="w-7 h-7 rounded-full flex items-center justify-center text-[#B6AE9F] hover:bg-[#F1ECE3]">
          <EllipsisVertical size={16} />
        </button>
        {menuOpen && (
          <div role="menu" className="absolute right-0 top-8 z-20 bg-white rounded-xl border border-[#EDE7DD] shadow-md py-1 min-w-[132px]">
            <button type="button" role="menuitem"
              onClick={() => { setMenuOpen(false); onEdit && onEdit(entry); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[#F1ECE3]"
              style={{ color: '#4A443F' }}>
              <Pencil size={14} /> Editar
            </button>
            <button type="button" role="menuitem"
              onClick={() => { setMenuOpen(false); onDelete(entry.id); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[#F8EDEA]"
              style={{ color: '#BD5A4A' }}>
              <Trash2 size={14} /> Remover
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Formulário de Edição de Registro (genérico, type-agnostic) ───────────────
// Permite ajustar horário, dia, título, descrição e observação de qualquer
// registro. Campos específicos por tipo (Bristol, silhueta, etc.) são preservados
// intactos no objeto `meta` ao salvar.
function EditEntryForm({ entry, onSave, onCancel }) {
  const [time, setTime] = useState(entry.time || '');
  const [day, setDay] = useState(entry.day || 'hoje');
  const [title, setTitle] = useState(entry.title || '');
  const [description, setDescription] = useState(entry.description || '');
  const [note, setNote] = useState(entry.meta?.note || '');
  const [discutir, setDiscutir] = useState(!!entry.meta?.discutir_consulta);
  const [prioridade, setPrioridade] = useState(entry.meta?.prioridade || 3);

  const [tH, tM] = time.split(':');
  const tHn = parseInt(tH, 10);
  const tMn = parseInt(tM, 10);
  const timeIsValid = !isNaN(tHn) && !isNaN(tMn) && tHn >= 0 && tHn <= 23 && tMn >= 0 && tMn <= 59 && tH?.length === 2 && tM?.length === 2;

  const handleSave = () => {
    onSave({ time, day, title, description, note, discutir, prioridade });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[#7D766A] mb-1.5">Horário</label>
          <input type="text" inputMode="numeric" placeholder="HH:MM" maxLength={5}
            value={time}
            onChange={(e) => {
              const input = e.target;
              const cursor = input.selectionStart;
              const val = input.value;
              const beforeDigits = val.slice(0, cursor).replace(/\D/g, '').length;
              const digits = val.replace(/\D/g, '').slice(0, 4);
              const formatted = digits.length >= 2 ? digits.slice(0, 2) + ':' + digits.slice(2) : digits;
              setTime(formatted);
              requestAnimationFrame(() => {
                try {
                  let pos = 0, count = 0;
                  while (pos < formatted.length && count < beforeDigits) {
                    if (formatted[pos] !== ':') count++;
                    pos++;
                  }
                  input.setSelectionRange(pos, pos);
                } catch {}
              });
            }}
            className="w-full px-3 py-2.5 rounded-2xl border border-[#EDE7DD] text-sm text-[#2B2A28] bg-white tabular-nums" />
          {!timeIsValid && time.length === 5 && (
            <p className="text-xs text-red-500 mt-1">Formato inválido (use HH:MM)</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-[#7D766A] mb-1.5">Dia</label>
          <div className="flex gap-2">
            {[{ k: 'hoje', l: 'Hoje' }, { k: 'ontem', l: 'Ontem' }].map(({ k, l }) => (
              <button key={k} type="button" onClick={() => setDay(k)}
                className="flex-1 px-3 py-2.5 rounded-2xl text-sm border transition-colors"
                style={day === k
                  ? { background: 'var(--brand)', borderColor: 'var(--brand)', color: '#fff' }
                  : { borderColor: '#EDE7DD', color: '#7D766A' }}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-[#7D766A] mb-1.5">Título</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2.5 rounded-2xl border border-[#EDE7DD] text-sm text-[#2B2A28] bg-white" />
      </div>

      <div>
        <label className="block text-xs font-medium text-[#7D766A] mb-1.5">Descrição</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
          className="w-full px-3 py-2.5 rounded-2xl border border-[#EDE7DD] text-sm text-[#2B2A28] bg-white resize-none" />
      </div>

      <div>
        <label className="block text-xs font-medium text-[#7D766A] mb-1.5">Observação</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
          placeholder="Opcional"
          className="w-full px-3 py-2.5 rounded-2xl border border-[#EDE7DD] text-sm text-[#2B2A28] bg-white resize-none" />
      </div>

      <div className="border-t border-[#F1ECE3] pt-3 space-y-3">
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <div onClick={() => setDiscutir((d) => !d)}
            className="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors"
            style={{
              borderColor: discutir ? 'var(--brand)' : '#D8D1C4',
              background: discutir ? 'var(--brand)' : 'transparent',
            }}>
            {discutir && <Check size={13} className="text-white" strokeWidth={3} />}
          </div>
          <span className="text-sm text-[#2B2A28]">Discutir na consulta</span>
        </label>

        {discutir && (
          <div className="flex items-center gap-2 pl-7">
            <span className="text-[11px] text-[#B6AE9F] w-8 text-right shrink-0">Baixa</span>
            <div className="flex gap-1.5 flex-1 justify-center">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setPrioridade(n)}
                  className="w-7 h-7 rounded-full text-xs font-bold transition-all"
                  style={{
                    background: n <= prioridade ? 'var(--brand)' : '#EDE7DD',
                    color: n <= prioridade ? '#fff' : '#B6AE9F',
                    transform: n === prioridade ? 'scale(1.15)' : 'scale(1)',
                  }}>
                  {n}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-[#B6AE9F] w-8 shrink-0">Alta</span>
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel}
          className="flex-1 py-3 rounded-2xl border border-[#EDE7DD] text-[#7D766A] font-medium text-sm">
          Cancelar
        </button>
        <button type="button" onClick={handleSave} disabled={!timeIsValid}
          className="flex-1 py-3 rounded-2xl text-white font-medium text-sm disabled:opacity-40" style={{ background: 'var(--brand)' }}>
          Salvar
        </button>
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
  const [customSpecialties, setCustomSpecialties] = useState([]);                     // especialidades customizadas
  const [inkLevel,   setInkLevel]   = useState(55);                                   // intensidade (brilho) da cor do texto
  const [fontScale,  setFontScale]  = useState(100);                                  // tamanho do texto dos registros (%)
  const [zoom,       setZoom]       = useState(null);                                   // entrada com silhueta ampliada
  const [colapsado,  setColapsado]  = useState(false);                                  // hero recolhido ao rolar a timeline
  const [postponeBubbleUntil, setPostponeBubbleUntil] = useState(0);                  // postpone do mascote lembrete
  const [editing,    setEditing]    = useState(null);                                   // registro em edição (bottom-sheet)
  const [aulaSelecionada, setAulaSelecionada] = useState(null);                          // detalhe da aula (elevado de AulasScreen)
  const [calAberto,  setCalAberto]  = useState(false);                                   // calendário dos Insights (elevado de InsightsScreen)
  const [onboarded,  setOnboarded]  = useState(() => isOnboarded());
  const [profile,    setProfile]    = useState(() => loadProfile());
  const [editandoProfile, setEditandoProfile] = useState(false);
  const [mostrarInstall, setMostrarInstall] = useState(false);                          // banner de instalação PWA
  const deferredPromptRef = useRef(null);                                               // guarda o evento beforeinstallprompt
  const idRef = useRef(100);
  const rafRef = useRef(0);
  const timelineRef = useRef(null);

  // Expande o Resumo/Hero recolhido sem scroll. Disparado ao clicar no card recolhido.
  const expandirResumo = () => {
    setColapsado(false);
  };

  // Navegação por gestos (swipe horizontal entre abas, estilo Instagram).
  // Guarda o ponto inicial do toque e um flag para ignorar gestos quando há
  // overlays abertos ou quando o toque começou num elemento com gesto próprio.
  const swipeRef = useRef({ x: 0, y: 0, t: 0, ignore: false });

  const onFrameTouchStart = (e) => {
    if (e.touches.length !== 1) { swipeRef.current.ignore = true; return; }
    const t = e.touches[0];
    const ignore = Boolean(sheetOpen || activeForm || zoom || calibrando || editing
      || (e.target.closest && e.target.closest('[data-noswipe]')));
    swipeRef.current = { x: t.clientX, y: t.clientY, t: e.timeStamp, ignore };
  };

  const onFrameTouchEnd = (e) => {
    const s = swipeRef.current;
    if (s.ignore || e.changedTouches.length !== 1) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    const dt = e.timeStamp - s.t;
    if (Math.abs(dx) >= 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 700) {
      const idx = ABAS.indexOf(abaAtiva);
      const alvo = dx < 0 ? idx + 1 : idx - 1;
      const novo = Math.max(0, Math.min(ABAS.length - 1, alvo));
      if (novo !== idx) mudarAba(ABAS[novo]);
    }
  };

  // Cabeçalho recolhível: ao rolar a timeline, Hero e Resumo encolhem. Para evitar
  // re-render a cada pixel (jank), só atualizamos o booleano ao cruzar o limiar —
  // com histerese (recolhe acima de ~56px, expande abaixo de ~24px) e throttle por rAF.
  const onTimelineScroll = (e) => {
    const top = e.currentTarget.scrollTop;
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      setColapsado((prev) => {
        if (!prev && top > 56) return true;
        if (prev && top < 24) return false;
        return prev;
      });
    });
  };

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  // Captura do evento beforeinstallprompt para PWA. Exibe banner após onboarding
  // ou após 8 segundos se já onboarded. Não exibe se já instalado ou dispensado.
  useEffect(() => {
    const dismissed = localStorage.getItem('tlgut_install_dismissed') === '1';
    if (dismissed) return; // não exibe novamente após usuário ter dispensado
    if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) return;
    const onPrompt = (e) => {
      e.preventDefault();
      deferredPromptRef.current = e;
      const isNewUser = !isOnboarded();
      const delay = isNewUser ? 99999 : 8000; // após onboarding, o estado muda
      const timer = setTimeout(() => setMostrarInstall(true), delay);
      // Se o onboarding concluir, antecipa a exibição
      const checkOnboarding = setInterval(() => {
        if (isOnboarded()) { clearInterval(checkOnboarding); clearTimeout(timer); setMostrarInstall(true); }
      }, 500);
      // Cleanup se o usuário navegar para longe / prompt expirar
      return () => { clearTimeout(timer); clearInterval(checkOnboarding); };
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  // O gate por aba garante que Perfil/Aulas nunca exibam o estado recolhido.
  // Reseta naturalmente ao trocar de aba.
  const heroColapsado = abaAtiva === 'diario' && colapsado;

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

  // ─── Navegação com botão "Voltar" do dispositivo (History API) ──────────────
  // Ao montar, empurramos uma entrada-barreira no histórico. Quando o usuário
  // aperta "voltar", o popstate dispara; verificamos qual camada está aberta
  // (da mais aninhada à menos) e a fechamos. Se algo foi fechado, re-empurramos
  // a barreira para a próxima vez. Se nada está aberto, deixamos sair.
  const closeTopRef = useRef(null);

  // Wrapper para trocar de aba resetando sub-estados de telas internas.
  const mudarAba = useCallback((aba) => {
    setAbaAtiva(aba);
    setAulaSelecionada(null);
    setCalAberto(false);
  }, []);

  useEffect(() => {
    closeTopRef.current = () => {
      if (pending)          { setPending(null); return true; }
      if (activeForm)       { setPending(null); setActiveForm(null); setSheetOpen(true); return true; }
      if (sheetOpen)        { setSheetOpen(false); return true; }
      if (editing)          { setEditing(null); return true; }
      if (zoom)             { setZoom(null); return true; }
      if (aulaSelecionada)  { setAulaSelecionada(null); return true; }
      if (calAberto)        { setCalAberto(false); return true; }
      if (abaAtiva !== 'diario') { mudarAba('diario'); return true; }
      return false;
    };
  }, [pending, activeForm, sheetOpen, editing, zoom, aulaSelecionada, calAberto, abaAtiva, mudarAba]);

  const lastDepthRef = useRef(0);
  const isPopStateRef = useRef(false);
  const ignoreNextPopStateRef = useRef(false);

  const depth = (abaAtiva !== 'diario' ? 1 : 0) +
                (calAberto ? 1 : 0) +
                (aulaSelecionada ? 1 : 0) +
                (zoom ? 1 : 0) +
                (editing ? 1 : 0) +
                (pending ? 3 : (activeForm ? 2 : (sheetOpen ? 1 : 0)));

  useEffect(() => {
    const diff = depth - lastDepthRef.current;
    if (diff > 0) {
      for (let i = 0; i < diff; i++) {
        history.pushState({ overlay: true }, '');
      }
    } else if (diff < 0) {
      if (!isPopStateRef.current) {
        ignoreNextPopStateRef.current = true;
        history.go(diff);
      }
    }
    lastDepthRef.current = depth;
    isPopStateRef.current = false;
  }, [depth]);

  useEffect(() => {
    const onPopState = () => {
      if (ignoreNextPopStateRef.current) {
        ignoreNextPopStateRef.current = false;
        return;
      }
      isPopStateRef.current = true;
      const closed = closeTopRef.current?.();
      if (!closed) {
        lastDepthRef.current = 0;
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Ordem cronológica natural: mais antigo em cima, mais recente embaixo
  // ("ontem" acima de "hoje"). Dentro de cada dia, ascendente por horário.
  const dayOrder  = ['ontem', 'hoje'];
  const dayLabels = { hoje: 'Registros do dia', ontem: 'Ontem' };

  const grouped = {};
  dayOrder.forEach((d) => {
    grouped[d] = entries.filter((e) => e.day === d).sort((a, b) => a.time.localeCompare(b.time));
  });

  function persistEntry(type, data, ts = null) {
    const now  = new Date();
    const timeExpr = ts && ts.time ? ts.time : `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const dayExpr  = ts && ts.day  ? ts.day  : 'hoje';
    const timestamp = ts?.ts || now.getTime();
    idRef.current += 1;
    setEntries((prev) => [...prev, { id: idRef.current, ts: timestamp, day: dayExpr, time: timeExpr, type, ...data }]);
  }

  // Passo 1: ao salvar, abre a etapa de observação (empurrão suave) em vez de
  // persistir imediatamente.
  function requestSave(type, data) {
    setPending({ type, data });
  }

  function setPendingTimestamp(ts) {
    setPending((p) => (p ? { ...p, timestamp: ts } : p));
  }

  // Passo 2: confirma com (ou sem) observação e persiste o registro.
  function commitSave(payload) {
    if (!pending) return;
    const { type, data, timestamp } = pending;
    const meta = { ...(data.meta || {}) };
    if (typeof payload === 'string') {
      if (payload) meta.note = payload;
    } else {
      if (payload.note) meta.note = payload.note;
      if (payload.discutir) {
        meta.discutir_consulta = true;
        meta.prioridade = payload.prioridade || 3;
      }
    }
    const finalData = { ...data };
    if (Object.keys(meta).length) finalData.meta = meta;
    persistEntry(type, finalData, timestamp);
    setPending(null);
    setActiveForm(null);
  }

  function handleDelete(id) {
    setEntries((prev) => removerEntrada(prev, id)); // RF 2.7 (núcleo puro)
  }

  function handleToggleStatus(entry) {
    setEntries((prev) => prev.map((e) => {
      if (e.id !== entry.id) return e;
      const meta = { ...(e.meta || {}) };
      meta.status = meta.status === 'resolvida' ? 'pendente' : 'resolvida';
      return { ...e, meta };
    }));
  }

  // Edição genérica (RF 2.6): atualiza apenas time/day/title/description/meta.note,
  // preservando os demais campos de meta (bristol, intensity, clouds, tags, inicioTs…).
  function concluirOnboarding(p) {
    saveProfile(p);
    localStorage.setItem('tlgut_onboarded', '1');
    setProfile(p);
    setOnboarded(true);
    setEditandoProfile(false);
  }

  function pularOnboarding() {
    localStorage.setItem('tlgut_onboarded', '1');
    setOnboarded(true);
    setEditandoProfile(false);
  }

  const [showBubble, setShowBubble] = useState(false);

  useEffect(() => {
    if (entries.length === 0) return;
    const LIMITE_MS = 6 * 3600000;
    const INTERVALO_MS = 5 * 60000;
    const timer = setInterval(() => {
      if (sheetOpen || activeForm || editing || onboarded === false) return;
      if (Date.now() < postponeBubbleUntil) { setShowBubble(false); return; }
      const lastTs = entries
        .map(e => e.ts || e.timestamp || 0)
        .filter(Boolean)
        .reduce((max, ts) => Math.max(max, ts), 0);
      if (lastTs && Date.now() - lastTs > LIMITE_MS) setShowBubble(true);
    }, INTERVALO_MS);
    return () => clearInterval(timer);
  }, [entries, sheetOpen, activeForm, editing, onboarded, postponeBubbleUntil]);

  function dismissBubble(postpone) {
    setShowBubble(false);
    if (postpone) setPostponeBubbleUntil(Date.now() + 2 * 3600000);
  }

  function handleSaveEdit({ time, day, title, description, note, discutir, prioridade }) {
    if (!editing) return;
    setEntries((prev) => prev.map((e) => {
      if (e.id !== editing.id) return e;
      const meta = { ...(e.meta || {}) };
      if (note) meta.note = note; else delete meta.note;
      if (discutir) {
        meta.discutir_consulta = true;
        meta.prioridade = prioridade || 3;
      } else {
        delete meta.discutir_consulta;
        delete meta.prioridade;
      }
      const next = { ...e, time, day, title, description };
      if (Object.keys(meta).length) next.meta = meta; else delete next.meta;
      return next;
    }));
    setEditing(null);
  }

  const inkL = 38 - (inkLevel / 100) * 22;            // 38% (mais claro) → 16% (mais forte)
  const inkColor = `hsl(30, 8%, ${inkL}%)`;
  const inkSoftColor = `hsl(30, 7%, ${inkL + 10}%)`;

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-[#EDE7DD] sm:p-6 font-sans">
      <div
        data-theme={tema}
        className={`relative w-full max-w-[420px] h-[100dvh] sm:h-[844px] sm:rounded-[2.5rem] sm:shadow-2xl overflow-hidden flex flex-col ${cursiva ? 'cursiva' : ''}`}
        style={{ background: 'linear-gradient(180deg, var(--amb-bg-1) 0%, var(--amb-bg-2) 100%)', '--ink': inkColor, '--ink-soft': inkSoftColor, '--font-scale': fontScale / 100, paddingTop: 'env(safe-area-inset-top)' }}
        onTouchStart={onFrameTouchStart}
        onTouchEnd={onFrameTouchEnd}
      >
        {/* Ambiência decorativa de fundo (atrás de todo o conteúdo) */}
        <AmbianceLayer theme={tema} />

        {/* Conteúdo da aba ativa — wrapper com key para transição suave ao trocar de aba */}
        <div key={abaAtiva} className="tg-aba-anim relative z-10 flex-1 flex flex-col min-h-0">
        {abaAtiva === 'diario' ? (
          <>
            <HeroHeader colapsado={heroColapsado} />
            {/* Card de Resumo do Dia (RF 2.2, 2.3) — elevado e com sombra sobre os eventos */}
            <DaySummaryCard dateLabel="Sexta-feira, 12 de junho" entries={entries} colapsado={heroColapsado} onExpand={expandirResumo} />

            {/* Timeline conectada (RF 2.4–2.8) */}
            <main ref={timelineRef} className="relative z-10 flex-1 overflow-y-auto px-5 pb-28"
              onScroll={onTimelineScroll}
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
                              <EntryCard entry={entry} onDelete={handleDelete} onZoom={setZoom} onEdit={setEditing} onToggleStatus={handleToggleStatus} />
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
          <InsightsScreen calAberto={calAberto} onCalAberto={setCalAberto} entries={entries} />
        ) : abaAtiva === 'perfil' ? (
          <ProfileScreen cursiva={cursiva} onCursiva={setCursiva} inkLevel={inkLevel} onInk={setInkLevel} fontScale={fontScale} onFont={setFontScale} profile={profile} onEditarProfile={() => setEditandoProfile(true)} />
        ) : (
          <AulasScreen selecionado={aulaSelecionada} onSelecionado={setAulaSelecionada} />
        )}
        </div>

        {/* Menu de Navegação Inferior (RF 3) */}
        <BottomNav abaAtiva={abaAtiva} onChangeAba={mudarAba} onAdd={() => setSheetOpen(true)} />

        {/* Banner de instalação PWA */}
        {mostrarInstall && (
          <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+4rem)] left-3 right-3 z-30 max-w-[420px] mx-auto">
            <div className="flex items-center gap-3 rounded-2xl p-3 shadow-[0_8px_24px_-6px_rgba(0,0,0,0.25)]"
              style={{ background: '#FFFBF6', border: '1px solid #EDE7DD' }}>
              <img src={mascoteImage} alt="" className="w-10 h-10 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#2B2A28]">Instalar aplicativo</p>
                <p className="text-[11px] text-[#7D766A] leading-snug">Adicione à tela inicial para acesso rápido.</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button type="button" onClick={() => { setMostrarInstall(false); localStorage.setItem('tlgut_install_dismissed', '1'); }}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#7D766A]"
                  style={{ background: 'rgba(150,140,120,0.1)' }}>
                  Depois
                </button>
                <button type="button"
                  onClick={async () => {
                    setMostrarInstall(false);
                    if (!deferredPromptRef.current) return;
                    deferredPromptRef.current.prompt();
                    const { outcome } = await deferredPromptRef.current.userChoice;
                    deferredPromptRef.current = null;
                    if (outcome === 'accepted') localStorage.setItem('tlgut_install_dismissed', '1');
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white"
                  style={{ background: 'var(--brand)' }}>
                  Instalar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mascote lembrete — balão flutuante quando inatividade > 6h */}
        {showBubble && (
          <div className="fixed bottom-24 right-4 z-30 max-w-[260px] animate-in"
            style={{ animation: 'tgAbaFade 0.25s ease-out' }}>
            <div className="rounded-2xl p-3 shadow-[0_8px_24px_-6px_rgba(0,0,0,0.25)]"
              style={{ background: '#FFFBF6', border: '1px solid #EDE7DD' }}>
              <div className="flex items-start gap-2.5">
                <img src={mascoteImage} alt="Mascote" className="w-9 h-9 shrink-0 animate-mascote-pulse" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[#2B2A28] font-medium leading-snug">Esqueceu de registrar algo?</p>
                  <div className="flex gap-2 mt-2">
                    <button type="button" onClick={() => { dismissBubble(false); setSheetOpen(true); }}
                      className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold text-white"
                      style={{ background: 'var(--brand)' }}>
                      Registrar agora
                    </button>
                    <button type="button" onClick={() => dismissBubble(true)}
                      className="py-1.5 px-2 rounded-lg text-[10px] text-[#7D766A]"
                      style={{ border: '1px solid #EDE7DD' }}>
                      Depois
                    </button>
                  </div>
                </div>
                <button type="button" onClick={() => dismissBubble(true)} className="shrink-0 text-[#B6AE9F]">
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Ferramenta temporária de calibração de pontos (dev) */}
        {calibrando && <CalibrationOverlay onClose={() => setCalibrando(false)} />}

        {/* Zoom da silhueta do registro de dor */}
        {zoom && <SilhouetteZoom entry={zoom} onClose={() => setZoom(null)} />}

        {/* Sheet: edição genérica de registro (RF 2.6) */}
        <div className={`absolute inset-0 transition-opacity duration-300 z-40 ${editing ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
          <div className="absolute inset-0 bg-black/30" onClick={() => setEditing(null)} />
          <div className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl flex flex-col max-h-[92%] transition-transform duration-300 ${editing ? 'translate-y-0' : 'translate-y-full'}`}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[#F1ECE3] shrink-0">
              <span className="w-5" />
              <p className="titulo-cursivo font-serif text-base text-[#2B2A28]">Editar registro</p>
              <button onClick={() => setEditing(null)} className="text-[#B6AE9F]" aria-label="Fechar edição"><X size={20} /></button>
            </div>
            <div className="px-5 py-4 overflow-y-auto flex-1">
              {editing && (
                <EditEntryForm entry={editing} onSave={handleSaveEdit} onCancel={() => setEditing(null)} />
              )}
            </div>
          </div>
        </div>

        {/* Sheet: type picker */}
        <div className={`absolute inset-0 transition-opacity duration-300 z-20 ${sheetOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
          <div className="absolute inset-0 bg-black/30" onClick={() => setSheetOpen(false)} />
          <div className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-5 pb-8 transition-transform duration-300 ${sheetOpen ? 'translate-y-0' : 'translate-y-full'}`}>
            <div className="w-10 h-1.5 bg-[#EDE7DD] rounded-full mx-auto mb-4" />
            <p className="titulo-cursivo text-center font-serif text-lg text-[#2B2A28] mb-4">O que você quer registrar?</p>
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
          <div className="absolute inset-0 bg-black/30" onClick={() => { setPending(null); setActiveForm(null); }} />
          <div className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl flex flex-col max-h-[92%] transition-transform duration-300 ${activeForm ? 'translate-y-0' : 'translate-y-full'}`}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[#F1ECE3] shrink-0">
              <button onClick={() => { if (pending) setPending(null); else { setActiveForm(null); setSheetOpen(true); } }} className="text-[#B6AE9F]">
                <ChevronLeft size={20} />
              </button>
              <p className="titulo-cursivo font-serif text-xl text-[#2B2A28]">{activeForm && ENTRY_TYPES[activeForm].label}</p>
              <button onClick={() => { setPending(null); setActiveForm(null); }} className="text-[#B6AE9F]"><X size={20} /></button>
            </div>
            <div className="px-5 py-4 overflow-y-auto flex-1">
              {pending ? (
                'timestamp' in pending ? (
                  <ObservationStep onConfirm={commitSave}
                    prompt={OBSERVATION_PROMPTS[pending.type]} />
                ) : (
                  <TimestampStep onTimestamp={setPendingTimestamp} />
                )
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
                  {activeForm === 'weight' && <WeightForm onSave={(d) => requestSave('weight', d)} />}
                  {activeForm === 'medicalvisit' && <MedicalVisitForm
                    onSave={(d) => requestSave('medicalvisit', d)}
                    customSpecialties={customSpecialties}
                    onAddCustom={(t) => setCustomSpecialties((c) => [...c, t])}
                  />}
                  {activeForm === 'duvida' && <DuvidaForm onSave={(d) => requestSave('duvida', d)} />}
                </>
              )}
            </div>
          </div>
        </div>

      </div>
      {(!onboarded || editandoProfile) && (
        <OnboardingModal initialProfile={editandoProfile ? profile : undefined}
          onConcluir={concluirOnboarding}
          onPularTudo={!onboarded ? pularOnboarding : undefined} />
      )}

    </div>
  );
}
