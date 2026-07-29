import { describe, it, expect } from 'vitest';
import { anonimizarPerfil, anonimizarTextoIA } from '../lib/profile.js';

describe('Anonimização de perfil (exportação)', () => {
  it('remove o nome e substitui idade/peso/altura por faixas', () => {
    const p = { nome: 'William', idade: 36, peso: 99, altura: 198, condicoes: ['diabetes'] };
    const a = anonimizarPerfil(p);
    expect(a.nome).toBeNull();
    expect(a.idade).toBe('33-39 anos');
    expect(a.peso).toBe('94-104 kg');
    expect(a.altura).toBe('193-203 cm');
  });

  it('mantém condicoes e outros inalterados', () => {
    const p = { nome: 'Maria', idade: 50, peso: 70, altura: 165, condicoes: ['hipertensao'], outros: 'observação livre' };
    const a = anonimizarPerfil(p);
    expect(a.condicoes).toEqual(['hipertensao']);
    expect(a.outros).toBe('observação livre');
  });

  it('não muta o objeto original', () => {
    const p = { nome: 'John', idade: 40, peso: 80 };
    const snapshot = JSON.parse(JSON.stringify(p));
    anonimizarPerfil(p);
    expect(p).toEqual(snapshot);
  });

  it('aceita {} sem quebrar', () => {
    const a = anonimizarPerfil({});
    expect(a.nome).toBeNull();
    expect(a.idade).toBeUndefined();
    expect(a.peso).toBeUndefined();
  });

  it('aceita null sem quebrar', () => {
    const a = anonimizarPerfil(null);
    expect(a).toEqual({});
  });

  it('pula campos ausentes', () => {
    const a = anonimizarPerfil({ nome: 'Paula' });
    expect(a.nome).toBeNull();
    expect(a.idade).toBeUndefined();
    expect(a.peso).toBeUndefined();
    expect(a.altura).toBeUndefined();
  });
});

describe('Anonimização de texto da IA', () => {
  it('substitui o nome por "paciente" (case-insensitive)', () => {
    const txt = 'Olá, William! Como você está, William?';
    const out = anonimizarTextoIA(txt, 'William');
    expect(out).toBe('Olá, paciente! Como você está, paciente?');
  });

  it('lowercase também funciona', () => {
    const txt = 'Bom dia, maria.';
    const out = anonimizarTextoIA(txt, 'Maria');
    expect(out).toBe('Bom dia, paciente.');
  });

  it('sem nome retorna o texto inalterado', () => {
    const txt = 'Olá, paciente!';
    expect(anonimizarTextoIA(txt, '')).toBe(txt);
    expect(anonimizarTextoIA(txt, null)).toBe(txt);
    expect(anonimizarTextoIA(txt, '   ')).toBe(txt);
  });

  it('texto vazio retorna vazio', () => {
    expect(anonimizarTextoIA('', 'William')).toBe('');
    expect(anonimizarTextoIA(null, 'William')).toBe('');
  });

  it('escapa caracteres regex-especiais no nome', () => {
    const txt = 'Oi, A.B (paciente)';
    const out = anonimizarTextoIA(txt, 'A.B');
    expect(out).toBe('Oi, paciente (paciente)');
  });
});
