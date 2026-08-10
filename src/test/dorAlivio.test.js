import { describe, it, expect } from 'vitest';
import {
  agruparAliviosDor,
  duracaoDorMin,
  dorAliviada,
  obterIntervencoes,
  formatarDuracao,
} from '../lib/dorAlivio.js';

const HORA = 3600000;

describe('dorAlivio', () => {
  it('dorAliviada só é verdadeira com um nível total', () => {
    const dorParcial = { type: 'pain', meta: { intervencoes: [{ ts: 1, acao: 'Chá', nivel: 'parcial' }] } };
    const dorTotal = { type: 'pain', meta: { intervencoes: [{ ts: 1, acao: 'Chá', nivel: 'total' }] } };
    expect(dorAliviada(dorParcial)).toBe(false);
    expect(dorAliviada(dorTotal)).toBe(true);
  });

  it('dores sem intervencoes permanecem ativas (default defensivo)', () => {
    expect(dorAliviada({ type: 'pain', meta: {} })).toBe(false);
    expect(obterIntervencoes({ type: 'pain' })).toHaveLength(0);
  });

  it('duracaoDorMin mede do ts da entrada até o nível total', () => {
    const inicio = Date.UTC(2026, 5, 1, 10, 0);
    const dor = {
      type: 'pain',
      ts: inicio,
      meta: {
        intensity: 6,
        intervencoes: [
          { ts: inicio + 30 * 60000, acao: 'Dipirona', nivel: 'pouco' },
          { ts: inicio + 2 * HORA + 15 * 60000, acao: 'Alívio', nivel: 'total' },
        ],
      },
    };
    expect(duracaoDorMin(dor)).toBe(135);
    expect(formatarDuracao(135)).toBe('2h:15m');
    expect(formatarDuracao(45)).toBe('45 min');
    expect(formatarDuracao(null)).toBeNull();
  });

  it('duracaoDorMin é null sem nível total', () => {
    expect(duracaoDorMin({ type: 'pain', ts: 0, meta: { intervencoes: [{ ts: 1, nivel: 'parcial' }] } })).toBeNull();
  });

  it('agruparAliviosDor ignora dores sem alívio e agrega as aliviadas', () => {
    const dia = Date.UTC(2026, 5, 1, 10, 0);
    const dorSem = { type: 'pain', id: 1, ts: dia, meta: { intensity: 4 } };
    const dorOK = {
      type: 'pain', id: 2, ts: dia,
      meta: {
        intensity: 7,
        clouds: [{ regionLabel: 'Lado inferior direito do abdômen' }],
        intervencoes: [
          { ts: dia + 20 * 60000, acao: 'Bolsa térmica', nivel: 'pouco' },
          { ts: dia + 90 * 60000, acao: 'Soltar gases', nivel: 'total' },
        ],
      },
    };
    const res = agruparAliviosDor([dorSem, dorOK]);
    expect(res.n).toBe(1);
    expect(res.episodios[0].intensity).toBe(7);
    expect(res.episodios[0].regioes).toContain('Lado inferior direito do abdômen');
    expect(res.episodios[0].intervencoes).toHaveLength(2);
    expect(res.episodios[0].duracaoMin).toBe(90);
    expect(res.maisFrequentes).toHaveLength(2);
    expect(res.maisFrequentes.map((m) => m.acao)).toContain('Soltar gases');
    expect(res.alivioMedioMin).toBe(90);
  });

  it('retorna agregado vazio para input inválido', () => {
    expect(agruparAliviosDor(null).n).toBe(0);
    expect(agruparAliviosDor([]).n).toBe(0);
  });
});