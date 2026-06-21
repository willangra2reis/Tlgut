import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App.jsx';

// ─── Util de contraste (WCAG) ─────────────────────────────────────────────────
function lum(hex) {
  const c = hex.replace('#', '');
  const rgb = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255).map((v) =>
    v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}
function contraste(a, b) {
  const l1 = lum(a);
  const l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

afterEach(() => {
  vi.useRealTimers();
});

function renderNaHora(h) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2025, 5, 12, h, 0, 0));
  return render(<App />);
}

describe('Temas de ambiência por horário (RF 1)', () => {
  it('05–11h aplica amanhecer com decorativos', () => {
    const { container } = renderNaHora(8);
    const root = container.querySelector('[data-theme]');
    expect(root.getAttribute('data-theme')).toBe('amanhecer');
    const amb = container.querySelector('[aria-hidden="true"].absolute.inset-0');
    expect(amb.childElementCount).toBeGreaterThan(0);
  });

  it('12–17h aplica tarde', () => {
    const { container } = renderNaHora(14);
    expect(container.querySelector('[data-theme]').getAttribute('data-theme')).toBe('tarde');
  });

  it('18–04h aplica noite com estrelas/lua', () => {
    const { container } = renderNaHora(22);
    const root = container.querySelector('[data-theme]');
    expect(root.getAttribute('data-theme')).toBe('noite');
    const amb = container.querySelector('[aria-hidden="true"].absolute.inset-0');
    expect(amb.childElementCount).toBeGreaterThan(5); // lua + muitas estrelas
  });

  it('contraste do texto ≥ 4,5:1 (registros em cartão e rótulos por tema)', () => {
    // Texto dos registros em cartão branco
    expect(contraste('#2B2A28', '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    // Rótulos sobre a ambiência, por tema (amb-text vs cada parada do gradiente)
    const temas = [
      { text: '#2B2A28', bgs: ['#BFE3F2', '#FCE7B8'] }, // amanhecer
      { text: '#2B2A28', bgs: ['#AFC4DE', '#F8C58A'] }, // tarde (degradê de céu)
      { text: '#F2ECE3', bgs: ['#0C1228', '#36426E'] }, // noite
    ];
    temas.forEach(({ text, bgs }) => {
      bgs.forEach((bg) => expect(contraste(text, bg)).toBeGreaterThanOrEqual(4.5));
    });
  });
});

describe('Cabeçalho Hero e Resumo do Dia (RF 2)', () => {
  it('exibe mascote, busca e menu', () => {
    render(<App />);
    expect(screen.getByAltText('Mascote do Diário Intestinal')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buscar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Menu' })).toBeInTheDocument();
  });

  it('exibe data e chips com rótulos amigáveis', () => {
    render(<App />);
    expect(screen.getByText('Sexta-feira, 12 de junho')).toBeInTheDocument();
    expect(screen.getByText('Alimentação')).toBeInTheDocument();
    expect(screen.getByText('Sintoma')).toBeInTheDocument();
    // "Hidratação" aparece como chip e também como título dos registros de água
    expect(screen.getAllByText('Hidratação').length).toBeGreaterThanOrEqual(1);
  });

  it('timeline mostra o horário do registro e o título', () => {
    render(<App />);
    expect(screen.getByText('07:43')).toBeInTheDocument();
    expect(screen.getByText('Café da manhã')).toBeInTheDocument();
  });

  it('identidade verde: hero usa --brand-deep e FAB usa --brand', () => {
    const { container } = render(<App />);
    expect(container.querySelector('header').getAttribute('style')).toContain('--brand-deep');
    expect(screen.getByRole('button', { name: 'Adicionar registro' }).getAttribute('style')).toContain('--brand');
  });
});

describe('Menu de navegação inferior (RF 3)', () => {
  it('inicia no Diário com exatamente uma aba ativa e tem FAB', () => {
    render(<App />);
    ['Diário', 'Insights', 'Hábitos', 'Perfil'].forEach((n) =>
      expect(screen.getByRole('button', { name: n })).toBeInTheDocument(),
    );
    expect(document.querySelectorAll('[aria-current="page"]').length).toBe(1);
    expect(screen.getByRole('button', { name: 'Diário' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('button', { name: 'Adicionar registro' })).toBeInTheDocument();
  });

  it('aba placeholder mostra "Em breve" e não altera os registros', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Hábitos' }));
    expect(screen.getByText('Em breve.')).toBeInTheDocument();
    expect(screen.queryByText('Café da manhã')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Diário' }));
    expect(screen.getByText('Café da manhã')).toBeInTheDocument();
  });
});

describe('Fonte cursiva e Evacuação (RF 4 e 5)', () => {
  it('cursiva inicia ligada e alterna no Perfil', () => {
    const { container } = render(<App />);
    const root = container.querySelector('[data-theme]');
    expect(root.classList.contains('cursiva')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Perfil' }));
    fireEvent.click(screen.getByRole('button', { name: /Ativada|Desativada/ }));
    expect(root.classList.contains('cursiva')).toBe(false);
  });

  it('o seletor de tipos inclui "Evacuação"', () => {
    render(<App />);
    expect(screen.getByText('Evacuação')).toBeInTheDocument();
  });
});

describe('Card de dor — termômetro de intensidade (RF 2)', () => {
  it('exibe a legenda de intensidade e o valor do registro semente', () => {
    render(<App />);
    expect(screen.getByText('Intensidade da dor')).toBeInTheDocument();
    expect(screen.getByText('7/10')).toBeInTheDocument();
  });
});

describe('Aba Insights (RF 9)', () => {
  it('mostra a tela de Insights com cartões de tendência', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Insights' }));
    expect(screen.getByText('Hidratação')).toBeInTheDocument();
    expect(screen.getByText('Qualidade do sono')).toBeInTheDocument();
    expect(screen.getAllByText('média no período').length).toBeGreaterThanOrEqual(3);
  });

  it('mostra o mapa de calor e os cards de cruzamento', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Insights' }));
    expect(screen.getByText('Onde a dor aparece')).toBeInTheDocument();
    expect(screen.getByText('Linha do tempo da dor')).toBeInTheDocument();
    expect(screen.getByText('Água e consistência (Bristol)')).toBeInTheDocument();
    expect(screen.getByText('Refeição → dor (tempo até aparecer)')).toBeInTheDocument();
  });
});
