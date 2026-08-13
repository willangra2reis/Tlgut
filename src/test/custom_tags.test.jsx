import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App.jsx';

beforeEach(() => {
  localStorage.clear();
});

function abrirForm(tipo) {
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar registro' }));
  fireEvent.click(screen.getByRole('button', { name: tipo }));
}

describe('Persistência de tags personalizadas (alimentos, medicamentos, especialidades)', () => {
  it('adiciona alimento customizado e grava no perfil local', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 12, 10, 0, 0));
    render(<App />);

    abrirForm('Refeição');

    // Digita um alimento novo e adiciona (Enter)
    const input = screen.getByPlaceholderText('Adicionar alimento…');
    fireEvent.change(input, { target: { value: 'Açaí' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Persistido no localStorage
    const perfil = JSON.parse(localStorage.getItem('tlgut_profile') || '{}');
    expect(perfil.alimentos_custom).toEqual(['Açaí']);

    // Chip aparece como opção
    expect(screen.getByRole('button', { name: 'Açaí' })).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('alimento customizado persiste ao recarregar (nova sessão) e aparece como chip', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 12, 10, 0, 0));

    // 1ª sessão: adiciona o alimento
    const { unmount } = render(<App />);
    abrirForm('Refeição');
    const input = screen.getByPlaceholderText('Adicionar alimento…');
    fireEvent.change(input, { target: { value: 'Tapioca' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(JSON.parse(localStorage.getItem('tlgut_profile')).alimentos_custom).toEqual(['Tapioca']);
    unmount();

    // 2ª sessão: recarrega e o chip continua lá
    render(<App />);
    abrirForm('Refeição');
    expect(screen.getByRole('button', { name: 'Tapioca' })).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('adiciona medicamento e especialidade customizados e grava no perfil', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 12, 10, 0, 0));

    const { unmount } = render(<App />);
    abrirForm('Medicamento');
    const inputMed = screen.getByPlaceholderText('Adicionar medicamento…');
    fireEvent.change(inputMed, { target: { value: 'Omeprazol 20mg' } });
    fireEvent.keyDown(inputMed, { key: 'Enter' });
    expect(JSON.parse(localStorage.getItem('tlgut_profile')).medicamentos_custom).toEqual(['Omeprazol 20mg']);
    unmount();

    render(<App />);
    abrirForm('Consulta');
    const inputEsp = screen.getByPlaceholderText('Adicionar especialidade…');
    fireEvent.change(inputEsp, { target: { value: 'Coloproctologista' } });
    fireEvent.keyDown(inputEsp, { key: 'Enter' });

    const perfil = JSON.parse(localStorage.getItem('tlgut_profile') || '{}');
    expect(perfil.medicamentos_custom).toEqual(['Omeprazol 20mg']);
    expect(perfil.especialidades_custom).toEqual(['Coloproctologista']);
    expect(screen.getByRole('button', { name: 'Coloproctologista' })).toBeInTheDocument();
    vi.useRealTimers();
  });
});