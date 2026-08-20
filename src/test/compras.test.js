import { describe, it, expect } from 'vitest';
import { statusDoProduto, temAcesso, STATUS_APROVADO, STATUS_BLOQUEIO } from '../lib/compras.js';

describe('compras — status e acesso', () => {
  it('statusDoProduto retorna o status do produto pedido', () => {
    const compras = [
      { produto: 'tinobem', status: 'PURCHASE_APPROVED' },
    ];
    expect(statusDoProduto(compras, 'tinobem')).toBe(STATUS_APROVADO);
  });

  it('statusDoProduto retorna null quando nunca comprou', () => {
    expect(statusDoProduto([], 'tinobem')).toBeNull();
    expect(statusDoProduto([{ produto: 'outro', status: 'X' }], 'tinobem')).toBeNull();
  });

  it('temAcesso true somente com PURCHASE_APPROVED', () => {
    expect(temAcesso([{ produto: 'tinobem', status: 'PURCHASE_APPROVED' }], 'tinobem')).toBe(true);
  });

  it('temAcesso false para qualquer status de bloqueio', () => {
    expect(STATUS_BLOQUEIO).toContain('PURCHASE_CHARGEBACK');
    for (const status of STATUS_BLOQUEIO) {
      expect(temAcesso([{ produto: 'tinobem', status }], 'tinobem')).toBe(false);
    }
  });

  it('temAcesso false sem compra', () => {
    expect(temAcesso([], 'tinobem')).toBe(false);
  });
});