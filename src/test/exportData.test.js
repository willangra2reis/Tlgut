import { describe, it, expect, beforeEach } from 'vitest';
import {
  confirmarPalavra,
  PALAVRA_CONFIRMACAO,
  montarExportJSON,
  limparDadosLocais,
} from '../lib/exportData.js';

describe('confirmarPalavra (trava de exclusão)', () => {
  it('aceita apenas a palavra exata', () => {
    expect(confirmarPalavra('DELETAR')).toBe(true);
  });

  it('rejeita variações e valores parciais', () => {
    expect(confirmarPalavra('deletar')).toBe(false);
    expect(confirmarPalavra('DELETAR ')).toBe(false);
    expect(confirmarPalavra(' DELETAR')).toBe(false);
    expect(confirmarPalavra('DELETA')).toBe(false);
    expect(confirmarPalavra('')).toBe(false);
    expect(confirmarPalavra(null)).toBe(false);
    expect(confirmarPalavra(undefined)).toBe(false);
    expect(confirmarPalavra(123)).toBe(false);
  });

  it('a palavra de confirmação está definida como DELETAR', () => {
    expect(PALAVRA_CONFIRMACAO).toBe('DELETAR');
  });
});

describe('montarExportJSON', () => {
  it('monta a estrutura completa com os dados fornecidos', () => {
    const json = montarExportJSON({
      profile: { nome: 'Ana' },
      prefs: { cursiva: true },
      entries: [{ id: 1 }],
      reportsIA: [{ id: 'ia1' }],
      reportsExpress: [{ id: 'ex1' }],
      consultas: [{ id: 'c1' }],
    });
    expect(json.app).toBe('TimelineGut');
    expect(json.perfil).toEqual({ nome: 'Ana' });
    expect(json.preferencias).toEqual({ cursiva: true });
    expect(json.registros).toEqual([{ id: 1 }]);
    expect(json.relatorios.ia).toEqual([{ id: 'ia1' }]);
    expect(json.relatorios.express).toEqual([{ id: 'ex1' }]);
    expect(json.consultas).toEqual([{ id: 'c1' }]);
    expect(new Date(json.exportadoEm).getTime()).not.toBeNaN();
  });

  it('normaliza entradas ausentes para arrays vazios e objetos nulos', () => {
    const json = montarExportJSON({});
    expect(json.perfil).toBeNull();
    expect(json.registros).toEqual([]);
    expect(json.relatorios.ia).toEqual([]);
    expect(json.relatorios.express).toEqual([]);
    expect(json.consultas).toEqual([]);
  });
});

describe('limparDadosLocais', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('remove todas as chaves tlgut_* de dados', () => {
    localStorage.setItem('tlgut_profile', '{}');
    localStorage.setItem('tlgut_prefs', '{}');
    localStorage.setItem('tlgut_reports', '[]');
    localStorage.setItem('tlgut_guest_mode', '1');
    localStorage.setItem('tlgut_consultas', '[]');

    limparDadosLocais();

    expect(localStorage.getItem('tlgut_profile')).toBeNull();
    expect(localStorage.getItem('tlgut_prefs')).toBeNull();
    expect(localStorage.getItem('tlgut_reports')).toBeNull();
    expect(localStorage.getItem('tlgut_guest_mode')).toBeNull();
    expect(localStorage.getItem('tlgut_consultas')).toBeNull();
  });

  it('não remove chaves fora da lista de dados', () => {
    localStorage.setItem('tlgut_outra_coisa', 'x');
    limparDadosLocais();
    expect(localStorage.getItem('tlgut_outra_coisa')).toBe('x');
  });
});
