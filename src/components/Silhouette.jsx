import { useCallback, useRef } from 'react';
import { nearestRegion, ORGAN_LEGACY_TO_REGION, REGION_LABELS } from '../lib/organs.js';
import digestiveClosedImage from '../assets/sisdiges_fechado.jpg';

// Imagem fixada na silhueta fechada (sem órgãos) — conformidade bem-estar.
// A versão com órgãos (sisdiges.jpg) foi removida para afastar viés diagnóstico.
const DIGESTIVE_IMAGE = digestiveClosedImage;

function PainCloud({ x, y, intensity, id }) {
  const alpha = 0.25 + (intensity / 10) * 0.45;
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
      <ellipse
        cx={`${x}%`} cy={`${y}%`}
        rx={`${r * 1.5}%`} ry={`${r * 1.1}%`}
        fill={`rgba(189,50,40,${alpha * 0.35})`}
        filter={`url(#${filterId})`}
      />
      <ellipse
        cx={`${x}%`} cy={`${y}%`}
        rx={`${r}%`} ry={`${r * 0.75}%`}
        fill={`rgba(210,40,30,${alpha})`}
        filter={`url(#${filterId})`}
      />
    </g>
  );
}

export default function Silhouette({ clouds, intensity, onTap, compact, showOrgans: _showOrgans = false }) {
  const imgRef = useRef(null);
  // Sempre usa a silhueta fechada — `showOrgans` ignorado (conformidade bem-estar).
  const currentImage = DIGESTIVE_IMAGE;

  const handleClick = useCallback((e) => {
    if (!onTap) return;
    const rect = imgRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width)  * 100;
    const py = ((e.clientY - rect.top)  / rect.height) * 100;
    const region = nearestRegion(px, py);
    onTap({ x: px, y: py, region, organ: region ? region.id : null });
  }, [onTap]);

  return (
    <div
      className={compact ? 'relative w-14 shrink-0' : 'relative w-full max-w-[220px] mx-auto'}
      style={{ aspectRatio: '374/740' }}
    >
      <img
        ref={imgRef}
        src={currentImage}
        alt="Silhueta corporal"
        className="absolute inset-0 w-full h-full object-contain select-none"
        style={{ pointerEvents: onTap ? 'none' : 'none' }}
        draggable={false}
      />

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
