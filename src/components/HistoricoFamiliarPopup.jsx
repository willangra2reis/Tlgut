import { X } from 'lucide-react';

const MESH = 'day-summary-mesh relative z-10 rounded-2xl border border-[#EDE7DD] overflow-hidden shadow-[0_16px_32px_-12px_rgba(0,0,0,0.5)]';

export default function HistoricoFamiliarPopup({ titulo, mensagem, onAbrir, onAgoraNao, onDispensar, permiteDispensar }) {
  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center p-4 backdrop-blur-sm" style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div className="w-full max-w-[360px]">
        <div className={MESH}>
          <div className="relative z-10 p-5 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-[#2B2A28]">{titulo}</h3>
                <p className="text-sm text-[#4A443F] mt-1 leading-relaxed">{mensagem}</p>
              </div>
              <button type="button" onClick={onAgoraNao}
                className="shrink-0 rounded-full p-1 text-[#B6AE9F] hover:text-[#7D766A] transition-colors"
                aria-label="Fechar">
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <button type="button" onClick={onAbrir}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ background: 'var(--brand)', color: '#fff' }}>
                Preencher agora
              </button>
              <button type="button" onClick={onAgoraNao}
                className="w-full py-2.5 rounded-xl text-sm font-medium transition-colors"
                style={{ background: 'rgba(255,255,255,0.6)', color: '#7D766A', border: '1px solid rgba(150,140,120,0.25)' }}>
                Agora não
              </button>
              {permiteDispensar && (
                <button type="button" onClick={onDispensar}
                  className="w-full text-center text-xs text-[#B6AE9F] underline hover:text-[#7D766A] transition-colors">
                  Não mostrar de novo
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
