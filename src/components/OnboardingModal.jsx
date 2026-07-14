import { useState, useEffect } from 'react';
import { ChevronLeft, Check, Plus, X } from 'lucide-react';
import mascoteImage from '../assets/mascote.png';

const CONDICOES = [
  { id: 'diabetes',  label: 'Diabetes' },
  { id: 'hipertensao', label: 'Hipertensão' },
  { id: 'tireoide',  label: 'Alterações na Tireoide' },
  { id: 'celiaca',   label: 'Doença Celíaca' },
  { id: 'lactose',   label: 'Intolerância à Lactose' },
  { id: 'gluten',    label: 'Sensibilidade ao Glúten' },
];

const MESH = 'day-summary-mesh relative z-10 rounded-2xl border border-[#EDE7DD] overflow-hidden shadow-[0_16px_32px_-12px_rgba(0,0,0,0.5)]';
const INPUT_CLASS = 'w-full px-4 py-3 rounded-xl text-base outline-none';
const INPUT_STYLE = { background: '#FBF9F4', border: '1px solid rgba(150,140,120,0.25)', color: '#2B2A28' };

export default function OnboardingModal({ initialProfile, onConcluir, onPularTudo }) {
  const [step, setStep] = useState(0);
  const [nome, setNome] = useState('');
  const [condicoes, setCondicoes] = useState([]);
  const [outros, setOutros] = useState('');
  const [tentouAvancar, setTentouAvancar] = useState(false);
  const [idade, setIdade] = useState('');
  const [peso, setPeso] = useState('');
  const [altura, setAltura] = useState('');
  const [aceitouTermos, setAceitouTermos] = useState(false);

  useEffect(() => {
    if (initialProfile) {
      setNome(initialProfile.nome || '');
      setCondicoes(initialProfile.condicoes || []);
      setOutros(initialProfile.outros || '');
      setIdade(initialProfile.idade || '');
      setPeso(initialProfile.peso || '');
      setAltura(initialProfile.altura || '');
    }
  }, [initialProfile]);

  const toggleCond = (id) => {
    if (id === 'nenhuma') {
      setCondicoes((prev) => prev.includes('nenhuma') ? [] : ['nenhuma']);
    } else {
      setCondicoes((prev) => {
        const next = prev.includes(id) ? prev.filter((c) => c !== id) : [...prev.filter((c) => c !== 'nenhuma'), id];
        setTentouAvancar(false);
        return next;
      });
    }
  };

  // TODO Supabase: persistir aceite_lgpd na tabela user_consents (versao, aceito, ts)
  const buildProfile = () => ({
    nome: nome.trim() || '',
    idade: idade ? Number(idade) : null,
    peso: peso ? Number(peso) : null,
    altura: altura ? Number(altura) : null,
    condicoes: condicoes.includes('nenhuma') ? [] : condicoes,
    outros: outros.trim() || '',
    aceite_lgpd: { versao: 1, aceito: true, ts: Date.now() },
  });

  const concluir = () => {
    onConcluir(buildProfile());
  };

  const pularBiometria = () => {
    onConcluir(buildProfile());
  };

  const podeAvancarStep1 = nome.trim().length > 0;
  const podeAvancarStep0 = aceitouTermos;
  const temCondSelecionada = condicoes.length > 0 || outros.trim().length > 0;

  const alturaValor = altura ? Number(altura) : 160;
  const formatarAltura = (cm) => {
    const m = Math.floor(cm / 100);
    const restante = cm - m * 100;
    const cmStr = String(cm);
    const mStr = (cm / 100).toFixed(2).replace('.', ',');
    if (cm < 100) return `${cmStr} cm (${mStr} m)`;
    if (m === 1 && restante === 0) return `1 metro (1,00)`;
    if (m === 1) return `1 metro e ${restante} (${mStr})`;
    if (restante === 0) return `${m} metros (${mStr})`;
    return `${m} metros e ${restante} (${mStr})`;
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center backdrop-blur-sm" style={{ background: 'rgba(0,0,0,0.94)' }}>
      <div className="w-full max-w-[400px] max-h-[92vh] mx-3 overflow-y-auto">
        <div className={MESH}>
          <div className="relative z-10 p-6 space-y-5">
            {/* Mascote + progresso */}
            <div className="flex flex-col items-center pt-2">
              <img src={mascoteImage} alt="" className="w-20 h-20 animate-mascote-pulse" />
              <div className="flex gap-1.5 mt-3">
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className="h-1.5 rounded-full transition-all"
                    style={{ width: i === step ? 24 : 8, background: i <= step ? '#4A8A5C' : 'rgba(150,140,120,0.3)' }} />
                ))}
              </div>
            </div>

            {/* Tela 0 — Aceite de Termos e LGPD */}
            {step === 0 && (
              <div className="space-y-4">
                <div className="text-center">
                  <h2 className="text-xl font-bold text-[#2B2A28]">Termos de Uso e Privacidade</h2>
                </div>
                <div className="text-sm text-[#4A443F] space-y-2 leading-relaxed">
                  <p> Este aplicativo coleta dados de saúde sensíveis (diário intestinal, sintomas, alimentação) para gerar relatórios personalizados.</p>
                  <p>Os dados são processados por inteligência artificial (Google Gemini) em servidores internacionais, e armazenados de forma segura.</p>
                  <p>Ao continuar, você concorda com o tratamento dos seus dados conforme nossa Política de Privacidade.</p>
                </div>
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={aceitouTermos}
                    onChange={(e) => { setAceitouTermos(e.target.checked); setTentouAvancar(false); }}
                    className="mt-1 w-4 h-4 accent-[#4A8A5C]" />
                  <span className="text-sm text-[#2B2A28]">
                    Li e concordo com os{' '}
                    <a href="#" onClick={(e) => e.preventDefault()} className="text-[#4A8A5C] underline">Termos de Uso</a>{' '}
                    e a{' '}
                    <a href="#" onClick={(e) => e.preventDefault()} className="text-[#4A8A5C] underline">Política de Privacidade</a>.
                  </span>
                </label>
                {tentouAvancar && !podeAvancarStep0 && (
                  <p className="text-xs text-[#BD5A4A]">É necessário aceitar os termos para continuar</p>
                )}
                <button type="button" disabled={!podeAvancarStep0}
                  onClick={() => { if (!podeAvancarStep0) setTentouAvancar(true); else { setTentouAvancar(false); setStep(1); } }}
                  className="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-50 transition-opacity"
                  style={{ background: 'var(--brand)', color: '#fff' }}>
                  Continuar
                </button>
              </div>
            )}

            {/* Tela 1 — Nome */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="text-center">
                  <h2 className="text-xl font-bold text-[#2B2A28]">Olá! 👋</h2>
                  <p className="text-sm text-[#5C5650] mt-1">Como podemos te chamar?</p>
                </div>
                <input autoFocus type="text" value={nome} placeholder="Seu nome"
                  onChange={(e) => { setNome(e.target.value); setTentouAvancar(false); }} maxLength={30}
                  onKeyDown={(e) => { if (e.key === 'Enter' && podeAvancarStep1) { setTentouAvancar(false); setStep(2); } }}
                  className={INPUT_CLASS} style={INPUT_STYLE} />
                {tentouAvancar && !podeAvancarStep1 && (
                  <p className="text-xs text-[#BD5A4A] mt-1">Preencha seu nome para continuar</p>
                )}
                <button type="button" disabled={!podeAvancarStep1} onClick={() => { if (!podeAvancarStep1) setTentouAvancar(true); else { setTentouAvancar(false); setStep(2); } }}
                  className="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-50 transition-opacity"
                  style={{ background: 'var(--brand)', color: '#fff' }}>
                  Continuar
                </button>
              </div>
            )}

            {/* Tela 2 — Condições */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="text-center">
                  <h2 className="text-xl font-bold text-[#2B2A28]">Você possui alguma destas condições?</h2>
                  <p className="text-sm text-[#4A443F] mt-1">Selecione todas que se aplicam. Isso ajuda a IA a não confundir sintomas de doenças com efeitos da dieta.</p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {CONDICOES.map((c) => {
                    const sel = condicoes.includes(c.id);
                    return (
                      <button key={c.id} type="button" onClick={() => toggleCond(c.id)}
                        className="px-3 py-2 rounded-full text-sm font-medium transition-all"
                        style={sel
                          ? { background: 'var(--brand)', color: '#fff', border: '1px solid var(--brand)' }
                          : { background: 'rgba(255,255,255,0.6)', color: '#4A443F', border: '1px solid rgba(150,140,120,0.3)' }}>
                        {sel && <Check size={14} className="inline mr-1" />}
                        {c.label}
                      </button>
                    );
                  })}
                  <button type="button" onClick={() => toggleCond('nenhuma')}
                    className="px-3 py-2 rounded-full text-sm font-medium transition-all"
                    style={condicoes.includes('nenhuma')
                      ? { background: 'var(--brand)', color: '#fff', border: '1px solid var(--brand)' }
                      : { background: 'rgba(255,255,255,0.6)', color: '#4A443F', border: '1px solid rgba(150,140,120,0.3)' }}>
                    {condicoes.includes('nenhuma') && <Check size={14} className="inline mr-1" />}
                    Nenhuma
                  </button>
                </div>
                <div>
                  <label className="text-xs text-[#7D766A]">Outras (opcional):</label>
                  <input type="text" value={outros} placeholder="Ex.: Síndrome do intestino irritável"
                    onChange={(e) => setOutros(e.target.value)} maxLength={60}
                    className={`mt-1 ${INPUT_CLASS}`} style={INPUT_STYLE} />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setStep(1)}
                    className="flex items-center justify-center gap-1 px-4 py-3 rounded-xl text-sm font-medium transition-colors"
                    style={{ background: 'rgba(255,255,255,0.5)', color: '#7D766A', border: '1px solid rgba(150,140,120,0.25)' }}>
                    <ChevronLeft size={16} />
                  </button>
                  {tentouAvancar && !temCondSelecionada && (
                    <p className="text-xs text-[#BD5A4A] text-center mt-1">Selecione ao menos uma condição, marque "Nenhuma" ou digite em "Outras"</p>
                  )}
                  <button type="button" disabled={!temCondSelecionada}
                    onClick={() => { if (!temCondSelecionada) setTentouAvancar(true); else { setTentouAvancar(false); setStep(3); } }}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
                    style={{ background: 'var(--brand)', color: '#fff' }}>
                    Continuar
                  </button>
                </div>
              </div>
            )}

            {/* Tela 3 — Biometria */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="text-center">
                  <h2 className="text-xl font-bold text-[#2B2A28]">Dados básicos</h2>
                  <p className="text-sm text-[#4A443F] mt-1">Usados para personalizar a análise de hidratação e metabolismo.</p>
                </div>
                <div>
                  <label className="text-sm text-[#5C5650] font-medium">Idade</label>
                  <p className="text-lg font-bold text-[#2B2A28] mt-1 mb-0.5">{idade ? `${idade} anos` : '—'}</p>
                  <input type="range" min={5} max={100} step={1}
                    value={idade || 30}
                    onChange={(e) => setIdade(e.target.value)}
                    className="w-full accent-[#4A8A5C]" style={{ accentColor: 'var(--brand)' }} />
                </div>
                <div>
                  <label className="text-sm text-[#5C5650] font-medium">Peso (kg)</label>
                  <p className="text-lg font-bold text-[#2B2A28] mt-1 mb-0.5">{peso ? `${peso} kg` : '—'}</p>
                  <input type="range" min={25} max={300} step={1}
                    value={peso || 65}
                    onChange={(e) => setPeso(e.target.value)}
                    className="w-full accent-[#4A8A5C]" style={{ accentColor: 'var(--brand)' }} />
                </div>
                <div>
                  <label className="text-sm text-[#5C5650] font-medium">Altura</label>
                  <p className="text-lg font-bold text-[#2B2A28] mt-1 mb-0.5">{formatarAltura(alturaValor)}</p>
                  <input type="range" min={100} max={220} step={1}
                    value={alturaValor}
                    onChange={(e) => setAltura(e.target.value)}
                    className="w-full accent-[#4A8A5C]" style={{ accentColor: 'var(--brand)' }} />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setStep(2)}
                    className="flex items-center justify-center gap-1 px-4 py-3 rounded-xl text-sm font-medium transition-colors"
                    style={{ background: 'rgba(255,255,255,0.5)', color: '#7D766A', border: '1px solid rgba(150,140,120,0.25)' }}>
                    <ChevronLeft size={16} />
                  </button>
                  <button type="button" onClick={concluir}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold"
                    style={{ background: 'var(--brand)', color: '#fff' }}>
                    {nome.trim() ? `Concluir, ${nome.trim()}!` : 'Concluir'}
                  </button>
                </div>
                <button type="button" onClick={pularBiometria}
                  className="w-full text-center text-xs text-[#7D766A] underline pt-1">
                  Pular / Preencher no meu perfil depois
                </button>
              </div>
            )}
          </div>
        </div>

        {onPularTudo && (
          <div className="text-center mt-3">
            <button type="button" onClick={onPularTudo}
              className="text-xs text-white/70 underline hover:text-white">
              Pular tudo por agora
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
