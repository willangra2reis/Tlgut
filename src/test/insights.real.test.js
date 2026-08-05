import { describe, it, expect } from 'vitest';
import {
  contextoRegiao,
  dorPorRegiao,
  diasComDados,
  poucosDados,
  DIA,
} from '../lib/insights.js';

const base = Date.UTC(2026, 5, 1);

// Formato real dos registros vindos do Supabase: valores dentro de `meta.*`
// (ex.: meta.intensity, meta.clouds[].region, meta.quality, meta.glasses).
function realPain(ts, region, intensity) {
  return {
    ts,
    type: 'pain',
    meta: {
      clouds: [{ region, regionLabel: `Região ${region}`, x: 50, y: 50 }],
      intensity,
    },
  };
}

describe('contextoRegiao com dados reais (clouds region-only + meta.*)', () => {
  it('casa clouds por region e lê intensidade de meta.intensity', () => {
    const hist = [realPain(base, 'regiao_inf_esq', 7)];
    const ctx = contextoRegiao(hist, 'regiao_inf_esq');
    expect(ctx.n).toBe(1);
    expect(ctx.share).toBe(1);
    expect(ctx.intensidadeMedia).toBe(7);
  });

  it('não casa outra região nem conta dor sem a região', () => {
    const hist = [
      realPain(base, 'regiao_inf_esq', 7),
      realPain(base + DIA, 'regiao_inf_centro', 5),
    ];
    const ctx = contextoRegiao(hist, 'regiao_inf_esq');
    expect(ctx.n).toBe(1);
    expect(ctx.share).toBeCloseTo(0.5);
    const outro = contextoRegiao(hist, 'regiao_sup_esq');
    expect(outro.n).toBe(0);
  });

  it('casa também por e.region no topo do registro (estilo legado)', () => {
    const hist = [{ ts: base, type: 'pain', region: 'regiao_centro', meta: { intensity: 5 } }];
    const ctx = contextoRegiao(hist, 'regiao_centro');
    expect(ctx.n).toBe(1);
    expect(ctx.intensidadeMedia).toBe(5);
  });

  it('lê qualidade de sono, copos de água, humor e Bristol de meta.*', () => {
    const hist = [
      realPain(base, 'regiao_inf_esq', 6),
      { ts: base, type: 'sleep', meta: { quality: 4 } },
      { ts: base, type: 'water', meta: { glasses: 5 } },
      { ts: base, type: 'mood', meta: { score: 4 } },
      { ts: base, type: 'evacuation', meta: { bristol: 3 } },
      // dia sem dor: puxa as médias gerais para baixo
      { ts: base + 2 * DIA, type: 'water', meta: { glasses: 2 } },
      { ts: base + 2 * DIA, type: 'sleep', meta: { quality: 2 } },
    ];
    const ctx = contextoRegiao(hist, 'regiao_inf_esq');
    expect(ctx.aguaNesses).toBe(5);
    expect(ctx.aguaGeral).toBeCloseTo(3.5);
    expect(ctx.sonoNesses).toBe(4);
    expect(ctx.sonoGeral).toBe(3);
    expect(ctx.humorMedio).toBe(4);
    expect(ctx.bristolMedio).toBe(3);
  });
});

describe('dorPorRegiao com clouds region-only', () => {
  it('conta cada região por registro', () => {
    const hist = [
      realPain(base, 'regiao_inf_esq', 7),
      realPain(base + DIA, 'regiao_inf_esq', 5),
      realPain(base + 2 * DIA, 'regiao_inf_centro', 6),
    ];
    const counts = dorPorRegiao(hist);
    expect(counts.regiao_inf_esq).toBe(2);
    expect(counts.regiao_inf_centro).toBe(1);
  });
});

describe('poucosDados / diasComDados', () => {
  const serie = (vals) => vals.map((valor, i) => ({ dia: base + i * DIA, valor }));

  it('diasComDados conta apenas valores > 0', () => {
    expect(diasComDados(serie([0, 2, 0, 5]))).toBe(2);
    expect(diasComDados(serie([0, 0, 0]))).toBe(0);
    expect(diasComDados([])).toBe(0);
  });

  it('poucosDados sinaliza 1–2 dias com dado e nega o resto', () => {
    expect(poucosDados(serie([0, 3, 0]))).toBe(true);
    expect(poucosDados(serie([4, 0, 2]))).toBe(true);
    expect(poucosDados(serie([4, 3, 2, 5]))).toBe(false);
    expect(poucosDados(serie([0, 0, 0]))).toBe(false);
    expect(poucosDados([])).toBe(false);
    expect(poucosDados(null)).toBe(false);
  });
});
