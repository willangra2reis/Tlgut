import { describe, it, expect } from 'vitest';
import {
  gerarHistoricoMock,
  hhmmParaMinutos,
  minutosParaHHMM,
  mediaCircularHorarios,
  metricasSono,
  metricasAgua,
  intervaloEntreEvacuacoes,
  seriePorDiaHorario,
  serieIntervaloEvacuacoes,
  DIA,
  HORA,
} from '../lib/insights.js';

describe('Horários (HH:MM → minutos e circular)', () => {
  it('hhmmParaMinutos converte e rejeita inválidos', () => {
    expect(hhmmParaMinutos('07:30')).toBe(450);
    expect(hhmmParaMinutos('00:00')).toBe(0);
    expect(hhmmParaMinutos('23:59')).toBe(1439);
    expect(hhmmParaMinutos(null)).toBeNull();
    expect(hhmmParaMinutos('7:30')).toBe(450); // leniente com hora sem zero à esquerda
    expect(hhmmParaMinutos('24:00')).toBeNull();
    expect(hhmmParaMinutos('ab:cd')).toBeNull();
  });

  it('minutosParaHHMM normaliza para 0–24h (mod 24h)', () => {
    expect(minutosParaHHMM(450)).toBe('07:30');
    expect(minutosParaHHMM(0)).toBe('00:00');
    expect(minutosParaHHMM(1439)).toBe('23:59');
    expect(minutosParaHHMM(1450)).toBe('00:10');
    expect(minutosParaHHMM(-10)).toBe('23:50');
  });

  it('média circular aproxima a meia-noite para 23:50 e 00:10', () => {
    const m = mediaCircularHorarios([1430, 10]);
    expect(m.n).toBe(2);
    const min = Math.min(m.media, 1440 - m.media);
    expect(min).toBeLessThanOrEqual(1); // ~00:00 (mod 24h)
  });

  it('média circular de horários idênticos é o próprio horário', () => {
    const m = mediaCircularHorarios([450, 450, 451]);
    expect(Math.abs(m.media - 450)).toBeLessThanOrEqual(1);
  });
});

describe('metricasSono', () => {
  const ent = (ts, extra) => ({ ts, type: 'sleep', ...extra });

  it('média de horas e média circular de deitar/acordar', () => {
    const base = Date.UTC(2026, 5, 1);
    const hist = [
      ent(base, { meta: { quality: 4, deitou: '23:00', acordou: '07:00', horas: 8 } }),
      ent(base + DIA, { meta: { quality: 3, deitou: '22:30', acordou: '06:30', horas: 8 } }),
      // registro antigo sem horários — não conta para nHorarios, mas é sleep
      ent(base + 2 * DIA, { meta: { quality: 2 } }),
    ];
    const m = metricasSono(hist);
    expect(m.mediaHoras).toBe(8);
    expect(m.nHoras).toBe(2);
    expect(m.nHorarios).toBe(2);
    // deitar médio ~22:45, acordar médio ~06:45
    const deitarMin = hhmmParaMinutos(m.mediaDeitar);
    const acordarMin = hhmmParaMinutos(m.mediaAcordar);
    expect(Math.abs(deitarMin - (22 * 60 + 45))).toBeLessThanOrEqual(1);
    expect(Math.abs(acordarMin - (6 * 60 + 45))).toBeLessThanOrEqual(1);
  });

  it('aceita campos no topo do registro (mock) e suporta dormir após meia-noite', () => {
    const base = Date.UTC(2026, 5, 1);
    const hist = [
      { ts: base, type: 'sleep', horas: 6.5, deitou: '01:00', acordou: '07:30' },
      { ts: base + DIA, type: 'sleep', horas: 7, deitou: '23:00', acordou: '06:00' },
    ];
    const m = metricasSono(hist);
    expect(m.mediaHoras).toBeCloseTo(6.75, 2);
    const deitarMin = hhmmParaMinutos(m.mediaDeitar);
    const acordarMin = hhmmParaMinutos(m.mediaAcordar);
    // deitar médio ~00:00 (mod 24h entre 01:00 e 23:00)
    const deitarDist = Math.min(deitarMin, 1440 - deitarMin);
    expect(deitarDist).toBeLessThanOrEqual(30);
    expect(acordarMin).toBeGreaterThanOrEqual(6 * 60 + 45 - 30);
    expect(acordarMin).toBeLessThanOrEqual(6 * 60 + 45 + 30);
  });

  it('sem registros de sono retorna nulos', () => {
    const m = metricasSono([]);
    expect(m.mediaHoras).toBeNull();
    expect(m.mediaDeitar).toBeNull();
    expect(m.mediaAcordar).toBeNull();
    expect(m.nHoras).toBe(0);
  });
});

