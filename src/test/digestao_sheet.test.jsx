import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App.jsx';

describe('Repro tela branca digestão', () => {
  it('abre o sheet de digestão a partir da refeição demo', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 12, 10, 0, 0));
    render(<App />);

    const registrar = screen.getAllByRole('button', { name: /registrar digestão/i })[0];
    fireEvent.click(registrar);
    expect(screen.getByText('Como foi sua digestão?')).toBeInTheDocument();

    // Marca sintoma e salva
    fireEvent.click(screen.getByRole('button', { name: 'Digestão boa' }));
    const salvar = screen.getAllByRole('button', { name: 'Registrar digestão' });
    fireEvent.click(salvar[salvar.length - 1]);

    // Agora o sub-registro aparece; clica no potinho (Ver ou editar)
    const verOuEditar = screen.getAllByRole('button', { name: /ver ou editar/i });
    fireEvent.click(verOuEditar[verOuEditar.length - 1]);
    expect(screen.getAllByText('Editar digestão').length).toBeGreaterThanOrEqual(1);
    vi.useRealTimers();
  });
});
