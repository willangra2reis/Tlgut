import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from '../App.jsx';

describe('App (smoke)', () => {
  it('renderiza sem erros, com a marca e o menu inferior', () => {
    render(<App />);
    expect(screen.getByText('Intestinal')).toBeInTheDocument();
    // Abas do menu inferior (textos únicos)
    expect(screen.getByText('Insights')).toBeInTheDocument();
    expect(screen.getByText('Perfil')).toBeInTheDocument();
  });
});
