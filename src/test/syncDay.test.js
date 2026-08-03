// Testes da conversão dia relativo ⇄ absoluto (sync.js).
// Garantem o round-trip: registro criado/editado como "ontem" persiste como
// "ontem" após recarregar (bug de ts sempre = Date.now()).

import { describe, it, expect } from 'vitest';
import { tsParaDia, dayToAbsolute, dayToRelative } from '../lib/sync.js';

const pad2 = (n) => String(n).padStart(2, '0');

function ddmm(d) {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
}

function diaAtras(n, h, m) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(h, m, 0, 0);
  return d;
}

describe('tsParaDia', () => {
  it('resolve "hoje" para a data atual na hora informada', () => {
    const ts = tsParaDia('hoje', '08:30');
    const d = new Date(ts);
    const hoje = new Date();
    expect(d.getFullYear()).toBe(hoje.getFullYear());
    expect(d.getMonth()).toBe(hoje.getMonth());
    expect(d.getDate()).toBe(hoje.getDate());
    expect(d.getHours()).toBe(8);
    expect(d.getMinutes()).toBe(30);
  });

  it('resolve "ontem" para o dia anterior na hora informada', () => {
    const ts = tsParaDia('ontem', '10:30');
    const d = new Date(ts);
    const ontem = diaAtras(1, 0, 0);
    expect(d.getFullYear()).toBe(ontem.getFullYear());
    expect(d.getMonth()).toBe(ontem.getMonth());
    expect(d.getDate()).toBe(ontem.getDate());
    expect(d.getHours()).toBe(10);
    expect(d.getMinutes()).toBe(30);
  });

  it('resolve "anteontem" para dois dias atrás', () => {
    const d = new Date(tsParaDia('anteontem', '23:00'));
    const anteontem = diaAtras(2, 0, 0);
    expect(d.getFullYear()).toBe(anteontem.getFullYear());
    expect(d.getMonth()).toBe(anteontem.getMonth());
    expect(d.getDate()).toBe(anteontem.getDate());
    expect(d.getHours()).toBe(23);
  });
});

describe('round-trip dia relativo ⇄ absoluto', () => {
  it('"ontem" → salva a data absoluta de ontem → recarrega como "ontem"', () => {
    const entry = { day: 'ontem', ts: tsParaDia('ontem', '10:30') };
    const absoluto = dayToAbsolute(entry);
    expect(absoluto).toBe(ddmm(diaAtras(1, 10, 30)));
    expect(dayToRelative(absoluto)).toBe('ontem');
  });

  it('"hoje" → salva a data de hoje → recarrega como "hoje"', () => {
    const entry = { day: 'hoje', ts: tsParaDia('hoje', '08:00') };
    const absoluto = dayToAbsolute(entry);
    expect(absoluto).toBe(ddmm(diaAtras(0, 8, 0)));
    expect(dayToRelative(absoluto)).toBe('hoje');
  });

  it('"anteontem" → recarrega como "anteontem"', () => {
    const entry = { day: 'anteontem', ts: tsParaDia('anteontem', '09:15') };
    const absoluto = dayToAbsolute(entry);
    expect(absoluto).toBe(ddmm(diaAtras(2, 9, 15)));
    expect(dayToRelative(absoluto)).toBe('anteontem');
  });

  it('dia mais antigo que anteontem permanece como DD/MM', () => {
    const absoluto = ddmm(diaAtras(5, 0, 0));
    expect(dayToRelative(absoluto)).toBe(absoluto);
  });

  it('Dia já absoluto não é alterado por dayToAbsolute', () => {
    expect(dayToAbsolute({ day: '15/01', ts: Date.now() })).toBe('15/01');
  });
});
