import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import {
  gerarHistoricoMock,
  eventosProximos,
  correlacao,
  dorPorRegiao,
  mediaMovel,
  contextoRegiao,
  gatilhoAlimentar,
  gatilhoPorTag,
  faseDoCiclo,
} from '../lib/insights.js';

const TIPOS = ['water', 'meal', 'sleep', 'pain', 'exercise', 'mood', 'evacuation', 'gas', 'medication', 'weight'];

describe('Insights — funções puras (PBT)', () => {
  // Feature: insights, Property 1: o coeficiente de Pearson está sempre em [-1, 1].
  it('Property 1: correlacao ∈ [-1, 1]', () => {
    const arr = fc.array(fc.double({ min: -1e6, max: 1e6, noNaN: true }), { minLength: 0, maxLength: 50 });
    fc.assert(
      fc.property(arr, arr, (xs, ys) => {
        const r = correlacao(xs, ys);
        expect(Number.isNaN(r)).toBe(false);
        expect(r).toBeGreaterThanOrEqual(-1);
        expect(r).toBeLessThanOrEqual(1);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: insights, Property 2: todo par de eventosProximos respeita a janela.
  it('Property 2: eventosProximos respeita a Janela_Temporal', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 999999 }), fc.integer({ min: 1, max: 12 }), (seed, janela) => {
        const hist = gerarHistoricoMock(40, seed);
        const pares = eventosProximos(hist, 'meal', 'pain', janela);
        pares.forEach((p) => {
          expect(p.b.ts).toBeGreaterThanOrEqual(p.a.ts);
          expect(p.horas).toBeGreaterThanOrEqual(0);
          expect(p.horas).toBeLessThanOrEqual(janela + 1e-9);
        });
      }),
      { numRuns: 100 },
    );
  });

  // Feature: insights, Property 3: o mock é determinístico e produz registros válidos.
  it('Property 3: gerarHistoricoMock determinístico e válido', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 999999 }), fc.integer({ min: 5, max: 90 }), (seed, dias) => {
        const a = gerarHistoricoMock(dias, seed);
        const b = gerarHistoricoMock(dias, seed);
        expect(a.length).toBe(b.length);
        expect(a.length).toBeGreaterThan(0);
        for (let i = 0; i < a.length; i += 1) {
          expect(a[i].ts).toBe(b[i].ts);
          expect(a[i].type).toBe(b[i].type);
          expect(typeof a[i].ts).toBe('number');
          expect(TIPOS).toContain(a[i].type);
          if (i > 0) expect(a[i].ts).toBeGreaterThanOrEqual(a[i - 1].ts); // ordenado por ts
        }
      }),
      { numRuns: 100 },
    );
  });

  // Feature: insights, Property 4: o mapa de calor soma o nº de dores com órgão.
  it('Property 4: dorPorRegiao é consistente com os registros de dor', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 999999 }), (seed) => {
        const hist = gerarHistoricoMock(60, seed);
        const counts = dorPorRegiao(hist);
        const soma = Object.values(counts).reduce((s, x) => s + x, 0);
        const esperado = hist.filter((e) => e.type === 'pain' && e.organ).length;
        expect(soma).toBe(esperado);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: insights, Property 5: média móvel preserva o tamanho e fica em [min, max].
  it('Property 5: mediaMovel preserva tamanho e fica dentro de [min, max]', () => {
    const serieArb = fc.array(
      fc.record({ dia: fc.integer(), valor: fc.double({ min: -1000, max: 1000, noNaN: true }) }),
      { minLength: 1, maxLength: 120 },
    );
    fc.assert(
      fc.property(serieArb, fc.integer({ min: 1, max: 14 }), (serie, janela) => {
        const m = mediaMovel(serie, janela);
        expect(m.length).toBe(serie.length);
        const vals = serie.map((p) => p.valor);
        const min = Math.min(...vals);
        const max = Math.max(...vals);
        m.forEach((p) => {
          expect(p.valor).toBeGreaterThanOrEqual(min - 1e-6);
          expect(p.valor).toBeLessThanOrEqual(max + 1e-6);
        });
      }),
      { numRuns: 100 },
    );
  });

  // Feature: insights, Property 6: contextoRegiao bate a contagem e share ∈ [0,1].
  it('Property 6: contextoRegiao é consistente', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 999999 }), (seed) => {
        const h = gerarHistoricoMock(60, seed);
        const ctx = contextoRegiao(h, 'estomago');
        const esperado = h.filter((e) => e.type === 'pain' && e.organ === 'estomago').length;
        expect(ctx.n).toBe(esperado);
        expect(ctx.share).toBeGreaterThanOrEqual(0);
        expect(ctx.share).toBeLessThanOrEqual(1);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: insights, Property 7: gatilhoAlimentar retorna taxas válidas em [0,1].
  it('Property 7: gatilhoAlimentar é consistente', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 999999 }), (seed) => {
        const h = gerarHistoricoMock(75, seed);
        const g = gatilhoAlimentar(h, 'gas', 12);
        if (g.status === 'ok') {
          expect(g.taxaCom).toBeGreaterThanOrEqual(0);
          expect(g.taxaCom).toBeLessThanOrEqual(1);
          expect(g.taxaSem).toBeGreaterThanOrEqual(0);
          expect(g.taxaSem).toBeLessThanOrEqual(1);
          expect(g.n).toBeGreaterThanOrEqual(5);
        } else {
          expect(g.status).toBe('insuficiente');
        }
      }),
      { numRuns: 100 },
    );
  });

  // Feature: insights, Property I-8: contextoRegiao é consistente e factual —
  // n bate a contagem de dor do órgão; share ∈ [0,1]; alimentosFrequentes tem no
  // máximo 3 itens ordenados por n decrescente com tags reais (n ≥ 1) das
  // refeições dos dias com dor; humorMedio é null ou ∈ [1,5]; bristolMedio é
  // null ou ∈ [1,7]. (Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5)
  it('Property I-8: contextoRegiao é consistente e factual', () => {
    const organArb = fc.constantFrom(
      'estomago', 'colon_sig', 'intestino_delgado', 'colon_desc', 'figado',
      'orgao_inexistente', '', 'figado_xyz',
    );
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 999999 }), organArb, (seed, organId) => {
        const h = gerarHistoricoMock(60, seed);
        const ctx = contextoRegiao(h, organId);

        // n bate a contagem de registros de dor com aquele órgão.
        const dorReg = h.filter((e) => e.type === 'pain' && e.organ === organId);
        expect(ctx.n).toBe(dorReg.length);

        // share ∈ [0, 1].
        expect(ctx.share).toBeGreaterThanOrEqual(0);
        expect(ctx.share).toBeLessThanOrEqual(1);

        // Conjunto de dias (chave do dia fisiológico) com dor na região.
        const diaChave = (ts) => {
          const d = new Date(ts - 4 * 3600 * 1000);
          return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
        };
        const diasReg = new Set(dorReg.map((e) => diaChave(e.ts)));
        // Tags que de fato ocorrem em refeições desses dias.
        const tagsValidas = new Set();
        h.forEach((e) => {
          if (e.type === 'meal' && diasReg.has(diaChave(e.ts))) {
            (e.tags || []).forEach((t) => tagsValidas.add(t));
          }
        });

        // alimentosFrequentes: ≤ 3 itens, ordenado por n decrescente, tags reais, n ≥ 1.
        expect(Array.isArray(ctx.alimentosFrequentes)).toBe(true);
        expect(ctx.alimentosFrequentes.length).toBeLessThanOrEqual(3);
        for (let i = 0; i < ctx.alimentosFrequentes.length; i += 1) {
          const item = ctx.alimentosFrequentes[i];
          expect(item.n).toBeGreaterThanOrEqual(1);
          expect(tagsValidas.has(item.tag)).toBe(true);
          if (i > 0) {
            expect(ctx.alimentosFrequentes[i - 1].n).toBeGreaterThanOrEqual(item.n);
          }
        }

        // humorMedio: null ou ∈ [1, 5].
        if (ctx.humorMedio !== null) {
          expect(ctx.humorMedio).toBeGreaterThanOrEqual(1);
          expect(ctx.humorMedio).toBeLessThanOrEqual(5);
        }

        // bristolMedio: null ou ∈ [1, 7].
        if (ctx.bristolMedio !== null) {
          expect(ctx.bristolMedio).toBeGreaterThanOrEqual(1);
          expect(ctx.bristolMedio).toBeLessThanOrEqual(7);
        }

        // Órgão fora do conjunto conhecido → sem amostra de dor na região.
        if (dorReg.length === 0) {
          expect(ctx.n).toBe(0);
          expect(ctx.alimentosFrequentes).toEqual([]);
          expect(ctx.humorMedio).toBeNull();
          expect(ctx.bristolMedio).toBeNull();
        }
      }),
      { numRuns: 100 },
    );
  });

  // Feature: insights, Property I-9: gatilhoAlimentar expõe um Risco_Relativo
  // factual e consistente — no status 'ok', taxaCom e taxaSem ∈ [0, 1]; quando
  // taxaSem > 0, risco === taxaCom / taxaSem e risco ≥ 0; quando taxaSem === 0,
  // risco === null. (Validates: Requirements 14.4, 14.5, 14.6)
  it('Property I-9: gatilhoAlimentar expõe Risco_Relativo factual', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 999999 }), (seed) => {
        const h = gerarHistoricoMock(75, seed);
        const g = gatilhoAlimentar(h, 'gas', 12);
        if (g.status === 'ok') {
          expect(g.taxaCom).toBeGreaterThanOrEqual(0);
          expect(g.taxaCom).toBeLessThanOrEqual(1);
          expect(g.taxaSem).toBeGreaterThanOrEqual(0);
          expect(g.taxaSem).toBeLessThanOrEqual(1);
          if (g.taxaSem > 0) {
            expect(g.risco).toBeCloseTo(g.taxaCom / g.taxaSem, 10);
            expect(g.risco).toBeGreaterThanOrEqual(0);
          } else {
            expect(g.risco).toBeNull();
          }
        } else {
          expect(g.status).toBe('insuficiente');
        }
      }),
      { numRuns: 100 },
    );
  });

  // Feature: insights, Property I-11: gatilhoPorTag generaliza gatilhoAlimentar —
  // no status 'ok' valem as mesmas invariantes do I-9 (taxas ∈ [0, 1]; risco ===
  // taxaCom/taxaSem quando taxaSem > 0, senão null); e gatilhoPorTag(h, 'meal',
  // 'gas', 12) é equivalente a gatilhoAlimentar(h, 'gas', 12), confirmando a
  // refatoração. (Validates: Requirements 15.5, 15.6)
  it('Property I-11: gatilhoPorTag generaliza e é equivalente a gatilhoAlimentar', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 999999 }), (seed) => {
        const h = gerarHistoricoMock(75, seed);
        const g = gatilhoPorTag(h, 'meal', 'gas', 12);

        // Mesmas invariantes do I-9 no caminho 'ok'.
        if (g.status === 'ok') {
          expect(g.taxaCom).toBeGreaterThanOrEqual(0);
          expect(g.taxaCom).toBeLessThanOrEqual(1);
          expect(g.taxaSem).toBeGreaterThanOrEqual(0);
          expect(g.taxaSem).toBeLessThanOrEqual(1);
          if (g.taxaSem > 0) {
            expect(g.risco).toBeCloseTo(g.taxaCom / g.taxaSem, 10);
            expect(g.risco).toBeGreaterThanOrEqual(0);
          } else {
            expect(g.risco).toBeNull();
          }
        } else {
          expect(g.status).toBe('insuficiente');
        }

        // Equivalência com gatilhoAlimentar (refatoração não muda o comportamento).
        const a = gatilhoAlimentar(h, 'gas', 12);
        expect(g).toEqual(a);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: insights, Property I-10: faseDoCiclo é uma função TOTAL — para toda
  // combinação de inicioTs e agoraTs (válidas e inválidas: NaN, não numéricas,
  // início no futuro), retorna sempre uma de 'menstrual'|'folicular'|'lutea'|
  // 'desconhecida'; quando a fase é conhecida diaDoCiclo é inteiro ≥ 1, e quando
  // 'desconhecida' diaDoCiclo === null; inválidos → 'desconhecida' sem lançar.
  // (Validates: Requirements 16.3)
  it('Property I-10: faseDoCiclo é total e factual', () => {
    const FASES = ['menstrual', 'folicular', 'lutea', 'desconhecida'];
    // Mistura de entradas válidas (epoch ms plausível) e inválidas (NaN, não
    // numéricas como string/undefined/null, ±Infinity).
    const tsArb = fc.oneof(
      fc.integer({ min: 0, max: Date.UTC(2100, 0, 1) }),
      fc.double({ min: -1e15, max: 1e15 }), // pode gerar NaN/Infinity
      fc.constantFrom(NaN, Infinity, -Infinity, undefined, null, 'abc', '2026-01-01'),
    );
    const durArb = fc.oneof(
      fc.integer({ min: 1, max: 60 }),
      fc.constantFrom(0, -5, 3.5, NaN, undefined),
    );
    fc.assert(
      fc.property(tsArb, tsArb, durArb, (inicioTs, agoraTs, duracaoCiclo) => {
        let r;
        expect(() => { r = faseDoCiclo(inicioTs, agoraTs, duracaoCiclo); }).not.toThrow();

        // fase é sempre uma das quatro.
        expect(FASES).toContain(r.fase);

        if (r.fase !== 'desconhecida') {
          expect(Number.isInteger(r.diaDoCiclo)).toBe(true);
          expect(r.diaDoCiclo).toBeGreaterThanOrEqual(1);
        } else {
          expect(r.diaDoCiclo).toBeNull();
        }

        // Entradas inválidas (NaN/não numéricas/início no futuro) → 'desconhecida'.
        const invalido = !Number.isFinite(inicioTs) || !Number.isFinite(agoraTs)
          || agoraTs < inicioTs;
        if (invalido) {
          expect(r.fase).toBe('desconhecida');
          expect(r.diaDoCiclo).toBeNull();
        }
      }),
      { numRuns: 100 },
    );
  });
});
