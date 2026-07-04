import { useMemo, useState } from 'react';
import digestiveImage from '../assets/sisdiges.jpg';
import { ORGAN_CENTROIDES, ORGAN_LABELS } from '../lib/organs.js';
import { dorPorRegiao, contextoRegiao } from '../lib/insights.js';

// Mapa de calor da dor por região do corpo (RF 9.3).
// `interactive` (default true): na aba Insights o usuário toca para filtrar e
// ver o contexto/região. No relatório IA, `interactive={false}` desativa os
// botões e mostra apenas o mapa + mensagem de leitura.
export default function PainHeatmap({ history, interactive = true }) {
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
            <img src={digestiveImage} alt="Mapa de dor no corpo"
              className="absolute inset-0 w-full h-full object-contain select-none" draggable={false} />
            {ORGAN_CENTROIDES.map((o) => {
              const c = counts[o.id] || 0;
              if (!c) return null;
              const r = 10 + (c / max) * 22;
              if (interactive) {
                return (
                  <button key={o.id} type="button" onClick={() => setSel(o.id)} aria-label={`${o.label}: ${c}`}
                    className="absolute rounded-full" style={{
                      left: `${o.cx}%`, top: `${o.cy}%`, width: r, height: r, transform: 'translate(-50%,-50%)',
                      background: `rgba(189,90,74,${0.3 + (c / max) * 0.5})`,
                      border: sel === o.id ? '2px solid #BD5A4A' : '2px solid rgba(255,255,255,0.7)',
                    }} />
                );
              }
              return (
                <span key={o.id} aria-label={`${o.label}: ${c}`}
                  className="absolute rounded-full" style={{
                    left: `${o.cx}%`, top: `${o.cy}%`, width: r, height: r, transform: 'translate(-50%,-50%)',
                    background: `rgba(189,90,74,${0.3 + (c / max) * 0.5})`,
                    border: '2px solid rgba(255,255,255,0.7)',
                    pointerEvents: 'none',
                  }} />
              );
            })}
          </div>
          {interactive && sel && ctx ? (
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
          ) : interactive ? (
            <p className="text-xs text-center mt-2 text-[#9A938A]">Toque numa região para ver os detalhes</p>
          ) : null}
        </>
      )}
    </div>
  );
}