import { describe, it, expect } from 'vitest';
import {
  agruparAliviosDigestao,
  duracaoDigestaoMin,
  digestaoAliviada,
  obterDigestoes,
  DIA_SINTOMAS,
  ACOES_DIGESTAO,
} from '../lib/digestao.js';

const HORA = 3600000;

describe('digestao', () => {
  it('digestaoAliviada só é verdadeira com um nível total', () => {
    const parcial = { type: 'meal', meta: { digestoes: [{ ts: 1, sintomas: ['Azia'], nivel: 'parcial' }] } };
    const total = { type: 'meal', meta: { digestoes: [{ ts: 1, sintomas: ['Azia'], nivel: 'total' }] } };
    expect(digestaoAliviada(parcial)).toBe(false);
    expect(digestaoAliviada(total)).toBe(true);
  });

  it('refeições sem digestão permanecem sem registro (default defensivo)', () => {
    expect(digestaoAliviada({ type: 'meal', meta: {} })).toBe(false);
    expect(obterDigestoes({ type: 'meal' })).toHaveLength(0);
  });

  it('obterDigestoes ordena cronologicamente e ignora itens inválidos', () => {
    const refeicao = {
      type: 'meal',
      meta: { digestoes: [{ ts: 3 }, null, { ts: 1 }, 'x' ] },
    };
    expect(obterDigestoes(refeicao).map((d) => d.ts)).toEqual([1, 3]);
  });

  it('duracaoDigestaoMin mede do ts da refeição até o nível total', () => {
    const inicio = Date.UTC(2026, 5, 1, 10, 0);
    const refeicao = {
      type: 'meal',
      ts: inicio,
      meta: {
        digestoes: [
          { ts: inicio + 30 * 60000, sintomas: ['Azia'], acao: 'Antiácido', nivel: 'pouco' },
          { ts: inicio + 2 * HORA + 15 * 60000, sintomas: ['Azia'], nivel: 'total' },
        ],
      },
    };
    expect(duracaoDigestaoMin(refeicao)).toBe(135);
  });

  it('duracaoDigestaoMin é null sem nível total', () => {
    expect(duracaoDigestaoMin({ type: 'meal', ts: 0, meta: { digestoes: [{ ts: 1, nivel: 'parcial' }] } })).toBeNull();
  });

  it('agruparAliviosDigestao ignora refeições sem alívio e agrega as aliviadas', () => {
    const dia = Date.UTC(2026, 5, 1, 10, 0);
    const refSem = { type: 'meal', id: 1, ts: dia, meta: { tags: ['Feijão'] } };
    const refOK = {
      type: 'meal', id: 2, ts: dia,
      meta: {
        tags: ['Feijão', 'Carne'],
        digestoes: [
          { ts: dia + 20 * 60000, sintomas: ['Estufamento'], acao: 'Chá de hortelã', nivel: 'pouco' },
          { ts: dia + 90 * 60000, sintomas: ['Estufamento'], acao: 'Chá de hortelã', nivel: 'total' },
        ],
      },
    };
    const res = agruparAliviosDigestao([refSem, refOK]);
    expect(res.n).toBe(1);
    expect(res.episodios[0].alimentos).toContain('Feijão');
    expect(res.episodios[0].digestoes).toHaveLength(2);
    expect(res.episodios[0].duracaoMin).toBe(90);
    expect(res.maisFrequentes).toHaveLength(1);
    expect(res.maisFrequentes.map((m) => m.acao)).toContain('Chá de hortelã');
    expect(res.alivioMedioMin).toBe(90);
  });

  it('retorna agregado vazio para input inválido', () => {
    expect(agruparAliviosDigestao(null).n).toBe(0);
    expect(agruparAliviosDigestao([]).n).toBe(0);
  });

  it('expõe sintomas e ações pré-definidas de digestão', () => {
    expect(DIA_SINTOMAS).toContain('Queimação');
    expect(DIA_SINTOMAS).toContain('Refluxo');
    expect(ACOES_DIGESTAO).toContain('Antiácido');
    expect(new Set(ACOES_DIGESTAO).size).toBe(ACOES_DIGESTAO.length);
  });
});