// ─── Tela "Defina sua senha" (primeiro acesso via convite) ──────────────────
// Exibida quando o usuário chega ao app pelo link de convite (comprou na
// Hotmart e foi convidado pelo worker, sem senha). Define a senha pela primeira
// vez e limpa o flag "convidado" do user_metadata para não re-exibir.

import { useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

const INVALID_PASSWORD = /^.{0,5}$/;

export default function PrimeiroAcessoScreen({ nome, onConcluido }) {
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro(null);
    setAviso(null);

    if (INVALID_PASSWORD.test(senha)) { setErro('A senha precisa ter pelo menos 6 caracteres.'); return; }
    if (senha !== confirmar) { setErro('As senhas não coincidem.'); return; }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: senha,
        data: { convidado: false },
      });
      if (error) throw error;
      setAviso('Senha criada com sucesso!');
      setTimeout(onConcluido, 1200);
    } catch (err) {
      const msg = String(err?.message || err || '');
      if (msg.includes('rate limit')) setErro('Muitas tentativas. Aguarde alguns instantes.');
      else setErro('Não foi possível definir a senha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    'w-full px-4 py-3 rounded-2xl border border-[#D9D2C4] bg-white text-sm text-[#2B2A28] placeholder-[#B6AE9F] outline-none focus:border-[#2F6B43] focus:ring-2 focus:ring-[#2F6B43]/20';

  return (
    <div className="relative w-full max-w-[420px] h-[100dvh] sm:h-[844px] sm:rounded-[2.5rem] sm:shadow-2xl overflow-hidden flex flex-col bg-[#F3F1E9]">
      {/* Cabeçalho com mesh da marca */}
      <div className="relative overflow-hidden px-6 pt-10 pb-8 text-white" style={{ background: 'var(--brand-deep)' }}>
        <div className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(at 20% 10%, rgba(120,196,140,0.35), transparent 60%), radial-gradient(at 90% 90%, rgba(201,118,58,0.25), transparent 55%)' }} />
        <div className="relative">
          <h1 className="titulo-cursivo font-sans text-3xl font-bold">Seja bem-vindo</h1>
          <p className="mt-2 text-sm text-white/85">
            {nome ? `Olá, ${nome}! ` : ''}Sua conta foi criada. Defina uma senha para começar.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <form onSubmit={handleSubmit} noValidate>
          <label className="block mb-3">
            <span className="block text-xs font-semibold uppercase tracking-wide text-[#7D766A] mb-1.5">Senha</span>
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres"
              className={inputClass} autoComplete="new-password" />
          </label>

          <label className="block mb-4">
            <span className="block text-xs font-semibold uppercase tracking-wide text-[#7D766A] mb-1.5">Confirmar senha</span>
            <input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} placeholder="Repita a senha"
              className={inputClass} autoComplete="new-password" />
          </label>

          {erro && (
            <p className="mb-4 rounded-xl bg-[#F5E1DD] border border-[#E0B4A8] px-3 py-2 text-xs text-[#8A3B2E]">{erro}</p>
          )}
          {aviso && (
            <p className="mb-4 rounded-xl bg-[#E3EDE4] border border-[#BFD6C4] px-3 py-2 text-xs text-[#2F6B43]">{aviso}</p>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-2xl text-white font-medium text-sm disabled:opacity-40" style={{ background: 'var(--brand)' }}>
            {loading ? 'Aguarde…' : aviso ? 'Criando…' : 'Criar senha'}
          </button>
        </form>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-[#9A9284]">
          Depois de criar sua senha, você poderá entrar com e-mail e senha normalmente.
        </p>
      </div>
    </div>
  );
}