import { describe, it, expect } from 'vitest';
import { agruparMedicamentos } from '../lib/meds.js';

describe('agruparMedicamentos', () => {
  it('agrupa por nome único e preserva finalidade/nota', () => {
    const meds = agruparMedicamentos([
      { type: 'medication', title: 'Medicamento', meta: { tags: ['Probiótico'], finalidade: 'flora intestinal' } },
      { type: 'medication', title: 'Medicamento', meta: { tags: ['Probiótico'], note: 'tomado após o café' } },
      { type: 'medication', title: 'Medicamento', meta: { tags: ['Antiácido'], finalidade: 'azia à noite' } },
    ]);
    expect(meds).toHaveLength(2);
    const prob = meds.find((m) => m.nome === 'Probiótico');
    expect(prob.finalidade).toBe('flora intestinal');
    expect(prob.nota).toBe('tomado após o café');
    const anti = meds.find((m) => m.nome === 'Antiácido');
    expect(anti.finalidade).toBe('azia à noite');
  });

  it('ignora entradas que não são medication', () => {
    expect(agruparMedicamentos([{ type: 'pain', meta: {} }])).toHaveLength(0);
  });

  it('usa o título como nome quando não há tags', () => {
    const meds = agruparMedicamentos([{ type: 'medication', title: 'Vitamina D', meta: {} }]);
    expect(meds).toHaveLength(1);
    expect(meds[0].nome).toBe('Vitamina D');
  });

  it('retorna lista vazia para input inválido', () => {
    expect(agruparMedicamentos(null)).toHaveLength(0);
    expect(agruparMedicamentos([])).toHaveLength(0);
  });
});
