// ─── Modal "Alterar senha" (conta logada) ────────────────────────────────────
// Exige a senha atual (currentPassword) como confirmação e atualiza via
// updateUser. Fluxo puramente client-side sobre o auth do Supabase.

import { useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { KeyRound, X } from 'lucide-react';

const INVALID_PASSWORD = /^.{0,5}$/;

export default function AlterarSenhaModal({ open, onClose }) {
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);

  if (!open) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setErro(null);
    setAviso(null);

    if (INVALID_PASSWORD.test(nova)) { setErro('A nova senha precisa ter pelo menos 6 caracteres.'); return; }
    if (nova !== confirmar) { setErro('As senhas não coincidem.'); return; }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: nova, currentPassword: atual });
      if (error) throw error;
      setAviso('Senha alterada com sucesso!');
      setAtual(''); setNova(''); setConfirmar('');
      setTimeout(onClose, 1200);
    } catch (err) {
      const msg = String(err?.message || err || '');
      if (msg.includes('rate limit')) setErro('Muitas tentativas. Aguarde alguns instantes.');
      else if (msg.includes('password does not match') || msg.includes('wrong password') || msg.includes('invalid credentials')) setErro('A senha atual está incorreta.');
      else setErro('Não foi possível alterar a senha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    'w-full px-4 py-3 rounded-2xl border border-[#D9D2C4] bg-white text-sm text-[#2B2A28] placeholder-[#B6AE9F] outline-none focus:border-[#2F6B43] focus:ring-2 focus:ring-[#2F6B43]/20';

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-[420px] rounded-t-3xl sm:rounded-3xl bg-white p-5 pb-8 shadow-2xl">
        <button type="button" onClick={onClose}
          className="absolute right-4 top-4 text-[#B6AE9F]" aria-label="Fechar">
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <span className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(31,42,40,0.08)' }}>
            <KeyRound size={22} style={{ color: 'var(--brand)' }} />
          </span>
          <h3 className="text-base font-bold text-[#2B2A28]">Alterar senha</h3>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <label className="block mb-3">
            <span className="block text-xs font-semibold uppercase tracking-wide text-[#7D766A] mb-1.5">Senha atual</span>
            <input type="password" value={atual} onChange={(e) => setAtual(e.target.value)} placeholder="Digite sua senha atual"
              className={inputClass} autoComplete="current-password" />
          </label>

          <label className="block mb-3">
            <span className="block text-xs font-semibold uppercase tracking-wide text-[#7D766A] mb-1.5">Nova senha</span>
            <input type="password" value={nova} onChange={(e) => setNova(e.target.value)} placeholder="Mínimo 6 caracteres"
              className={inputClass} autoComplete="new-password" />
          </label>

          <label className="block mb-4">
            <span className="block text-xs font-semibold uppercase tracking-wide text-[#7D766A] mb-1.5">Confirmar nova senha</span>
            <input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} placeholder="Repita a nova senha"
              className={inputClass} autoComplete="new-password" />
          </label>

          {erro && (
            <p className="mb-4 rounded-xl bg-[#F5E1DD] border border-[#E0B4A8] px-3 py-2 text-xs text-[#8A3B2E]">{erro}</p>
          )}
          {aviso && (
            <p className="mb-4 rounded-xl bg-[#E3EDE4] border border-[#BFD6C4] px-3 py-2 text-xs text-[#2F6B43]">{aviso}</p>
          )}

          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-2xl p-3 text-sm font-semibold text-white disabled:opacity-40" style={{ background: 'var(--brand)' }}>
            <KeyRound size={16} />
            {loading ? 'Aguarde…' : 'Alterar senha'}
          </button>
        </form>

        <button type="button" onClick={onClose}
          className="mt-3 w-full p-2 text-sm text-[#7D766A]">
          Cancelar
        </button>
      </div>
    </div>
  );
}