import digestiveImage from './assets/sisdiges.jpg';
import digestiveClosedImage from './assets/sisdiges_fechado.jpg';
import mascoteImage from './assets/mascote.png';
import capaExemplo from './assets/capaexemplo.jpg';
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  Plus, X, ChevronLeft, Utensils, Droplet, Moon, Flame, Activity, Smile, Mic, Check, Minus,
  Leaf, PenLine, EllipsisVertical, ChartColumn, Trash2, Pencil,
  BookOpen, Lightbulb, GraduationCap, User, ChevronRight, Calendar, Wind, Pill, Droplets,
  ArrowLeft, Cast, Lock, Play, Clock, BarChart3, CheckCircle2, ShoppingBag,
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
const CURSIVE_STACK = '"Caveat", "Segoe Print", "Bradley Hand", cursive';

function HeroHeader({ colapsado = false }) {
  return (
    <header
      className="relative z-10 shrink-0 px-5 overflow-hidden"
      style={{
        // Gradiente sutil + leve brilho radial no canto superior direito (atrás do
        // mascote) para dar profundidade sem comprometer o contraste do texto branco.
        background:
          'radial-gradient(120% 90% at 88% 4%, rgba(120,196,140,0.22) 0%, rgba(120,196,140,0) 55%), linear-gradient(165deg, var(--brand) 0%, var(--brand-deep) 62%)',
        paddingTop: colapsado ? '0.75rem' : '1.5rem',
        paddingBottom: colapsado ? '0.5rem' : '2.25rem',
        borderBottomLeftRadius: colapsado ? 16 : 28,
        borderBottomRightRadius: colapsado ? 16 : 28,
        transition: 'padding 500ms ease, border-radius 500ms ease',
        willChange: 'padding, border-radius',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/* Título EXPANDIDO: "Meu diário" cursivo menor + "Intestinal" grande cursivo */}
          <div
            className="overflow-hidden pr-3"
            style={{
              maxHeight: colapsado ? 0 : '7rem',
              opacity: colapsado ? 0 : 1,
              transition: 'max-height 500ms ease, opacity 500ms ease',
              willChange: 'max-height, opacity',
              transform: 'translateZ(0)',
              backfaceVisibility: 'hidden',
              contain: 'layout paint',
            }}
          >
            <p className="text-2xl leading-[1.25]" style={{ fontFamily: CURSIVE_STACK, color: 'rgba(255,255,255,0.95)' }}>Meu diário</p>
            <p className="text-5xl leading-[1.25] -mt-1" style={{ fontFamily: CURSIVE_STACK, color: '#fff' }}>
              Intestinal
            </p>
          </div>
          {/* Título COLAPSADO: "Meu diário intestinal" em cursiva, compacto */}
          <div
            className="overflow-hidden pr-3"
            style={{
              maxHeight: colapsado ? '3.25rem' : 0,
              opacity: colapsado ? 1 : 0,
              transition: 'max-height 500ms ease, opacity 500ms ease',
              willChange: 'max-height, opacity',
              transform: 'translateZ(0)',
              backfaceVisibility: 'hidden',
              contain: 'layout paint',
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
              transition: 'width 500ms ease, height 500ms ease',
            }}>
            <EllipsisVertical size={colapsado ? 16 : 18} />
          </button>
        </div>
      </div>

      {/* Mascote — anima via transform (scale/translate, compositado por GPU) para
          encolher e subir suavemente até a barra fina ao colapsar. */}
      <img
        src={mascoteImage}
        alt="Mascote do Diário Intestinal"
        className="absolute right-3 top-2 w-24 h-24 object-contain select-none pointer-events-none drop-shadow-lg"
        style={{
          transformOrigin: 'top right',
          transform: colapsado ? 'translate(-40px, -2px) scale(0.33)' : 'translateZ(0)',
          transition: 'transform 500ms ease, opacity 500ms ease',
          willChange: 'transform',
          backfaceVisibility: 'hidden',
        }}
        draggable={false}
      />
    </header>
  );
}

// ─── Card de Resumo do Dia (RF 2.2, 2.3) ──────────────────────────────────────
// `colapsado` recolhe o card para um strip fino (só o cabeçalho), ocultando
// suavemente os chips e a linha do ciclo. Os dados permanecem montados.
function DaySummaryCard({ dateLabel, entries, cicloAtivo = false, colapsado = false, onExpand }) {
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
    <div
      className={`day-summary-mesh relative z-20 mx-5 mb-0 shrink-0 overflow-hidden rounded-2xl border border-[#EDE7DD] ${colapsado ? 'p-2 -mt-3 shadow-[0_8px_18px_-12px_rgba(0,0,0,0.4)] cursor-pointer' : 'p-4 -mt-5 shadow-[0_16px_32px_-12px_rgba(0,0,0,0.5)]'}`}
      style={{ transition: 'padding 500ms ease, margin 500ms ease, box-shadow 500ms ease', willChange: 'margin, padding', transform: 'translateZ(0)', backfaceVisibility: 'hidden', contain: 'layout paint' }}
      {...(colapsado ? { onClick: onExpand, role: 'button', 'aria-expanded': false, tabIndex: 0 } : {})}>
      <div className={`relative z-[1] flex items-center justify-between gap-2 ${colapsado ? 'mb-0' : 'mb-3'}`}
        style={{ transition: 'margin 500ms ease' }}>
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
        style={{ maxHeight: colapsado ? 0 : '320px', opacity: colapsado ? 0 : 1, transition: 'max-height 500ms ease, opacity 500ms ease', willChange: 'max-height, opacity', contain: 'layout paint' }}>
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
            <div className="mt-4 overflow-hidden rounded-2xl border shadow-sm transition-all" style={{ borderColor: 'rgba(189,90,74,0.15)', background: 'linear-gradient(to bottom, #FAF7F2, #FFF)' }}>
              <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'rgba(189,90,74,0.1)', background: 'rgba(189,90,74,0.05)' }}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#BD5A4A', boxShadow: '0 0 0 2px rgba(189,90,74,0.2)' }} />
                <p className="font-bold text-sm" style={{ color: '#BD5A4A' }}>{ORGAN_LABELS[sel]}</p>
              </div>
              <div className="p-4 pt-3 text-xs text-[#4A443F] space-y-3">
                <div className="flex gap-4">
                  <div><span className="block text-[#9A938A] text-[11px] uppercase font-semibold mb-0.5">Registros</span><strong className="text-xl text-[#2B2A28] leading-none">{ctx.n}</strong></div>
                  <div><span className="block text-[#9A938A] text-[11px] uppercase font-semibold mb-0.5">Frequência</span><strong className="text-xl text-[#2B2A28] leading-none">{Math.round(ctx.share * 100)}%</strong></div>
                  <div><span className="block text-[#9A938A] text-[11px] uppercase font-semibold mb-0.5">Intensidade</span><strong className="text-xl text-[#2B2A28] leading-none">{ctx.intensidadeMedia.toFixed(1)}</strong><span className="text-[11px] font-medium ml-0.5 text-[#9A938A]">/ 10</span></div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2 pt-3 border-t border-[#EFE7DD]">
                  {ctx.aguaNesses != null && ctx.aguaGeral != null && (
                    <div className="bg-white p-2 rounded-lg border border-[#EDE7DD]">
                      <span className="block text-[#9A938A] text-[10px] uppercase font-bold tracking-wide mb-0.5">Água (média/dia)</span>
                      <span className="font-medium text-[#2B2A28]">{ctx.aguaNesses.toFixed(1)} copos</span>
                    </div>
                  )}
                  {ctx.sonoNesses != null && ctx.sonoGeral != null && (
                    <div className="bg-white p-2 rounded-lg border border-[#EDE7DD]">
                      <span className="block text-[#9A938A] text-[10px] uppercase font-bold tracking-wide mb-0.5">Sono (qualidade)</span>
                      <span className="font-medium text-[#2B2A28]">{ctx.sonoNesses.toFixed(1)} <span className="text-[10px] text-[#9A938A]">/ 5</span></span>
                    </div>
                  )}
                  {ctx.humorMedio != null && (
                    <div className="bg-white p-2 rounded-lg border border-[#EDE7DD]">
                      <span className="block text-[#9A938A] text-[10px] uppercase font-bold tracking-wide mb-0.5">Humor Médio</span>
                      <span className="font-medium text-[#2B2A28]">{ctx.humorMedio.toFixed(1)} <span className="text-[10px] text-[#9A938A]">/ 5</span></span>
                    </div>
                  )}
                  {ctx.bristolMedio != null && (
                    <div className="bg-white p-2 rounded-lg border border-[#EDE7DD]">
                      <span className="block text-[#9A938A] text-[10px] uppercase font-bold tracking-wide mb-0.5">Fezes (Bristol)</span>
                      <span className="font-medium text-[#2B2A28]">Tipo {ctx.bristolMedio.toFixed(1)}</span>
                    </div>
                  )}
                </div>

                {ctx.alimentosFrequentes.length > 0 && (
                  <div className="pt-2">
                    <span className="block text-[#9A938A] text-[10px] uppercase font-bold tracking-wide mb-1.5">Gatilhos Alimentares Potenciais</span>
                    <div className="flex flex-wrap gap-1.5">
                      {ctx.alimentosFrequentes.map((a) => (
                        <span key={a.tag}
                          className="inline-flex items-center rounded-md bg-white border border-[#EFE7DD] px-2 py-1 text-xs font-medium text-[#4A443F] shadow-sm">
                          {a.tag} <span className="ml-1 opacity-50 font-normal">({a.n})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
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
function PainScrubber({ history, onScrub }) {
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

// Tela de Relatórios IA (futuro): resumo gerado por inteligência artificial a
// partir dos dados do diário. Por enquanto exibe um mock visual do que o usuário
// receberá quando a funcionalidade estiver integrada.
function RelatoriosIAScreen() {
  const [gerando, setGerando] = useState(false);
  const [pronto, setPronto] = useState(false);

  const gerar = () => {
    setGerando(true);
    setTimeout(() => { setGerando(false); setPronto(true); }, 2000);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border p-4 shadow-[0_10px_24px_-10px_rgba(31,42,40,0.4)]"
        style={{ background: 'rgba(255,255,255,0.7)', borderColor: 'rgba(150,140,120,0.25)' }}>
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(127,200,140,0.18)', color: '#4A8A5C' }}>
            <Lightbulb size={20} />
          </span>
          <div>
            <p className="font-medium text-[#2B2A28]">Relatório semanal com IA</p>
            <p className="text-xs text-[#7D766A]">Resumo personalizado dos seus registros</p>
          </div>
        </div>
        <p className="text-sm text-[#4A443F] mt-3 leading-relaxed">
          A IA analisa seus sintomas, alimentação, sono e humor para apontar padrões e sugerir pontos de atenção de forma clara e objetiva.
        </p>
        <button type="button" onClick={gerar} disabled={gerando}
          className="mt-4 w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-60 transition-opacity"
          style={{ background: 'var(--brand)', color: '#fff' }}>
          {gerando ? 'Analisando seus dados...' : 'Gerar relatório'}
        </button>
      </div>

      {pronto && (
        <div className="rounded-2xl border p-4 shadow-[0_10px_24px_-10px_rgba(31,42,40,0.4)]"
          style={{ background: 'rgba(255,255,255,0.85)', borderColor: 'rgba(150,140,120,0.25)' }}>
          <p className="titulo-cursivo text-lg font-serif text-[#2B2A28]">Resumo da semana</p>
          <ul className="mt-3 space-y-2 text-sm text-[#4A443F]">
            <li className="flex gap-2">
              <span style={{ color: '#4A8A5C' }}>•</span>
              <span>Hidratação manteve-se estável, com média de 6 copos/dia.</span>
            </li>
            <li className="flex gap-2">
              <span style={{ color: '#4A8A5C' }}>•</span>
              <span>Picos de desconforto abdominal coincidiram com refeições mais gordurosas.</span>
            </li>
            <li className="flex gap-2">
              <span style={{ color: '#4A8A5C' }}>•</span>
              <span>Sono de qualidade moderada (média 3,2/5) — ocorreu melhora após dias com exercício leve.</span>
            </li>
          </ul>
          <p className="text-[11px] text-[#7D766A] mt-3 italic">
            Este é um exemplo do formato futuro. Os dados reais virão da análise dos seus registros.
          </p>
        </div>
      )}
    </div>
  );
}

function InsightsScreen({ calAberto, onCalAberto }) {
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
      ) : (
        <div className="mt-3">
          <RelatoriosIAScreen />
        </div>
      )}
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
// Usa Whisper via Cloudflare Pages Function (/api/transcribe) como método
// primário de transcrição. Faz fallback para Web Speech API se o endpoint
// não estiver disponível (ex.: desenvolvimento local sem wrangler).
// Funciona no estilo push-to-talk (estilo WhatsApp): pressiona e segura o
// microfone para gravar; solta para enviar ao Whisper e transcrever.
function ObservationStep({ onConfirm }) {
  const [note, setNote] = useState('');

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
        <p className="titulo-cursivo font-serif text-xl text-[#2B2A28]">Quer anotar uma observação?</p>
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
          <span className="text-xs font-medium text-[#9A7A00]">Transcrevendo com Whisper AI…</span>
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
          placeholder="Ex: começou ~40 min após o almoço, junto com estufamento… (ou use o microfone)"
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

      {/* ── Botões de confirmação (ocultos durante gravação) ─────────────── */}
      {recState !== 'recording' && (
        <>
          <SaveButton color="var(--brand)" onClick={() => onConfirm(note.trim())} label="Salvar registro" />
          <button
            type="button"
            onClick={() => onConfirm('')}
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

function EntryCard({ entry, onDelete, onZoom, onEdit }) {
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
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
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

  const handleSave = () => {
    onSave({ time, day, title, description, note });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[#7D766A] mb-1.5">Horário</label>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
            className="w-full px-3 py-2.5 rounded-2xl border border-[#EDE7DD] text-sm text-[#2B2A28] bg-white tabular-nums" />
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

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel}
          className="flex-1 py-3 rounded-2xl border border-[#EDE7DD] text-[#7D766A] font-medium text-sm">
          Cancelar
        </button>
        <button type="button" onClick={handleSave}
          className="flex-1 py-3 rounded-2xl text-white font-medium text-sm" style={{ background: 'var(--brand)' }}>
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
  const [inkLevel,   setInkLevel]   = useState(55);                                   // intensidade (brilho) da cor do texto
  const [fontScale,  setFontScale]  = useState(100);                                  // tamanho do texto dos registros (%)
  const [zoom,       setZoom]       = useState(null);                                   // entrada com silhueta ampliada
  const [cicloAtivo, setCicloAtivo] = useState(false);                                  // acompanhamento de ciclo opt-in (RF 16.1)
  const [colapsado,  setColapsado]  = useState(false);                                  // hero recolhido ao rolar a timeline
  const [editing,    setEditing]    = useState(null);                                   // registro em edição (bottom-sheet)
  const [aulaSelecionada, setAulaSelecionada] = useState(null);                          // detalhe da aula (elevado de AulasScreen)
  const [calAberto,  setCalAberto]  = useState(false);                                   // calendário dos Insights (elevado de InsightsScreen)
  const idRef = useRef(100);
  const rafRef = useRef(0);
  const timelineRef = useRef(null);

  // Expande o Resumo/Hero recolhido: rola a timeline ao topo (o handler de scroll
  // expande via histerese quando top < 24). Disparado ao clicar no card recolhido.
  const expandirResumo = () => {
    timelineRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
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

  // Edição genérica (RF 2.6): atualiza apenas time/day/title/description/meta.note,
  // preservando os demais campos de meta (bristol, intensity, clouds, tags, inicioTs…).
  function handleSaveEdit({ time, day, title, description, note }) {
    if (!editing) return;
    setEntries((prev) => prev.map((e) => {
      if (e.id !== editing.id) return e;
      const meta = { ...(e.meta || {}) };
      if (note) meta.note = note; else delete meta.note;
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
    <div className="min-h-screen w-full flex items-center justify-center bg-[#EDE7DD] sm:p-6 font-sans">
      <div
        data-theme={tema}
        className={`relative w-full max-w-[420px] h-screen sm:h-[844px] sm:rounded-[2.5rem] sm:shadow-2xl overflow-hidden flex flex-col ${cursiva ? 'cursiva' : ''}`}
        style={{ background: 'linear-gradient(180deg, var(--amb-bg-1) 0%, var(--amb-bg-2) 100%)', '--ink': inkColor, '--ink-soft': inkSoftColor, '--font-scale': fontScale / 100 }}
        onTouchStart={onFrameTouchStart}
        onTouchEnd={onFrameTouchEnd}
      >
        {/* Ambiência decorativa de fundo (atrás de todo o conteúdo) */}
        <AmbianceLayer theme={tema} />

        {abaAtiva !== 'insights' && abaAtiva !== 'aulas' && <HeroHeader colapsado={heroColapsado} />}

        {/* Conteúdo da aba ativa — wrapper com key para transição suave ao trocar de aba */}
        <div key={abaAtiva} className="tg-aba-anim relative z-10 flex-1 flex flex-col min-h-0">
        {abaAtiva === 'diario' ? (
          <>
            {/* Card de Resumo do Dia (RF 2.2, 2.3) — elevado e com sombra sobre os eventos */}
            <DaySummaryCard dateLabel="Sexta-feira, 12 de junho" entries={entries} cicloAtivo={cicloAtivo} colapsado={heroColapsado} onExpand={expandirResumo} />

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
                              <EntryCard entry={entry} onDelete={handleDelete} onZoom={setZoom} onEdit={setEditing} />
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
          <InsightsScreen calAberto={calAberto} onCalAberto={setCalAberto} />
        ) : abaAtiva === 'perfil' ? (
          <ProfileScreen cursiva={cursiva} onCursiva={setCursiva} inkLevel={inkLevel} onInk={setInkLevel} fontScale={fontScale} onFont={setFontScale} cicloAtivo={cicloAtivo} onCiclo={setCicloAtivo} />
        ) : (
          <AulasScreen selecionado={aulaSelecionada} onSelecionado={setAulaSelecionada} />
        )}
        </div>

        {/* Menu de Navegação Inferior (RF 3) */}
        <BottomNav abaAtiva={abaAtiva} onChangeAba={mudarAba} onAdd={() => setSheetOpen(true)} />

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
              <p className="titulo-cursivo font-serif text-xl text-[#2B2A28]">{activeForm && ENTRY_TYPES[activeForm].label}</p>
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
