// Dados de demonstração — preenche o app para visualização.
// Usado pelo botão "Dados de demonstração" no Perfil. Aplica apenas no estado e
// no cache local (localStorage); NÃO escreve no Supabase. Recarregar a página
// restaura os dados reais da conta (ou o modo apresentação, se sem conta).

function proximaSegunda() {
  const hoje = new Date();
  const alvo = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const dia = hoje.getDay();
  const add = (8 - dia) % 7; // próxima segunda (domingo → +7)
  alvo.setDate(alvo.getDate() + (add === 0 ? 7 : add));
  const pad = (n) => String(n).padStart(2, '0');
  return `${alvo.getFullYear()}-${pad(alvo.getMonth() + 1)}-${pad(alvo.getDate())}`;
}

const PROFILE_DEMO = {
  nome: 'Marina',
  idade: 29,
  peso: 62,
  altura: 165,
  condicoes: ['sii'],
  outros: 'Intolerância à lactose em investigação',
};

function relatorioDemo(tipo, titulo) {
  return {
    type: tipo,
    report: {
      resumo_executivo: `${titulo} — demonstração\n\nEste é um relatório fictício para você visualizar como o app fica preenchido. Os dados são de exemplo e não refletem nenhuma pessoa real.\n\nNo seu relatório real, você verá o resumo do período, a evolução dos sintomas, correlações com alimentos e orientações para a consulta.\n\nConclusão: apenas um exemplo de demonstração.`,
      associacoes: [
        { titulo: 'Pão/Trigo', descricao: 'Foi associado a gases e desconforto em 6 de 8 registros no período.', forca: '6 de 8 registros' },
        { titulo: 'Feijão', descricao: 'Coincidiu com cólica em 4 ocasiões registradas.', forca: '4 registros' },
        { titulo: 'Refrigerante', descricao: 'Associado a queimação cerca de 1h após a ingestão.', forca: '3 de 4 registros' },
      ],
    },
    created_at: Date.now(),
    modelo: null,
    period_start: Date.now() - 30 * 86400000,
    period_end: Date.now(),
    resumo_preview: 'Demonstração de relatório para visualização.',
  };
}

export function montarDadosDemo(entriesDemo) {
  return {
    entries: Array.isArray(entriesDemo) ? entriesDemo : [],
    consultas: [
      {
        id: 'demo-consulta-1',
        data: proximaSegunda(),
        especialidade: 'Gastroenterologista',
        status: 'agendada',
        created_at: Date.now(),
      },
    ],
    profile: { ...PROFILE_DEMO },
    reports: [
      relatorioDemo('ia', 'Relatório de IA'),
      relatorioDemo('express', 'Relatório Express'),
    ],
  };
}
