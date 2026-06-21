import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import {
  periodoDoDia,
  buildEvacuationEntry,
  contarPorTipo,
  removerEntrada,
  BRISTOL_DESCRICOES,
  EVAC_CORES,
  EVAC_ODORES,
  BRISTOL_PADRAO,
  buildGasEntry,
  GAS_INTENSIDADES,
  GAS_ODORES,
  GAS_ALIVIO,
  GAS_SOM,
} from '../lib/diary.js';

const TIPOS = ['meal', 'water', 'sleep', 'pain', 'exercise', 'mood', 'evacuation'];

describe('Funções puras do diário (PBT)', () => {
  // Feature: temas-redesign-verde-e-evacuacao, Property 1: Seleção de tema é uma
  // função total e correta da hora local — [5,11]→amanhecer; [12,17]→tarde;
  // [18,23]∪[0,4]→noite; toda entrada inválida → noite.
  it('Property 1: periodoDoDia é total e correta para qualquer hora', () => {
    const validos = new Set(['amanhecer', 'tarde', 'noite']);
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ min: 0, max: 23 }),
          fc.integer(),
          fc.double(),
          fc.constantFrom(NaN, Infinity, -Infinity, '12', null, undefined, {}),
        ),
        (hora) => {
          const r = periodoDoDia(hora);
          expect(validos.has(r)).toBe(true);
          if (Number.isInteger(hora) && hora >= 0 && hora <= 23) {
            if (hora >= 5 && hora <= 11) expect(r).toBe('amanhecer');
            else if (hora >= 12 && hora <= 17) expect(r).toBe('tarde');
            else expect(r).toBe('noite');
          } else {
            expect(r).toBe('noite');
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: temas-redesign-verde-e-evacuacao, Property 2: O salvamento de
  // evacuação sempre produz uma entrada válida (default Bristol=4; opcionais →
  // null; nunca bloqueia).
  it('Property 2: buildEvacuationEntry produz sempre uma entrada válida', () => {
    const formArb = fc.record({
      bristol: fc.oneof(fc.constant(null), fc.integer(), fc.integer({ min: 1, max: 7 })),
      cor: fc.oneof(fc.constant(null), fc.constantFrom(...EVAC_CORES), fc.string()),
      odor: fc.oneof(fc.constant(null), fc.constantFrom(...EVAC_ODORES), fc.string()),
      esforco: fc.oneof(fc.constant(null), fc.integer(), fc.integer({ min: 1, max: 5 })),
      tempo: fc.oneof(fc.constant(null), fc.integer(), fc.integer({ min: 1, max: 120 })),
    });
    fc.assert(
      fc.property(formArb, (form) => {
        const e = buildEvacuationEntry(form);
        expect(typeof e.title).toBe('string');
        expect(e.title.length).toBeGreaterThan(0);
        expect(typeof e.description).toBe('string');
        expect(e.description.length).toBeGreaterThan(0);

        const bristolValido = Number.isInteger(form.bristol) && form.bristol >= 1 && form.bristol <= 7;
        expect(Number.isInteger(e.meta.bristol)).toBe(true);
        expect(e.meta.bristol).toBeGreaterThanOrEqual(1);
        expect(e.meta.bristol).toBeLessThanOrEqual(7);
        expect(e.meta.bristol).toBe(bristolValido ? form.bristol : BRISTOL_PADRAO);

        expect(e.meta.cor === null || EVAC_CORES.includes(e.meta.cor)).toBe(true);
        expect(e.meta.odor === null || EVAC_ODORES.includes(e.meta.odor)).toBe(true);
        expect(
          e.meta.esforco === null ||
            (Number.isInteger(e.meta.esforco) && e.meta.esforco >= 1 && e.meta.esforco <= 5),
        ).toBe(true);
        expect(
          e.meta.tempo === null ||
            (Number.isInteger(e.meta.tempo) && e.meta.tempo >= 1 && e.meta.tempo <= 120),
        ).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: temas-redesign-verde-e-evacuacao, Property 3: O chip de resumo
  // reflete a contagem exata por categoria do dia selecionado.
  it('Property 3: contarPorTipo reflete a contagem exata por categoria', () => {
    const entryArb = fc.record({
      id: fc.integer(),
      day: fc.constantFrom('hoje', 'ontem', 'anteontem'),
      type: fc.constantFrom(...TIPOS),
    });
    fc.assert(
      fc.property(fc.array(entryArb), fc.constantFrom('hoje', 'ontem', 'anteontem'), (entries, dia) => {
        const counts = contarPorTipo(entries, dia);
        const esperado = {};
        entries.forEach((e) => {
          if (e.day === dia) esperado[e.type] = (esperado[e.type] || 0) + 1;
        });
        expect(counts).toEqual(esperado);
        // chip aparece sse contagem ≥ 1 (nenhuma chave com valor 0)
        Object.values(counts).forEach((c) => expect(c).toBeGreaterThanOrEqual(1));
      }),
      { numRuns: 100 },
    );
  });

  // Feature: temas-redesign-verde-e-evacuacao, Property 4: A remoção de um
  // registro é consistente (remove só o alvo; demais intactos; contagem −1).
  it('Property 4: removerEntrada remove apenas o alvo e decrementa a categoria', () => {
    const entriesArb = fc.uniqueArray(
      fc.record({
        id: fc.integer(),
        day: fc.constant('hoje'),
        type: fc.constantFrom(...TIPOS),
      }),
      { selector: (e) => e.id, minLength: 1 },
    );
    fc.assert(
      fc.property(entriesArb, fc.nat(), (entries, k) => {
        const idx = k % entries.length;
        const alvo = entries[idx].id;
        const tipoAlvo = entries[idx].type;
        const antes = contarPorTipo(entries, 'hoje')[tipoAlvo];

        const resultado = removerEntrada(entries, alvo);

        expect(resultado.length).toBe(entries.length - 1);
        expect(resultado.some((e) => e.id === alvo)).toBe(false);
        // demais registros preservados
        entries
          .filter((e) => e.id !== alvo)
          .forEach((e) => expect(resultado.some((r) => r.id === e.id)).toBe(true));
        // contagem da categoria do alvo reduz em exatamente 1
        const depois = contarPorTipo(resultado, 'hoje')[tipoAlvo] || 0;
        expect(depois).toBe(antes - 1);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: temas-redesign-verde-e-evacuacao, Property 7: Todo texto descritivo
  // controlado é factual e livre de termos proibidos (RF 6).
  it('Property 7: conteúdo controlado é factual e sem termos proibidos', () => {
    const PROIBIDOS = [
      'constipa', 'diarre', 'prisão de ventre', 'síndrome', 'doenç', 'doença',
      'infecç', 'câncer', 'tumor', 'saudáv', 'normal', 'anormal', 'diagnós',
      'tratament', 'recomend', 'patolog', 'intolerânc', 'alergia', 'gastrit',
    ];
    const TODOS = [
      ...Object.values(BRISTOL_DESCRICOES),
      ...EVAC_CORES,
      ...EVAC_ODORES,
    ];
    fc.assert(
      fc.property(fc.constantFrom(...TODOS), (txt) => {
        expect(typeof txt).toBe('string');
        expect(txt.trim().length).toBeGreaterThan(0);
        const low = txt.toLowerCase();
        PROIBIDOS.forEach((termo) => expect(low.includes(termo)).toBe(false));
      }),
      { numRuns: 100 },
    );
    // BRISTOL_DESCRICOES cobre cada inteiro de 1 a 7
    [1, 2, 3, 4, 5, 6, 7].forEach((n) => {
      expect(typeof BRISTOL_DESCRICOES[n]).toBe('string');
      expect(BRISTOL_DESCRICOES[n].trim().length).toBeGreaterThan(0);
    });
  });

  // Feature: redesign-verde-e-evacuacao, Property 8: buildGasEntry sempre produz
  // uma entrada válida com campos opcionais normalizados.
  it('Property 8: buildGasEntry produz entrada válida', () => {
    const formArb = fc.record({
      intensidade: fc.oneof(fc.constant(null), fc.constantFrom(...GAS_INTENSIDADES), fc.string()),
      odor: fc.oneof(fc.constant(null), fc.constantFrom(...GAS_ODORES), fc.string()),
      alivio: fc.oneof(fc.constant(null), fc.constantFrom(...GAS_ALIVIO), fc.string()),
      som: fc.oneof(fc.constant(null), fc.constantFrom(...GAS_SOM), fc.string()),
    });
    fc.assert(
      fc.property(formArb, (form) => {
        const e = buildGasEntry(form);
        expect(e.title).toBe('Gases');
        expect(typeof e.description).toBe('string');
        expect(e.description.length).toBeGreaterThan(0);
        expect(e.meta.intensidade === null || GAS_INTENSIDADES.includes(e.meta.intensidade)).toBe(true);
        expect(e.meta.odor === null || GAS_ODORES.includes(e.meta.odor)).toBe(true);
        expect(e.meta.alivio === null || GAS_ALIVIO.includes(e.meta.alivio)).toBe(true);
        expect(e.meta.som === null || GAS_SOM.includes(e.meta.som)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});
