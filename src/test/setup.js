import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

// Garante DOM limpo entre os testes de componente.
afterEach(() => {
  cleanup();
});

// Pré-marca o onboarding como concluído para que o modal de boas-vindas
// não seja renderizado em cada render do App durante os testes (lentidão).
beforeEach(() => {
  localStorage.setItem('tlgut_onboarded', '1');
});

// Mock de window.matchMedia (jsdom não implementa). Usado pelo useEffect de
// instalação PWA do App (display-mode: standalone) e por outros leitores de
// media query. Devolve um objeto compatível com a interface do browser.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}