describe('metricasAgua', () => {
  it('soma copos por dia, conta dias e calcula média/dia', () => {
    const base = Date.UTC(2026, 5, 1);
    const hist = [
      { ts: base + 8 * HORA, type: 'water', glasses: 1 },
      { ts: base + 10 * HORA, type: 'water', glasses: 1 },
      { ts: base + DIA + 9 * HORA, type: 'water', glasses: 1 },
      { ts: base + DIA + 12 * HORA, type: 'water', glasses: 1 },
      { ts: base + DIA + 20 * HORA, type: 'water', glasses: 1 },
      { ts: base + 3 * DIA + 9 * HORA, type: 'water', meta: { glasses: 3 } },
    ];
    const m = metricasAgua(hist);
    expect(m.totalCopos).toBe(8); // 2 + 3 + 3
    expect(m.diasRegistrados).toBe(3);
    expect(m.mediaPorDia).toBe(2.7); // 8 / 3 = 2.67 → 2.7
  });

  it('ignora tipos não-água e sem registros retorna zeros', () => {
    const hist = [
      { ts: Date.UTC(2026, 5, 1), type: 'sleep', meta: { quality: 3 } },
      { ts: Date.UTC(2026, 5, 1), type: 'evacuation', bristol: 4 },
    ];
    expect(metricasAgua(hist).totalCopos).toBe(0);
    expect(metricasAgua(hist).diasRegistrados).toBe(0);
    expect(metricasAgua(hist).mediaPorDia).toBe(0);
    expect(metricasAgua([]).totalCopos).toBe(0);
  });

  it('sem campo glasses conta 1 copo por registro', () => {
    const base = Date.UTC(2026, 5, 1);
    const hist = [
      { ts: base + 8 * HORA, type: 'water' },
      { ts: base + DIA + 8 * HORA, type: 'water' },
    ];
    const m = metricasAgua(hist);
    expect(m.totalCopos).toBe(2);
    expect(m.diasRegistrados).toBe(2);
    expect(m.mediaPorDia).toBe(1);
  });
});

describe('intervaloEntreEvacuacoes', () => {
  it('com menos de 2 eventos é insuficiente', () => {
    expect(intervaloEntreEvacuacoes([]).status).toBe('insuficiente');
    const um = [{ ts: Date.now(), type: 'evacuation' }];
    expect(intervaloEntreEvacuacoes(um).status).toBe('insuficiente');
  });

  it('calcula média/mediana em horas e evacuações/dia (ordena por ts)', () => {
    const base = Date.UTC(2026, 5, 1, 8, 0, 0);
    const evs = [
      { ts: base + 2 * DIA, type: 'evacuation' },
      { ts: base, type: 'evacuation' },
      { ts: base + DIA, type: 'evacuation' },
    ];
    const r = intervaloEntreEvacuacoes(evs);
    expect(r.status).toBe('ok');
    expect(r.n).toBe(3);
    expect(r.pares).toBe(2);
    expect(r.mediaHoras).toBe(24);
    expect(r.medianaHoras).toBe(24);
    // 3 evacuações em 2 dias completos
    expect(r.evacPorDia).toBeCloseTo(1.5, 1);
  });

  it('intervalos irregulares usam mediana correta', () => {
    const base = Date.UTC(2026, 5, 1, 8, 0, 0);
    const evs = [
      { ts: base, type: 'evacuation' },
      { ts: base + 6 * 3600 * 1000, type: 'evacuation' },
      { ts: base + 30 * 3600 * 1000, type: 'evacuation' },
    ];
    const r = intervaloEntreEvacuacoes(evs);
    expect(r.pares).toBe(2);
    expect(r.mediaHoras).toBe(15);
    expect(r.medianaHoras).toBe(24); // mediana superior de [6, 24]
  });
});

