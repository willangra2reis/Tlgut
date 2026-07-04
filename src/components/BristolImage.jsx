import { useState, useEffect } from 'react';
import { tintImageDataURL, COR_PADRAO_TINT } from '../lib/bristol-tints.js';

// Renderiza uma imagem PNG da Escala de Bristol com tintagem dinâmica aplicada
// via canvas. A tintagem é recalculada quando `tintColor` muda; chamadas
// repetidas aproveitam o cache interno de bristol-tints.js (key = imgSrc + hex).
//
// Props:
// - src: caminho da imagem importada (import bristol1 from '../assets/bristol/bristol-1.png')
// - tintColor: hex da cor a aplicar (ou null para default marrom)
// - selected: bool para borda destacada (opcional, estilizado por parent)
// - alt: texto alternativo para acessibilidade
// - width/height: dimensões renderizadas (default 100% do container)
export default function BristolImage({ src, tintColor, alt = '', className = '', style }) {
  const [url, setUrl] = useState(src);
  const hex = tintColor || COR_PADRAO_TINT;

  useEffect(() => {
    let cancelled = false;
    tintImageDataURL(src, hex).then(u => { if (!cancelled) setUrl(u); });
    return () => { cancelled = true; };
  }, [src, hex]);

  return (
    <img
      src={url}
      alt={alt}
      className={className}
      style={style}
      draggable={false}
    />
  );
}
