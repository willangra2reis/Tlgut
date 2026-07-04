// Mapa de cores de UI para tintagem dinâmica das imagens da Escala de Bristol.
// Estas hex APENAS alimentam o canvas de tintagem visual — não substituem
// EVAC_CORES (que continua salvando strings pt-BR no meta.cor do registro).
export const CORES_TINT = {
  'Marrom claro':  '#B08E5E',
  'Marrom':        '#7A4E29',
  'Marrom escuro': '#4A2D18',
  'Amarelada':     '#C9A227',
  'Esverdeada':    '#6B8E23',
  'Avermelhada':   '#9B3A1A',
  'Escura':        '#1F1410',
};

// Cor de tintagem padrão quando o usuário ainda não selecionou cor
// (meta.cor === null). Visualmente marrom neutro, mas NÃO muda o salvamento.
export const COR_PADRAO_TINT = '#7A4E29';

// Versões abreviadas das descrições para exibição compacta na grade de imagens.
// As descrições completas (BRISTOL_DESCRICOES em diary.js) permanecem intactas
// para metadados, AI e exibição na linha do tempo.
export const BRISTOL_CURTOS = {
  1: 'Bolinhas duras',
  2: 'Superfície grumosa',
  3: 'Com rachaduras',
  4: 'Lisa e macia',
  5: 'Pedaços macios',
  6: 'Bordas irregulares',
  7: 'Totalmente líquido',
};

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
  if (!m) return [122, 78, 41];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

// Cache de dataURLs tintadas: key = `${imgSrc}\u0001${hex}`.
// Evita recalcular a tintagem (canvas/getImageData/putImageData) nas re-renderizações.
const cache = new Map();

// Converte uma imagem PNG (opaca, fundo branco) numa dataURL com a forma
// tingida na cor `hex`. Preserva o fundo branco e o sombreado da imagem
// original aplicando a nova cor modulada pela luminância do pixel.
//
// Ténica: pixel a pixel no canvas. Pixels muito claros (lum > 230) são
// tratados como fundo e mantidos; demais recebem a nova cor RGB modulada
// por um fator derivado da luminância original — assim sombras escuras
// continuam escuras na nova cor e áreas claras continuam claras.
//
// Retorna Promise<string> (dataURL PNG). Rejeita somente se o canvas não
// estiver disponível (SSR/render server sem DOM).
export function tintImageDataURL(imgSrc, hex) {
  const key = `${imgSrc}\u0001${hex || COR_PADRAO_TINT}`;
  const cached = cache.get(key);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) { resolve(imgSrc); return; }
          ctx.drawImage(img, 0, 0);
          const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const px = data.data;
          const [tR, tG, tB] = hexToRgb(hex || COR_PADRAO_TINT);
          for (let i = 0; i < px.length; i += 4) {
            const r = px[i], g = px[i + 1], b = px[i + 2];
            const lum = (r + g + b) / 3;
            if (lum > 230) continue;
            // fator de sombreado: preserva luminância relativa (0.65–1.0).
            const fator = 0.65 + (lum / 255) * 0.35;
            px[i]     = Math.min(255, Math.round(tR * fator));
            px[i + 1] = Math.min(255, Math.round(tG * fator));
            px[i + 2] = Math.min(255, Math.round(tB * fator));
          }
          ctx.putImageData(data, 0, 0);
          const url = canvas.toDataURL('image/png');
          cache.set(key, url);
          resolve(url);
        } catch (e) {
          resolve(imgSrc);
        }
      };
      img.onerror = () => resolve(imgSrc);
      img.src = imgSrc;
    } catch (e) {
      reject(e);
    }
  });
}
