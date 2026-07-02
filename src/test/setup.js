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
