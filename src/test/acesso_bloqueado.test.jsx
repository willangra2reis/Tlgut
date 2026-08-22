import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App.jsx';

// Regressão: usuário logado sem compra aprovada (status de bloqueio) vê a tela de
// bloqueio em TODAS as abas (Diário, Análises, Aulas, Perfil), o botão "+" abre o
// modal "Adicionar evento", e NENHUM dado real é montado (segurança: atrás do blur
// só há placeholder fictício).
const mockState = vi.hoisted(() => ({
  user: { id: 'user-bloqueado2', email: 'bloqueado2@example.com', user_metadata: {} },
  config: { reativar_acesso_url: '' },
}));

vi.mock('../lib/supabaseClient.js', () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: { user: mockState.user } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      getUser: () => Promise.resolve({ data: { user: mockState.user } }),
    },
  },
  currentUserId: async () => mockState.user.id,
}));

vi.mock('../lib/config.js', () => ({
  carregarConfigApp: vi.fn(async () => mockState.config),
  flagAtivo: () => false,
}));

vi.mock('../lib/sync.js', () => ({
  syncEntryInsert: async () => {},
  syncEntryUpdate: async () => {},
  syncEntryDelete: async () => {},
  syncProfileUpsert: async () => {},
  syncPrefsMerge: async () => {},
  syncConsultasReplace: async () => {},
  syncReportsReplace: async () => {},
  syncDeleteAccount: async () => {},
  readPrefsSnapshot: () => ({ cursiva: false, ink_level: 55, font_scale: 100 }),
  tsParaDia: () => 0,
  syncPullAll: async () => ({
    entries: [{ id: 1, type: 'refeicao', title: 'Registro REAL que NÃO pode aparecer' }],
    profile: { nome: 'Marcos', idade: 40 },
    prefs: {},
    consultas: [],
    reportsIA: [],
    reportsExpress: [],
  }),
}));

vi.mock('../lib/compras.js', () => ({
  listarCompras: async () => [{ produto: 'tinobem', status: 'PURCHASE_CANCELED' }],
  temAcesso: () => false,
  statusDoProduto: () => 'PURCHASE_CANCELED',
  STATUS_APROVADO: 'PURCHASE_APPROVED',
  STATUS_BLOQUEIO: ['PURCHASE_CANCELED', 'PURCHASE_REFUNDED', 'PURCHASE_PROTEST', 'PURCHASE_BILLET_PRINTED', 'PURCHASE_CHARGEBACK', 'SUBSCRIPTION_CANCELLATION'],
}));

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(`tlgut_onboarded_${mockState.user.id}`, '1');
  mockState.config = { reativar_acesso_url: '' };
});

describe('Bloqueio de compra inativa em todas as abas', () => {
  it('mostra o lock no Diário, com mensagem personalizada e sem dados reais no DOM', async () => {
    render(<App />);
    expect(await screen.findByText('Marcos, seu diário continua aqui.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reativar meu acesso' })).toBeInTheDocument();
    // Segurança: dados reais (entry) NUNCA são montados quando bloqueado.
    expect(screen.queryByText('Registro REAL que NÃO pode aparecer')).not.toBeInTheDocument();
    expect(screen.queryByText('Nenhum registro hoje ainda.')).not.toBeInTheDocument();
  });

  it('bloqueia Análises, Aulas e Perfil com mensagens próprias (Perfil com "Sair da conta")', async () => {
    render(<App />);
    expect(await screen.findByText('Marcos, seu diário continua aqui.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Análises' }));
    expect(await screen.findByText('Marcos, sua história já tem muitos registros.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Aulas' }));
    expect(await screen.findByText('Marcos, sentimos sua falta por aqui.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Perfil' }));
    expect(await screen.findByText('Marcos, sua conta está com o acesso inativo no momento.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sair da conta/ })).toBeInTheDocument();
  });

  it('botão "+" abre o modal "Adicionar evento" quando bloqueado', async () => {
    render(<App />);
    expect(await screen.findByText('Marcos, seu diário continua aqui.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar registro' }));
    expect(await screen.findByText('Vamos continuar seu diário, Marcos?')).toBeInTheDocument();
  });

  it('"Reativar meu acesso" vira link quando reativar_acesso_url está preenchido no Supabase', async () => {
    mockState.config = { reativar_acesso_url: 'https://checkout.exemplo.com/tinobem' };
    render(<App />);
    expect(await screen.findByText('Marcos, seu diário continua aqui.')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Reativar meu acesso' });
    expect(link).toHaveAttribute('href', 'https://checkout.exemplo.com/tinobem');
    expect(screen.queryByRole('button', { name: 'Reativar meu acesso' })).not.toBeInTheDocument();
  });
});
