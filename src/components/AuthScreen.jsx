// ─── Tela de autenticação (Email + senha) ────────────────────────────────────
// Mostrada apenas quando o Supabase está configurado E não há sessão ativa.
// Mantém o "modo apresentação": o usuário pode entrar como convidado e usar o
// app com dados mock/local sem conta.

import { useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

const INVALID_PASSWORD = /^.{0,5}$/;
const INVALID_EMAIL = /@/;

export default function AuthScreen({ onGuest }) {
  const [modo, setModo] = useState('entrar'); // 'entrar' | 'cadastrar'
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro(null);
    setAviso(null);

    const em = email.trim().toLowerCase();
    if (!INVALID_EMAIL.test(em)) { setErro('Informe um e-mail válido.'); return; }
    if (INVALID_PASSWORD.test(senha)) { setErro('A senha precisa ter pelo menos 6 caracteres.'); return; }

    setLoading(true);
    try {
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email: em, password: senha });
        if (error) throw error;
        // A sessão chega via onAuthStateChange no App root.
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: em,
          password: senha,
          options: { data: { nome: nome.trim() || null } },
        });
        if (error) throw error;
        if (data?.user && !data.session) {
          setAviso('Conta criada! Verifique seu e-mail para confirmar o cadastro antes de entrar.');
          setModo('entrar');
        }
      }
    } catch (err) {
      const msg = String(err?.message || err || '');
      if (msg.includes('Invalid login credentials')) setErro('E-mail ou senha incorretos.');
      else if (msg.includes('already registered') || msg.includes('already been registered')) setErro('Este e-mail já está cadastrado. Faça login.');
      else if (msg.includes('rate limit')) setErro('Muitas tentativas. Aguarde alguns instantes e tente de novo.');
      else setErro(msg);
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
          <h1 className="titulo-cursivo font-sans text-3xl font-bold">Diário Intestinal</h1>
          <p className="mt-2 text-sm text-white/85">
            Registre seu dia, entenda padrões e chegue preparado à consulta.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4 flex rounded-2xl bg-[#EDE7DD] p-1">
            <button type="button"
              onClick={() => { setModo('entrar'); setErro(null); setAviso(null); }}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${modo === 'entrar' ? 'bg-white shadow-sm text-[#2F6B43]' : 'text-[#7D766A]'}`}>
              Entrar
            </button>
            <button type="button"
              onClick={() => { setModo('cadastrar'); setErro(null); setAviso(null); }}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${modo === 'cadastrar' ? 'bg-white shadow-sm text-[#2F6B43]' : 'text-[#7D766A]'}`}>
              Criar conta
            </button>
          </div>

          {modo === 'cadastrar' && (
            <label className="block mb-3">
              <span className="block text-xs font-semibold uppercase tracking-wide text-[#7D766A] mb-1.5">Seu nome (opcional)</span>
              <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Como devemos chamar você?"
                className={inputClass} autoComplete="name" />
            </label>
          )}

          <label className="block mb-3">
            <span className="block text-xs font-semibold uppercase tracking-wide text-[#7D766A] mb-1.5">E-mail</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com"
              className={inputClass} autoComplete="email" autoCapitalize="none" />
          </label>

          <label className="block mb-4">
            <span className="block text-xs font-semibold uppercase tracking-wide text-[#7D766A] mb-1.5">Senha</span>
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres"
              className={inputClass} autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'} />
          </label>

          {erro && (
            <p className="mb-4 rounded-xl bg-[#F5E1DD] border border-[#E0B4A8] px-3 py-2 text-xs text-[#8A3B2E]">{erro}</p>
          )}
          {aviso && (
            <p className="mb-4 rounded-xl bg-[#E3EDE4] border border-[#BFD6C4] px-3 py-2 text-xs text-[#2F6B43]">{aviso}</p>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-2xl text-white font-medium text-sm disabled:opacity-40" style={{ background: 'var(--brand)' }}>
            {loading ? 'Aguarde…' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <div className="mt-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-[#D9D2C4]" />
          <span className="text-xs text-[#7D766A]">ou</span>
          <div className="h-px flex-1 bg-[#D9D2C4]" />
        </div>

        <button type="button" onClick={onGuest}
          className="mt-6 w-full py-3 rounded-2xl border border-[#D9D2C4] bg-white text-sm font-medium text-[#2B2A28]">
          Continuar como convidado · modo demonstração
        </button>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-[#9A9284]">
          Seus registros ficam seguros e sincronizados na sua conta.
          O modo demonstração usa dados de exemplo — nada é salvo em servidor.
        </p>
      </div>
    </div>
  );
}
