// ─── Tela/Modal de "Compra não ativa" ─────────────────────────────────────────
// Mostrado quando o usuário logado não tem compra aprovada (temAcesso false).
// Principio de segurança: quando bloqueado, o app NÃO monta dados reais — o
// fundo "embaçado" é 100% placeholder fictício (hardcoded), então não existe
// dado real para desembaçar/extrair. O CTA "Reativar meu acesso" lê o link de
// public.app_config['reativar_acesso_url'] (editável no dashboard, sem código).

import { Lock, LogOut, Play } from 'lucide-react';

// ── Fundos fictícios (placeholder) por aba — aria-hidden e não interativos ────

function Skeleton({ w }) {
  return <div className={`${w} h-2.5 rounded bg-[#DDD6C8]`} />;
}

function FakeLinhaDiario() {
  return (
    <div className="flex gap-3 items-start opacity-70">
      <span className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-[10px] font-semibold text-[#B9B2A6] border border-[#EDE7DD]">08:2X</span>
      <div className="flex-1 bg-white rounded-2xl p-3 border border-[#EDE7DD] space-y-2">
        <Skeleton w="w-1/2" />
        <Skeleton w="w-3/4" />
        <Skeleton w="w-1/3" />
      </div>
    </div>
  );
}

function FundoDiario() {
  return (
    <div className="flex flex-col gap-3 px-5">
      <div className="h-10 w-2/3 rounded-full bg-white/70" />
      <div className="h-24 rounded-3xl bg-white/70" />
      <FakeLinhaDiario />
      <FakeLinhaDiario />
      <FakeLinhaDiario />
    </div>
  );
}

function FundoAnalises() {
  return (
    <div className="flex flex-col gap-3 px-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="h-20 rounded-3xl bg-white/80" />
        <div className="h-20 rounded-3xl bg-white/80" />
      </div>
      <div className="h-32 rounded-3xl bg-white/80 p-4 flex items-end gap-2">
        {[40, 65, 30, 80, 55, 70, 45].map((h, i) => (
          <div key={i} className="flex-1 rounded-t-md bg-[#CFD9CD]" style={{ height: `${h}%` }} />
        ))}
      </div>
      <div className="h-24 rounded-3xl bg-white/80" />
    </div>
  );
}

function FundoAulas() {
  return (
    <div className="flex flex-col gap-3 px-5">
      <div className="h-40 rounded-3xl relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #2C4A38 0%, #1F3D2B 70%)' }}>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
            <Play size={22} className="text-white/80" />
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="h-28 rounded-2xl" style={{ background: 'linear-gradient(160deg, #2C4A38 0%, #1F3D2B 70%)' }} />
        <div className="h-28 rounded-2xl" style={{ background: 'linear-gradient(160deg, #2C4A38 0%, #1F3D2B 70%)' }} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="h-28 rounded-2xl" style={{ background: 'linear-gradient(160deg, #2C4A38 0%, #1F3D2B 70%)' }} />
        <div className="h-28 rounded-2xl" style={{ background: 'linear-gradient(160deg, #2C4A38 0%, #1F3D2B 70%)' }} />
      </div>
    </div>
  );
}

function FundoPerfil() {
  return (
    <div className="flex flex-col items-center gap-3 px-5">
      <div className="w-24 h-24 rounded-full bg-white/80 flex items-center justify-center">
        <div className="w-14 h-14 rounded-full bg-[#CFD9CD]" />
      </div>
      <Skeleton w="w-1/2" />
      <div className="w-full space-y-2 mt-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-2xl bg-white/80" />
        ))}
      </div>
    </div>
  );
}

const FUNDOS = {
  diario: FundoDiario,
  insights: FundoAnalises,
  aulas: FundoAulas,
  perfil: FundoPerfil,
};

// ── Conteúdo compartilhado (página e bottom-sheet) ────────────────────────────

