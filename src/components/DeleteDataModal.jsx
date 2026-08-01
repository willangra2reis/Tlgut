// ─── Modal de exclusão de dados (2 passos) ───────────────────────────────────
// Passo 1: aviso + oferta de download. Passo 2: trava de segurança — só habilita
// o botão vermelho quando o usuário digita exatamente "DELETAR".

import { useEffect, useState } from 'react';
import { Trash2, Download, X, AlertTriangle } from 'lucide-react';
import { confirmarPalavra, PALAVRA_CONFIRMACAO } from '../lib/exportData.js';

export default function DeleteDataModal({ open, onClose, onBaixarDados, onConfirmar, excluindo }) {
  const [etapa, setEtapa] = useState('aviso');
  const [valor, setValor] = useState('');
  const [erro, setErro] = useState(null);

  useEffect(() => {
    if (open) {
      setEtapa('aviso');
      setValor('');
      setErro(null);
    }
  }, [open]);

  if (!open) return null;

  const valido = confirmarPalavra(valor);

  function fechar() {
    if (excluindo) return;
    setEtapa('aviso');
    setValor('');
    setErro(null);
    onClose();
  }

  async function confirmar() {
    if (!valido) { setErro(`Digite ${PALAVRA_CONFIRMACAO} para confirmar.`); return; }
    setErro(null);
    try {
      await onConfirmar();
    } catch (err) {
      setErro('Não foi possível excluir seus dados. Tente novamente em instantes.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40" onClick={fechar} />

      <div className="relative w-full max-w-[420px] rounded-t-3xl sm:rounded-3xl bg-white p-5 pb-8 shadow-2xl">
        <button type="button" onClick={fechar} disabled={excluindo}
          className="absolute right-4 top-4 text-[#B6AE9F]" aria-label="Fechar">
          <X size={20} />
        </button>

        {etapa === 'aviso' ? (
          <>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(189,90,74,0.12)' }}>
                <AlertTriangle size={22} style={{ color: '#BD5A4A' }} />
              </span>
              <h3 className="text-base font-bold text-[#2B2A28]">Excluir seus dados</h3>
            </div>

            <p className="text-sm leading-relaxed text-[#4A443F]">
              Todos os seus <strong>registros</strong>, <strong>relatórios</strong>, <strong>consultas</strong>, <strong>perfil</strong> e
              a própria <strong>conta</strong> serão excluídos <strong>permanentemente</strong>.
            </p>
            <p className="text-xs text-[#7D766A] mt-2 leading-relaxed">
              Essa ação não pode ser desfeita. Se quiser um backup, baixe seus dados antes.
            </p>

            <button type="button" onClick={() => { onBaixarDados(); setEtapa('confirmar'); }}
              className="mt-5 w-full flex items-center justify-center gap-2 rounded-2xl border border-[#D9D2C4] bg-white p-3 text-sm font-medium text-[#2B2A28]">
              <Download size={16} style={{ color: 'var(--brand)' }} />
              Baixar meus dados
            </button>

            <button type="button" onClick={() => setEtapa('confirmar')}
              className="mt-3 w-full flex items-center justify-center gap-2 rounded-2xl p-3 text-sm font-medium text-white" style={{ background: '#BD5A4A' }}>
              <Trash2 size={16} />
              Continuar
            </button>

            <button type="button" onClick={fechar}
              className="mt-3 w-full p-2 text-sm text-[#7D766A]">
              Cancelar
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(189,90,74,0.12)' }}>
                <Trash2 size={22} style={{ color: '#BD5A4A' }} />
              </span>
              <h3 className="text-base font-bold text-[#2B2A28]">Confirmação final</h3>
            </div>

            <p className="text-sm leading-relaxed text-[#4A443F]">
              Para garantir que não foi um clique acidental, digite a palavra
              <strong> {PALAVRA_CONFIRMACAO}</strong> abaixo para confirmar.
            </p>

            <input
              type="text"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder={`Digite ${PALAVRA_CONFIRMACAO}`}
              autoCapitalize="characters"
              autoComplete="off"
              className="mt-4 w-full px-4 py-3 rounded-2xl border border-[#D9D2C4] bg-white text-sm text-[#2B2A28] placeholder-[#B6AE9F] outline-none focus:border-[#BD5A4A] focus:ring-2 focus:ring-[#BD5A4A]/20"
            />

            {erro && (
              <p className="mt-3 rounded-xl bg-[#F5E1DD] border border-[#E0B4A8] px-3 py-2 text-xs text-[#8A3B2E]">{erro}</p>
            )}

            <button type="button" onClick={confirmar} disabled={!valido || excluindo}
              className="mt-5 w-full flex items-center justify-center gap-2 rounded-2xl p-3 text-sm font-semibold text-white disabled:opacity-40 transition-opacity" style={{ background: '#BD5A4A' }}>
              <Trash2 size={16} />
              {excluindo ? 'Excluindo…' : 'Excluir definitivamente'}
            </button>

            <button type="button" onClick={fechar} disabled={excluindo}
              className="mt-3 w-full p-2 text-sm text-[#7D766A]">
              Voltar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
