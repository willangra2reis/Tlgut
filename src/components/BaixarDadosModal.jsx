// ─── Modal de download dos dados (2 opções) ──────────────────────────────────
// "Completo": inclui nome e dados identificadores (backup/portabilidade).
// "Anônimo": remove nome e substitui ocorrências por "paciente" (recomendado
// para enviar a IAs externas). Não altera dados salvos — apenas o arquivo.
// Transparência LGPD: redução de identificação, não anonimização jurídica plena.

import { useEffect, useState } from 'react';
import { Download, X, User, ShieldCheck, FileJson } from 'lucide-react';

export default function BaixarDadosModal({ open, onClose, onBaixar }) {
  const [modo, setModo] = useState('completo');

  useEffect(() => {
    if (open) setModo('completo');
  }, [open]);

  if (!open) return null;

  function confirmar() {
    onBaixar(modo);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative w-full max-w-[420px] rounded-t-3xl sm:rounded-3xl bg-white p-5 pb-8 shadow-2xl">
        <button type="button" onClick={onClose}
          className="absolute right-4 top-4 text-[#B6AE9F]" aria-label="Fechar">
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-1">
          <span className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(31,42,40,0.08)' }}>
            <Download size={22} style={{ color: 'var(--brand)' }} />
          </span>
          <h3 className="text-base font-bold text-[#2B2A28]">Baixar meus dados</h3>
        </div>
        <p className="text-xs text-[#7D766A] mb-4">Escolha o conteúdo do arquivo JSON. Seus dados originais não são alterados.</p>

        <button type="button" onClick={() => setModo('completo')}
          className={`w-full flex items-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors ${modo === 'completo' ? 'border-[#1F2A28] bg-[#F1ECE3]' : 'border-[#EDE7DD] bg-white'}`}>
          <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(31,42,40,0.08)' }}>
            <User size={17} style={{ color: 'var(--brand)' }} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[#2B2A28]">Completo</span>
            <span className="block text-[11px] text-[#7D766A] mt-0.5">Inclui nome e dados identificadores. Para backup e portabilidade (LGPD art. 18).</span>
          </span>
        </button>

        <button type="button" onClick={() => setModo('anonimo')}
          className={`w-full flex items-start gap-3 rounded-2xl border px-3.5 py-3 text-left mt-2 transition-colors ${modo === 'anonimo' ? 'border-[#4A8A5C] bg-[#EEF4EF]' : 'border-[#EDE7DD] bg-white'}`}>
          <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(74,138,92,0.12)' }}>
            <ShieldCheck size={17} style={{ color: '#4A8A5C' }} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[#2B2A28]">Anônimo</span>
            <span className="block text-[11px] text-[#7D766A] mt-0.5">Sem nome. Preserva sua identidade ao compartilhar ou analisar seus dados fora do app.</span>
            <span className="block text-[10px] text-[#7D766A]/70 mt-1">Reduz identificação; não é anonimização jurídica plena (LGPD art. 12).</span>
          </span>
        </button>

        <button type="button" onClick={confirmar}
          className="mt-5 w-full flex items-center justify-center gap-2 rounded-2xl p-3 text-sm font-semibold text-white transition-opacity" style={{ background: 'var(--brand)' }}>
          <FileJson size={16} />
          Baixar JSON
        </button>

        <button type="button" onClick={onClose}
          className="mt-3 w-full p-2 text-sm text-[#7D766A]">
          Cancelar
        </button>
      </div>
    </div>
  );
}