function ConteudoBloqueio({ nome, mensagem, hrefReativar, onReativar, onLogout }) {
  const titulo = (mensagem[0] || '').replace(/\{nome\}/g, nome || 'Olá');
  const paragrafos = mensagem.slice(1);
  const temLink = Boolean(hrefReativar && hrefReativar.trim());

  return (
    <div className="flex flex-col items-center text-center px-6 py-8">
      <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
        style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>
        <Lock size={28} />
      </div>

      <p className="titulo-cursivo font-sans text-2xl leading-snug" style={{ color: '#2B2A28' }}>
        {titulo}
      </p>

      <div className="mt-3 space-y-2">
        {paragrafos.map((p, i) => (
          <p key={i} className="text-sm leading-relaxed" style={{ color: '#5C5650' }}>
            {p}
          </p>
        ))}
      </div>

      {temLink ? (
        <a
          href={hrefReativar.trim()}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full mt-6 py-3 rounded-2xl text-base font-semibold text-center transition-opacity active:opacity-80"
          style={{ background: 'var(--brand)', color: '#FFFFFF' }}
        >
          Reativar meu acesso
        </a>
      ) : (
        <button
          type="button"
          onClick={onReativar}
          className="w-full mt-6 py-3 rounded-2xl text-base font-semibold transition-opacity active:opacity-80"
          style={{ background: 'var(--brand)', color: '#FFFFFF' }}
        >
          Reativar meu acesso
        </button>
      )}

      {onLogout && (
        <button
          type="button"
          onClick={onLogout}
          className="mt-5 flex items-center gap-1.5 text-xs font-medium"
          style={{ color: '#9A938A' }}
        >
          <LogOut size={14} /> Sair da conta
        </button>
      )}
    </div>
  );
}

/**
 * modo 'pagina'  → ocupa a aba inteira (fundo fictício embaçado + painel fosco).
 * modo 'modal'   → bottom-sheet sobre a aba (botão "+" bloqueado).
 */
export default function AcessoBloqueadoScreen({
  modo = 'pagina',
  aba,
  icone: Icone,
  tituloAba,
  nome,
  mensagem,
  hrefReativar,
  onReativar,
  onLogout,
  onFechar,
}) {
  const Fundo = FUNDOS[aba] || FundoDiario;

  if (modo === 'modal') {
    return (
      <div className="absolute inset-0 z-40">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onFechar} />
        <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl pb-[max(env(safe-area-inset-bottom),1rem)] shadow-[0_-12px_32px_-12px_rgba(0,0,0,0.35)]">
          <div className="w-10 h-1.5 bg-[#EDE7DD] rounded-full mx-auto mt-3" />
          <div className="px-5 pt-3 pb-2 flex items-center justify-center gap-2">
            {Icone && <Icone size={16} style={{ color: 'var(--brand)' }} />}
            <p className="titulo-cursivo font-sans text-lg" style={{ color: '#2B2A28' }}>
              {tituloAba}
            </p>
          </div>
          <ConteudoBloqueio
            nome={nome}
            mensagem={mensagem}
            hrefReativar={hrefReativar}
            onReativar={onReativar}
            onLogout={onLogout}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
      {/* Fundo fictício embaçado — NUNCA dados reais */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none select-none"
        style={{ filter: 'blur(14px) saturate(0.7)', opacity: 0.5, transform: 'scale(1.08)' }}>
        <Fundo />
      </div>

      {/* Painel fosco por cima do fundo */}
      <div className="absolute inset-0" style={{ background: 'rgba(243,241,233,0.62)', backdropFilter: 'blur(3px)' }} />

      {/* Cabeçalho da aba */}
      <header className="relative z-10 flex items-center gap-2 px-5 py-3">
        {Icone && <Icone size={18} style={{ color: 'var(--brand)' }} />}
        <p className="titulo-cursivo font-sans text-2xl leading-none" style={{ color: 'var(--amb-text)' }}>
          {tituloAba}
        </p>
      </header>

      {/* Conteúdo central */}
      <div className="relative z-10 flex-1 flex flex-col justify-center pb-16 px-5">
        <div className="rounded-3xl bg-white shadow-[0_18px_36px_-16px_rgba(0,0,0,0.45)] overflow-hidden">
          <ConteudoBloqueio
            nome={nome}
            mensagem={mensagem}
            hrefReativar={hrefReativar}
            onReativar={onReativar}
            onLogout={onLogout}
          />
        </div>
      </div>
    </div>
  );
}
