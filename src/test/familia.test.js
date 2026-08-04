import { describe, it, expect } from 'vitest';
import {
  historicoFamiliarPreenchido,
  formatarHistoricoFamiliar,
  estadoPopupInicial,
  deveMostrarPopupHistFam,
  registrarConvitePopup,
  marcarEditadoPopup,
  MAX_CONVITES_VAZIOS,
  MAX_CONVITES_CHEIOS,
  INTERVALO_VAZIO_MS,
  INTERVALO_CHEIO_MS,
} from '../lib/familia.js';

const DIA = 24 * 60 * 60 * 1000;

describe('historicoFamiliarPreenchido', () => {
  it('true quando há ao menos um registro com condição', () => {
    expect(historicoFamiliarPreenchido({ historico_familiar: [{ parentesco: 'mae', condicao: 'Doença de Crohn' }] })).toBe(true);
  });

  it('false para lista vazia ou sem condição', () => {
    expect(historicoFamiliarPreenchido({})).toBe(false);
    expect(historicoFamiliarPreenchido({ historico_familiar: [] })).toBe(false);
    expect(historicoFamiliarPreenchido({ historico_familiar: [{ parentesco: 'pai', condicao: '  ' }] })).toBe(false);
    expect(historicoFamiliarPreenchido(null)).toBe(false);
  });
});

describe('formatarHistoricoFamiliar', () => {
  it('formata parentesco — condição (nota)', () => {
    const out = formatarHistoricoFamiliar({
      historico_familiar: [{ parentesco: 'mae', condicao: 'Doença de Crohn', nota: 'aos 40 anos' }],
    });
    expect(out).toEqual(['Mãe — Doença de Crohn (aos 40 anos)']);
  });

  it('omite a nota quando vazia', () => {
    const out = formatarHistoricoFamiliar({
      historico_familiar: [{ parentesco: 'pai', condicao: 'Hipertensão', nota: '' }],
    });
    expect(out).toEqual(['Pai — Hipertensão']);
  });

  it('usa rótulo genérico quando parentesco desconhecido e ignora vazios', () => {
    const out = formatarHistoricoFamiliar({
      historico_familiar: [{ parentesco: '', condicao: 'Diabetes', nota: '' }, { condicao: '  ' }],
    });
    expect(out).toEqual(['Familiar — Diabetes']);
  });

  it('retorna [] para perfil vazio', () => {
    expect(formatarHistoricoFamiliar({})).toEqual([]);
    expect(formatarHistoricoFamiliar(null)).toEqual([]);
  });
});

describe('deveMostrarPopupHistFam — vazio', () => {
  it('mostra na primeira vez', () => {
    const r = deveMostrarPopupHistFam(estadoPopupInicial(), false, 1000);
    expect(r.mostrar).toBe(true);
    expect(r.modo).toBe('vazio');
  });

  it('não mostra de novo no mesmo dia', () => {
    let s = estadoPopupInicial();
    s = registrarConvitePopup(s, 'vazio', 1000);
    const r = deveMostrarPopupHistFam(s, false, 1000 + INTERVALO_VAZIO_MS - 1);
    expect(r.mostrar).toBe(false);
  });

  it('mostra após 24h e para após MAX_CONVITES_VAZIOS', () => {
    let s = estadoPopupInicial();
    let agora = 1000;
    for (let i = 0; i < MAX_CONVITES_VAZIOS; i++) {
      expect(deveMostrarPopupHistFam(s, false, agora).mostrar).toBe(true);
      s = registrarConvitePopup(s, 'vazio', agora);
      agora += DIA;
    }
    const r = deveMostrarPopupHistFam(s, false, agora + DIA);
    expect(r.mostrar).toBe(false);
  });

  it('não mostra se dispensado', () => {
    const r = deveMostrarPopupHistFam({ ...estadoPopupInicial(), dispensado: true }, false, 1000);
    expect(r.mostrar).toBe(false);
  });
});

describe('deveMostrarPopupHistFam — preenchido', () => {
  it('mostra complemento após 1 dia da edição', () => {
    const s = marcarEditadoPopup(estadoPopupInicial(), 1000);
    expect(deveMostrarPopupHistFam(s, true, 1000).mostrar).toBe(false);
    expect(deveMostrarPopupHistFam(s, true, 1000 + DIA).mostrar).toBe(true);
  });

  it('depois espaça a cada 7 dias até MAX_CONVITES_CHEIOS', () => {
    let s = marcarEditadoPopup(estadoPopupInicial(), 1000);
    let agora = 1000 + DIA;
    for (let i = 0; i < MAX_CONVITES_CHEIOS; i++) {
      const r = deveMostrarPopupHistFam(s, true, agora);
      expect(r.mostrar).toBe(true);
      expect(r.modo).toBe('completar');
      s = registrarConvitePopup(s, 'completar', agora);
      agora += INTERVALO_CHEIO_MS;
    }
    expect(deveMostrarPopupHistFam(s, true, agora + DIA).mostrar).toBe(false);
  });

  it('não mostra se dispensado mesmo preenchido', () => {
    const s = { ...marcarEditadoPopup(estadoPopupInicial(), 1000), dispensado: true };
    expect(deveMostrarPopupHistFam(s, true, 1000 + DIA).mostrar).toBe(false);
  });
});
