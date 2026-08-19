import { describe, it, expect, vi } from 'vitest';

// Regressão: o builder do supabase-js (PostgrestBuilder) é um thenable que só
// expõe .then (sem .catch). O syncPullAll NÃO pode encadear .catch() no builder,
// senão lança "TypeError: ...upsert(...).catch is not a function" e o loadUserData
// falha sempre (Diário fictício + onboarding que nunca resolve). Este teste usa
// um mock com o MESMO comportamento do lib real.
const mockUser = { id: 'user-sync', email: 'sync@example.com' };

const makeBuilder = () => {
  const b = {
    then: (onOk) => Promise.resolve({ data: [], error: null }).then(onOk),
    select: () => b,
    eq: () => b,
    order: () => b,
    maybeSingle: () => b,
    single: () => b,
    limit: () => b,
    upsert: () => b,
    insert: () => b,
    update: () => b,
    delete: () => b,
  };
  return b;
};

vi.mock('../lib/supabaseClient.js', () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: mockUser } })),
    },
    from: vi.fn(() => makeBuilder()),
  },
}));

import { syncPullAll } from '../lib/sync.js';

describe('syncPullAll (regressão .catch no builder)', () => {
  it('resolve sem lançar quando upsert é um thenable sem .catch', async () => {
    const result = await syncPullAll();
    expect(result).not.toBeNull();
    expect(Array.isArray(result.entries)).toBe(true);
  });
});