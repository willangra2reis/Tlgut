import { describe, it, expect, beforeEach } from 'vitest';
import {
  confirmarPalavra,
  PALAVRA_CONFIRMACAO,
  montarExportJSON,
  anonimizarExportJSON,
  anonimizarIdadeNota,
  montarResumoAnalitico,
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

describe('anonimizarIdadeNota', () => {
  it('generaliza idades 10-110 para faixas de 10 anos', () => {
    expect(anonimizarIdadeNota('diagnosticado aos 40 anos')).toBe('diagnosticado aos 40-49 anos');
    expect(anonimizarIdadeNota('aos 18')).toBe('aos 10-19');
    expect(anonimizarIdadeNota('aos 110')).toBe('aos 110-119');
  });

  it('preserva números fora da faixa etária e texto sem números', () => {
    expect(anonimizarIdadeNota('fez 3 cirurgias')).toBe('fez 3 cirurgias');
    expect(anonimizarIdadeNota('aos 8 anos')).toBe('aos 8 anos');
    expect(anonimizarIdadeNota('aos 120')).toBe('aos 120');
    expect(anonimizarIdadeNota('histórico sem números')).toBe('histórico sem números');
    expect(anonimizarIdadeNota('')).toBe('');
    expect(anonimizarIdadeNota(null)).toBeNull();
  });
});

describe('anonimizarExportJSON', () => {
  it('zera o nome e aplica faixas a idade/peso/altura', () => {
    const dados = montarExportJSON({
      profile: { nome: 'Ana', idade: 32, peso: 68, altura: 165, condicoes: ['lactose'] },
      prefs: { cursiva: true },
      entries: [{ id: 1, type: 'meal', note: 'almoço da Ana' }],
    });
    const a = anonimizarExportJSON(dados, 'Ana');
    expect(a.perfil.nome).toBeNull();
    expect(a.perfil.idade).toMatch(/29-35/);
    expect(a.perfil.peso).toMatch(/63-73/);
    expect(a.perfil.altura).toMatch(/160-170/);
    expect(a.perfil.condicoes).toEqual(['lactose']);
  });

  it('generaliza a idade na nota do histórico familiar mantendo parentesco e condição', () => {
    const dados = {
      perfil: {
        nome: 'Ana',
        historico_familiar: [
          { parentesco: 'pai', condicao: 'Doença de Crohn', nota: 'diagnosticado aos 40 anos' },
          { parentesco: 'mae', condicao: 'Hipertensão', nota: 'histórico longo' },
        ],
      },
    };
    const a = anonimizarExportJSON(dados, 'Ana');
    expect(a.perfil.historico_familiar).toEqual([
      { parentesco: 'pai', condicao: 'Doença de Crohn', nota: 'diagnosticado aos 40-49 anos' },
      { parentesco: 'mae', condicao: 'Hipertensão', nota: 'histórico longo' },
    ]);
  });

  it('substitui o nome por "paciente" em notas, relatórios e consultas (sem tocar o original)', () => {
    const dados = {
      perfil: { nome: 'Ana' },
      registros: [{ id: 1, title: 'Ana marcou consulta', meta: { note: 'com a dra Ana' } }],
      relatorios: { ia: [{ report: { resumo_executivo: 'Olá Ana!' } }], express: [] },
      consultas: [{ especialidade: 'Gastroenterologista', anotacao: 'retorno para a Ana' }],
    };
    const a = anonimizarExportJSON(dados, 'Ana');
    expect(a.registros[0].title).toBe('paciente marcou consulta');
    expect(a.registros[0].meta.note).toBe('com a dra paciente');
    expect(a.relatorios.ia[0].report.resumo_executivo).toBe('Olá paciente!');
    expect(a.consultas[0].anotacao).toBe('retorno para a paciente');
    // Original não mutado
    expect(dados.registros[0].title).toBe('Ana marcou consulta');
    expect(dados.registros[0].meta.note).toBe('com a dra Ana');
  });

  it('aceita dados vazios e nome ausente sem quebrar', () => {
    expect(anonimizarExportJSON({}, 'Ana')).toEqual({});
    expect(anonimizarExportJSON(null, 'Ana')).toBeNull();
    const dados = { perfil: { nome: 'Ana' }, registros: [{ title: 'Ana tomou remédio' }] };
    const vazio = anonimizarExportJSON(dados, '');
    expect(vazio.perfil.nome).toBeNull();
    expect(vazio.registros[0].title).toBe('Ana tomou remédio');
  });
});

describe('montarResumoAnalitico', () => {
  it('gera um resumo markdown descritivo com contagens e médias', () => {
    const base = Date.UTC(2026, 5, 1);
    const entries = [
      { id: 1, ts: base, type: 'meal', meta: { tags: ['Feijão'] } },
      { id: 2, ts: base + 3600000, type: 'pain', meta: { intensity: 6 } },
      { id: 3, ts: base + 7200000, type: 'evacuation', meta: { bristol: 4 } },
      { id: 4, ts: base + 86400000, type: 'sleep', meta: { horas: 7 } },
      { id: 5, ts: base + 90000000, type: 'water', meta: { glasses: 2 } },
    ];
    const resumo = montarResumoAnalitico({ entries, profile: { idade: 32 } });
    expect(resumo).toContain('# Resumo analítico');
    expect(resumo).toContain('Refeições: 1');
    expect(resumo).toContain('Dores: 1');
    expect(resumo).toContain('Evacuações: 1');
    expect(resumo).toContain('Tipo 4: 1');
    expect(resumo).toContain('Intensidade média (0-10): 6');
    expect(resumo).toContain('Sono');
    expect(resumo).toContain('Hidratação');
    // Sem gatilho alimentar nem inferência causal
    expect(resumo).not.toContain('gatilho');
    expect(resumo).not.toContain('correla');
  });

  it('funciona com dados vazios', () => {
    const resumo = montarResumoAnalitico({});
    expect(resumo).toContain('# Resumo analítico');
    expect(resumo).toContain('Registros: 0');
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
