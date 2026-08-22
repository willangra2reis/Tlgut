import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App.jsx';

// Modo "Supabase configurado" com usuário logado. O mock de sessão é dinâmico
// (variável mutável) para os testes alternarem entre compra bloqueada e
// primeiro acesso via convite.
const mockState = vi.hoisted(() => ({
  user: { id: 'user-bloqueado', email: 'bloqueado@example.com', user_metadata: {} },
}));

vi.mock('../lib/supabaseClient.js', () => {
  const supabase = {
    auth: {
      getSession: () => Promise.resolve({ data: { session: mockState.user ? { user: mockState.user } : null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      getUser: () => Promise.resolve({ data: { user: mockState.user } }),
    },
  };
  return {
    isSupabaseConfigured: () => true,
    supabase,
    currentUserId: async () => mockState.user?.id ?? null,
  };
});

vi.mock('../lib/compras.js', () => ({
  listarCompras: async () => [{ produto: 'tinobem', status: 'PURCHASE_CANCELED' }],
  temAcesso: () => false,
  statusDoProduto: () => 'PURCHASE_CANCELED',
  STATUS_APROVADO: 'PURCHASE_APPROVED',
  STATUS_BLOQUEIO: ['PURCHASE_CANCELED'],
}));

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('tlgut_onboarded', '1');
  mockState.user = { id: 'user-bloqueado', email: 'bloqueado@example.com', user_metadata: {} };
});

describe('Aba Aulas — compra bloqueada', () => {
  it('mostra a tela de bloqueio (com CTA) em vez do catálogo quando o status é de bloqueio', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Aulas' }));
    expect(screen.getByText(/sentimos sua falta por aqui/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reativar meu acesso' })).toBeInTheDocument();
    expect(screen.queryByText('Leve tudo')).not.toBeInTheDocument();
  });
});

describe('Primeiro acesso via convite', () => {
  it('obriga a criar senha quando o usuário veio pelo link de convite (convidado: true)', async () => {
    mockState.user = { id: 'user-convidado', email: 'convite@example.com', user_metadata: { convidado: true } };
    render(<App />);
    expect(await screen.findByText(/Defina uma senha para começar/)).toBeInTheDocument();
  });
});