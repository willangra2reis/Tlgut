import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App.jsx';

// Regressão: usuário autenticado com 0 registros no banco NUNCA deve ver o mock
// (INITIAL_ENTRIES) no Diário — nem após o login, nem após restaurar do demo.
// vi.hoisted: vi.mock é hoisted ao topo do arquivo; o factory só pode ler
// variáveis externas se elas forem criadas via vi.hoisted.
const { mockUser, vazio, syncPullAllMock } = vi.hoisted(() => ({
  mockUser: { id: 'user-diario-vazio', email: 'vazio@example.com', user_metadata: {} },
  vazio: {
    entries: [],
    profile: { nome: 'Teste' },
    prefs: {},
    consultas: [],
    reportsIA: [],
    reportsExpress: [],
  },
  syncPullAllMock: vi.fn(async () => vazio),
}));

vi.mock('../lib/supabaseClient.js', () => {
  const supabase = {
    auth: {
      getSession: () => Promise.resolve({ data: { session: { user: mockUser } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      getUser: () => Promise.resolve({ data: { user: mockUser } }),
    },
  };
  return {
    isSupabaseConfigured: () => true,
    supabase,
    currentUserId: async () => mockUser.id,
  };
});

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
  syncPullAll: syncPullAllMock,
}));

vi.mock('../lib/compras.js', () => ({
  listarCompras: async () => [],
  temAcesso: () => true,
  statusDoProduto: () => null,
  STATUS_APROVADO: 'PURCHASE_APPROVED',
  STATUS_BLOQUEIO: ['PURCHASE_CANCELED', 'PURCHASE_REFUNDED'],
}));

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(`tlgut_onboarded_${mockUser.id}`, '1');
  syncPullAllMock.mockReset();
  syncPullAllMock.mockImplementation(async () => vazio);
});

describe('Diário vazio para usuário autenticado (regressão fictício)', () => {
  it('não mostra o mock (INITIAL_ENTRIES) para usuário logado sem registros', async () => {
    render(<App />);
    // Aguarda o carregamento da conta terminar (splash sai e o Diário vazio aparece)
    expect(await screen.findByText('Nenhum registro hoje ainda.')).toBeInTheDocument();
    // Nenhum conteúdo do mock deve aparecer
    expect(screen.queryByText('Café da manhã')).not.toBeInTheDocument();
    expect(screen.queryByText('07:43')).not.toBeInTheDocument();
    expect(screen.queryByText('Cólica · intensidade 7')).not.toBeInTheDocument();
  });

  it('usuário que já concluiu o onboarding não vê o modal nem quando o pull falha', async () => {
    // Reproduz o cenário reportado: pull que falhava sempre (builder sem .catch).
    // Mesmo assim, a chave tlgut_onboarded_<uid> deve evitar o modal no boot.
    syncPullAllMock.mockRejectedValue(new Error('simula upsert(...).catch is not a function'));
    render(<App />);
    expect(await screen.findByText('Nenhum registro hoje ainda.')).toBeInTheDocument();
    expect(screen.queryByText('Olá! 👋')).not.toBeInTheDocument();
  });

  it('demo mostra dados fictícios e restaurar volta ao diário vazio real', async () => {
    render(<App />);
    expect(await screen.findByText('Nenhum registro hoje ainda.')).toBeInTheDocument();

    // Ativa o modo demonstração pela aba Perfil (botão dentro de "Dados e privacidade")
    fireEvent.click(screen.getByRole('button', { name: 'Perfil' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dados e privacidade' }));
    fireEvent.click(await screen.findByRole('button', { name: /Dados de demonstra/ }));

    // Diário com os dados fictícios do demo
    fireEvent.click(screen.getByRole('button', { name: 'Diário' }));
    expect(screen.getAllByText('Café da manhã').length).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getByRole('button', { name: 'Perfil' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dados e privacidade' }));
    fireEvent.click(await screen.findByRole('button', { name: /Restaurar meus dados/ }));
    // O restore recarrega os dados da conta (splash temporário); espera o app voltar
    fireEvent.click(await screen.findByRole('button', { name: 'Diário' }));
    expect(await screen.findByText('Nenhum registro hoje ainda.')).toBeInTheDocument();
    expect(screen.queryByText('Café da manhã')).not.toBeInTheDocument();
  });
});