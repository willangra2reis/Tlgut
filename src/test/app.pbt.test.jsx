import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import App from '../App.jsx';

const TABS = ['Diário', 'Análises', 'Aulas', 'Perfil'];

describe('Estado de UI do App (PBT)', () => {
  // Feature: temas-redesign-verde-e-evacuacao, Property 5: Exatamente uma aba
  // ativa por vez; selecionar uma aba placeholder não altera os registros.
  it('Property 5: sempre exatamente uma aba ativa e registros preservados', () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...TABS), { maxLength: 8 }), (seq) => {
        cleanup();
        render(<App />);
        seq.forEach((nome) => fireEvent.click(screen.getByRole('button', { name: nome })));

        // Exatamente uma aba marcada como ativa
        const ativas = document.querySelectorAll('[aria-current="page"]');
        expect(ativas.length).toBe(1);

        // Voltar ao Diário e confirmar que os registros continuam intactos
        fireEvent.click(screen.getByRole('button', { name: 'Diário' }));
        expect(screen.getByText('Café da manhã')).toBeInTheDocument();
      }),
      { numRuns: 100 },
    );
  });

  // Feature: temas-redesign-verde-e-evacuacao, Property 6: A alternância da
  // fonte cursiva é reversível (toggle∘toggle = identidade); a fonte é aplicada
  // via a classe `.cursiva` no contêiner raiz e os textos usam `entry-text`.
  it('Property 6: alternar a cursiva é reversível (round-trip)', () => {
    fc.assert(
      fc.property(fc.nat({ max: 10 }), (n) => {
        cleanup();
        const { container } = render(<App />);
        const root = container.querySelector('[data-theme]');
        // Estado inicial: cursiva desligada (RF 4.1) e há textos de registro
        expect(root.classList.contains('cursiva')).toBe(false);
        expect(container.querySelectorAll('.entry-text').length).toBeGreaterThan(0);

        // Abrir a aba Perfil, onde vive o controle
        fireEvent.click(screen.getByRole('button', { name: 'Perfil' }));

        for (let i = 0; i < n; i += 1) {
          fireEvent.click(screen.getByRole('button', { name: /Ativada|Desativada/ }));
        }

        // par de toggles → volta ao estado inicial (desligado); ímpar → ligado
        expect(root.classList.contains('cursiva')).toBe(n % 2 !== 0);
      }),
      { numRuns: 100 },
    );
  });
});