describe('Séries novas (horários e intervalo)', () => {
  const sleepEnt = (ts, campo, valor) => ({ ts, type: 'sleep', meta: { [campo]: valor } });

  it('seriePorDiaHorario agrupa por dia e faz forward-fill', () => {
    const base = Date.UTC(2026, 5, 1);
    const hist = [
      sleepEnt(base, 'deitou', '23:00'),
      sleepEnt(base + DIA, 'deitou', '22:00'),
      { ts: base + 3 * DIA, type: 'sleep', meta: { quality: 4 } }, // sem deitou
    ];
    const s = seriePorDiaHorario(hist, 'sleep', 'deitou');
    expect(s.length).toBe(4); // dias 1..4
    expect(hhmmParaMinutos(minutosParaHHMM(s[0].valor))).toBe(23 * 60);
    expect(hhmmParaMinutos(minutosParaHHMM(s[1].valor))).toBe(22 * 60);
    expect(s[2].valor).toBe(22 * 60); // forward-fill do dia anterior
    expect(s[3].valor).toBe(22 * 60);
  });

  it('seriePorDiaHorario vazio sem horários registrados', () => {
    const base = Date.UTC(2026, 5, 1);
    const hist = [
      { ts: base, type: 'sleep', meta: { quality: 3 } },
      { ts: base + DIA, type: 'sleep', meta: { quality: 4 } },
    ];
    expect(seriePorDiaHorario(hist, 'sleep', 'deitou')).toEqual([]);
  });

  it('seriePorDiaHorario com base alinha a série a um período mais amplo', () => {
    const base = Date.UTC(2026, 5, 1);
    const hist = [
      { ts: base + 9 * HORA, type: 'water', glasses: 5 },
      { ts: base + DIA + 9 * HORA, type: 'water', glasses: 6 },
      { ts: base + 4 * DIA + 9 * HORA, type: 'water', glasses: 7 },
      { ts: base + 5 * DIA + 9 * HORA, type: 'water', glasses: 8 },
      { ts: base + 4 * DIA + (7 * 60 + 45) * 60000, type: 'sleep', meta: { horas: 6, deitou: '23:30', acordou: '05:30' } },
      { ts: base + 5 * DIA + (7 * 60 + 45) * 60000, type: 'sleep', meta: { horas: 6.4, deitou: '01:20', acordou: '07:45' } },
    ];
    // Esqueleto de 6 dias (o mesmo que a série de horas/água produz), embora os
    // horários só existam nos dias 5 e 6 → mesmo comprimento, null no início e
    // forward-fill depois do primeiro registro.
    const skel = [0, 1, 2, 3, 4, 5].map((i) => ({ dia: base + i * DIA }));
    const s = seriePorDiaHorario(hist, 'sleep', 'deitou', skel);
    expect(s.length).toBe(6);
    expect(s[0].valor).toBeNull();
    expect(s[3].valor).toBeNull();
    expect(s[4].valor).toBe(23 * 60 + 30);
    expect(s[5].valor).toBe(1 * 60 + 20);
  });

  it('serieIntervaloEvacuacoes atribui o delta ao dia do 2º evento e carrega', () => {
    const base = Date.UTC(2026, 5, 1, 8, 0, 0);
    const hist = [
      { ts: base, type: 'evacuation' },
      { ts: base + DIA, type: 'evacuation' },
      { ts: base + 3 * DIA, type: 'evacuation' },
    ];
    const s = serieIntervaloEvacuacoes(hist);
    expect(s.length).toBe(4); // dias 1..4
    expect(s[1].valor).toBe(24); // delta entre dia1 e dia2
    expect(s[2].valor).toBe(24); // forward-fill
    expect(s[3].valor).toBe(48); // delta entre dia2 e dia4
  });
});

describe('Mock atualizado (sono e evacuações)', () => {
  it('gerarHistoricoMock tem sono com horários e evacuações com ts variados', () => {
    const hist = gerarHistoricoMock(30, 12345);
    const sleeps = hist.filter((e) => e.type === 'sleep');
    const evs = hist.filter((e) => e.type === 'evacuation');
    expect(sleeps.length).toBeGreaterThan(0);
    expect(sleeps.every((s) => typeof s.deitou === 'string' && typeof s.acordou === 'string' && s.horas > 0)).toBe(true);
    expect(evs.length).toBeGreaterThanOrEqual(30); // ≥1 por dia
    const m = metricasSono(hist);
    expect(m.mediaHoras).toBeGreaterThan(0);
    const r = intervaloEntreEvacuacoes(hist);
    expect(r.status).toBe('ok');
    expect(r.mediaHoras).toBeGreaterThan(0);
  });
});
