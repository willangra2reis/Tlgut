# Plano de Implementação

> Spec: temas-redesign-verde-e-evacuacao · Documentos: `requirements.md`, `design.md`
> Escopo: front-end em memória (sem backend/persistência). Cada tarefa é incremental e termina com código verificável (build/lint/testes).

- [x] 1. Preparar a infraestrutura de testes
  - Adicionar `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` e `fast-check` como devDependencies
  - Configurar o ambiente de teste no `vite.config.js` (environment `jsdom`, setup file com `jest-dom`)
  - Adicionar os scripts `"test": "vitest --run"` e `"test:watch": "vitest"` no `package.json`
  - Criar um teste mínimo de fumaça que renderiza `<App />` sem erros
  - _Requirements: base de verificação para todos os requisitos_

- [x] 2. Definir os tokens da identidade visual verde
  - Em `src/index.css`, criar os tokens de marca (`--brand-deep`, `--brand`, `--brand-soft`, `--surface`, `--card`)
  - Substituir os acentos de marca terracota *hard-coded* (cabeçalho, FAB, botões) pelos tokens verdes
  - Manter as cores funcionais por tipo em `ENTRY_TYPES` harmônicas com o verde e distinguíveis
  - _Requirements: 1.9, 1.10_

- [x] 3. Manter e validar os temas de ambiência por horário
  - Confirmar que `data-theme` e o `AmbianceLayer` (sol/nuvens · alaranjado · estrelas/lua) seguem ativos no render
  - Garantir que `periodoDoDia(horaLocalAtual())` define o tema no primeiro render (cálculo síncrono)
  - Verificar que os acentos verdes da marca coexistem de forma coerente com os três temas, sem quebrar o contraste do texto (≥ 4,5:1), especialmente no Tema_Noite
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11_

- [x] 4. Converter o controle de fonte cursiva (padrão ligado)
  - Renomear o estado `notebook` para `cursiva` e definir o valor inicial como `true`
  - Trocar a classe `.notebook` por `.cursiva` no contêiner raiz e no CSS; aplicar `--fonte-registro` aos títulos e aos textos com classe `entry-text`
  - Atualizar o controle (antigo `NotebookToggle`) para `Controle_de_Fonte_Cursiva`, refletindo o estado com `aria-pressed`
  - Garantir `font-size` da cursiva ≥ tamanho normal e *stack* terminando em `cursive`
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

- [x] 5. Concluir as funções puras de dados e a remoção
  - Funções puras já extraídas em `src/lib/diary.js` (`buildEvacuationEntry`, `contarPorTipo`, `periodoDoDia`, `horaLocalAtual`)
  - Adicionado o núcleo puro `removerEntrada(entries, id)` (idempotente) para a remoção; `handleDelete(id)` no `App` o chamará via `setEntries` quando a UI existir (tarefa 9)
  - _Requirements: 2.3, 2.7, 5.10, 5.11, 5.12_

- [x] 6. Testes de propriedade das funções puras (PBT)
- [x] 6.1 Property 1 — seleção de tema total e correta
  - Gerar horas válidas e inválidas (NaN, negativas, > 23, frações, não-números) e verificar o mapa de faixas e o fallback noite
  - Rotular: `// Feature: temas-redesign-verde-e-evacuacao, Property 1: ...` · `numRuns: 100`
  - _Requirements: 1.1, 1.3, 1.4, 1.5, 1.11_
- [x] 6.2 Property 2 — entrada de evacuação válida
  - Gerar estados de formulário arbitrários e verificar invariantes da entrada; opcionais ausentes não bloqueiam
  - Rotular como Property 2 · `numRuns: 100`
  - _Requirements: 5.3, 5.4, 5.5, 5.6, 5.7, 5.11, 5.12_
- [x] 6.3 Property 3 — contagem de chip exata
  - Gerar listas arbitrárias e verificar que `contarPorTipo` produz a contagem exata por categoria do dia
  - Rotular como Property 3 · `numRuns: 100`
  - _Requirements: 2.3, 5.10_
- [x] 6.4 Property 4 — remoção consistente
  - Gerar lista + id existente e verificar que `handleDelete` remove só o alvo, preserva os demais e reduz a contagem em 1
  - Rotular como Property 4 · `numRuns: 100`
  - _Requirements: 2.7_

- [x] 7. Implementar o Cabeçalho Hero
  - Criar `HeroHeader` com nome do produto ("Intestinal" em cursiva), subtítulo, ilustração do Mascote e ícones de busca e menu (afordâncias visuais)
  - Painel de marca em `--brand-deep`, coerente sobre os temas; posicionar o `Controle_de_Fonte_Cursiva` no cabeçalho
  - _Requirements: 2.1, 4.1_

- [x] 8. Implementar o Card de Resumo do Dia
  - Criar `DaySummaryCard` exibindo a data e os `Chip`s por categoria via `contarPorTipo`
  - Exibir apenas categorias com contagem ≥ 1; usar rótulos amigáveis (ex.: "Alimentação", "Hidratação", "Sintoma")
  - _Requirements: 2.2, 2.3, 5.10_

- [x] 9. Redesenhar a Linha do Tempo conectada e o card de registro
  - Posicionar o horário de cada registro **à esquerda, dentro de um círculo**; ligar os círculos por uma **linha vertical pontilhada** (Fio_Conector), exatamente como na referência aprovada (horário sai da direita e passa para a esquerda)
  - Usar a cor do `ENTRY_TYPES[type].color` no círculo/ponto de cada registro
  - Atualizar `EntryCard` preservando os detalhes por tipo (silhueta de dor, sono, evacuação)
  - Adicionar o `Menu_de_Ações_do_Registro` (três pontos) com a ação **Remover**, ligada a `handleDelete` (que usa o núcleo puro `removerEntrada`)
  - _Requirements: 2.4, 2.5, 2.6, 2.7, 2.8_

- [x] 10. Implementar o Menu de Navegação Inferior
  - Criar `BottomNav` com as abas Diário, Insights, Hábitos, Perfil e o botão central
  - Adicionar o estado `abaAtiva` (padrão `'diario'`); indicar exatamente uma aba ativa com `--brand` e `aria-current`
  - Ligar o botão central ao seletor de tipo; criar `PlaceholderScreen` ("Em breve") para as abas não-Diário sem tocar nos dados
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 11. Adaptar o Registro de Evacuação à identidade verde
  - Conferir que `ENTRY_TYPES.evacuation` e o `EvacuationForm` usam cores alinhadas ao verde e seguem o padrão bottom-sheet
  - Validar o ramo de Evacuação no `EntryCard` e o chip de evacuação na contagem do dia
  - _Requirements: 5.1, 5.2, 5.8, 5.9, 5.10_

- [x] 12. Consolidar o guarda-corpo regulatório
  - Revisar `BRISTOL_DESCRICOES`, `EVAC_CORES` e `EVAC_ODORES` para conter apenas atributos observáveis
  - Revisar rótulos de chips/seções para que nenhum Texto_Descritivo comunique diagnóstico, condição, causalidade ou recomendação
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 13. Testes de propriedade de estado e conteúdo (PBT)
- [x] 13.1 Property 5 — exatamente uma aba ativa
  - Gerar sequências de seleção de aba e verificar que `abaAtiva` é sempre um de quatro valores e que aba placeholder não altera os registros
  - Rotular como Property 5 · `numRuns: 100`
  - _Requirements: 3.2, 3.3, 3.6_
- [x] 13.2 Property 6 — round-trip da fonte cursiva
  - Verificar que alternar duas vezes retorna ao estado original e que, sob `.cursiva`, os textos herdam `--fonte-registro` com tamanho ≥ normal e layout/cores inalterados
  - Rotular como Property 6 · `numRuns: 100`
  - _Requirements: 4.3, 4.4, 4.5, 4.6_
- [x] 13.3 Property 7 — conteúdo descritivo factual
  - Verificar, para `BRISTOL_DESCRICOES` (1–7), `EVAC_CORES` e `EVAC_ODORES`, que o texto é não vazio e livre de termos proibidos
  - Rotular como Property 7 · `numRuns: 100`
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 14. Testes de exemplo / snapshot (UI e configuração)
  - Render de cada tema (`data-theme`) com os decorativos esperados (sol/nuvens, alaranjado, estrelas/lua); contraste ≥ 4,5:1 por tema
  - Identidade verde aplicada (tokens presentes; ausência de terracota nos acentos) coerente sobre os temas
  - Hero com Mascote/busca/menu; Card de Resumo com data e chips; Timeline com fio conector e ponto colorido
  - Menu Inferior com 4 abas + FAB, exatamente uma aba ativa, Diário inicial; aba placeholder não altera registros
  - Cursiva inicial ligada; desativar restaura tipografia normal; *stack* termina em `cursive`; seletor contém "Evacuação"
  - _Requirements: 1.6, 1.7, 1.8, 1.9, 1.10, 2.1, 2.2, 2.4, 2.5, 3.1, 3.2, 3.3, 3.6, 4.1, 4.2, 4.3, 4.7, 5.1, 5.2_

- [x] 15. Verificação final
  - Rodar `npm run lint`, `npm run test` e `npm run build` e corrigir o que aparecer
  - Conferir manualmente a tela do Diário contra a referência aprovada (temas, hero, resumo, timeline conectada, menu inferior, cursiva)
  - _Requirements: todos_

---

# Plano de Implementação — Incremento Insights

- [x] I1. Fundação de análise (dados mockados + funções puras)
  - Criar `src/lib/insights.js` com `gerarHistoricoMock` (60–90 dias, seed, padrões plantados)
  - Implementar `eventosProximos` (Janela_Temporal), `intervalosRefeicaoDor`, `correlacaoAguaBristol`, `dorPorRegiao`, `correlacao` (Pearson) e gating de dados insuficientes
  - _Requirements: 9.1, 9.4, 9.5, 9.8_

- [x] I2. Testes de propriedade da análise (PBT)
  - P-Insights-1 (Pearson ∈ [-1,1]), P-Insights-2 (janela respeitada), P-Insights-3 (mock determinístico e válido), P-Insights-4 (mapa de calor consistente) · `numRuns: 100`
  - _Requirements: 9.1, 9.4, 9.8_

- [x] I3. Tela de Insights — tendências
  - Substituir o placeholder da aba Insights por gráficos de tendência por métrica (água, dor, sono) ao longo do período
  - _Requirements: 9.2, 9.7_

- [x] I4. Mapa de calor da dor por região
  - Reaproveitar a Silhueta para exibir a frequência de dor por órgão (`dorPorRegiao`); tocar numa região filtra os registros daquela área
  - _Requirements: 9.3, 9.7_

- [x] I5. Cards de cruzamento (água↔Bristol, refeição→dor)
  - Apresentar os cruzamentos com mini-gráfico, texto factual e estado de "dados insuficientes"; interação para ver os dados por trás
  - _Requirements: 9.4, 9.5, 9.6, 9.7_

- [x] I6. Testes de exemplo da tela e verificação final
  - Render dos gráficos/mapa/cards e dos estados de dados insuficientes; rodar lint + test + build
  - _Requirements: 9.2, 9.3, 9.5, 9.6_

- [x] I7. Média móvel + métricas Humor/Exercício
  - `mediaMovel(serie, janela)` em `insights.js` (+ propriedade: tamanho preservado e valor ∈ [min,max])
  - Toggle "Suavizar" na tela de Insights; cartões de tendência de Humor (1–5) e Exercício (min/dia)
  - _Requirements: 9.9, 9.10_

- [x] I8. Nota subjetiva de evacuação (1–5)
  - Campo opcional de conforto/satisfação no `EvacuationForm`; `buildEvacuationEntry` guarda `meta.conforto`; exibir no card
  - _Requirements: 10.1, 10.2, 10.3_

> Nota: a **correlação defasada (lag)** com guardas estatísticas entra na tarefa I5 (cards de cruzamento).

---

# Plano de Implementação — Incremento Cruzamentos+ e novos eventos

- [x] C1. Estender `contextoRegiao` (alimentos frequentes, humor, Bristol)
  - Em `src/lib/insights.js`, fazer `contextoRegiao` retornar também `alimentosFrequentes: [{ tag, n }]` (top-N tags das refeições nos dias com dor na região), `humorMedio` e `bristolMedio` (médias restritas a esses dias, `null` sem amostra)
  - Adicionar property test I-8 (consistência: `n` correto, `share ∈ [0,1]`, lista ordenada por `n`, médias em faixa válida ou `null`) · `numRuns: 100` · etiqueta `// Feature: insights, Property I-8: ...`
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [x] C2. Painel de Contexto de Região na UI
  - Em `src/App.jsx`, no painel do `PainHeatmap`, exibir chips de Alimentos_Frequentes, humor médio e Bristol médio; omitir itens sem dado; texto factual (RF 6)
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [x] C3. Card de cruzamento Sono→dor (substitui Hidratação↔sono)
  - Em `src/App.jsx` (`CrossingsSection`/`CrossCard`), trocar o card "Hidratação e sono" por **Sono→dor** usando `correlacaoDefasada` sobre as séries diárias de sono e dor; reportar a defasagem (dias) de forma factual; estado "dados insuficientes"
  - _Requirements: 14.1, 14.2, 14.3, 14.6_

- [x] C4. Risco relativo + texto factual água↔Bristol
  - Em `src/lib/insights.js`, estender `gatilhoAlimentar` para retornar `risco = taxaSem > 0 ? taxaCom/taxaSem : null`; adicionar property test I-9 (taxas ∈ [0,1]; `risco === taxaCom/taxaSem` ou `null`) · `numRuns: 100`
  - Em `src/App.jsx`, exibir a linha de Risco_Relativo ("~Nx mais") no card alimento→sintoma e reescrever o texto do card água↔Bristol para consistência ("mais macia"), sem normalidade/recomendação
  - _Requirements: 14.4, 14.5, 14.6_

- [x] C5. Registro de Medicamentos
  - Em `src/App.jsx`, adicionar `ENTRY_TYPES.medication` (ícone/cor), `MED_TAGS`, estado `customMeds` (sessão) e `MedicationForm` espelhando o `MealForm` (tags predefinidas + personalizadas; sem campos obrigatórios); passar pela Etapa_de_Observação
  - Validar o ramo de medicamento no `EntryCard` e o chip na contagem do dia
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.6_

- [x] C6. Cruzamento medicamento→sintoma
  - Em `src/lib/insights.js`, generalizar o gatilho por tag para aceitar o tipo fonte (`gatilhoPorTag(history, tipoFonte, tipoSintoma, janelaHoras)`), reutilizado por refeição e medicamento; plantar uso de medicamento no `gerarHistoricoMock` para visualização
  - Em `src/App.jsx`, adicionar o card de cruzamento medicamento→sintoma quando houver dados suficientes
  - _Requirements: 15.5, 15.6_

- [x] C7. Registro de Ciclo menstrual (opt-in minimalista)
  - Em `src/lib/insights.js`, adicionar `faseDoCiclo(inicioTs, agoraTs, duracaoCiclo)` (função total) + property test I-10 (sempre uma de 4 fases; `diaDoCiclo` inteiro ≥1 ou `null`; inválidos → 'desconhecida') · `numRuns: 100`
  - Em `src/App.jsx`, adicionar toggle opt-in `cicloAtivo` (padrão `false`) no `ProfileScreen`; quando ativo, expor `ENTRY_TYPES.cycle` no seletor com `CycleForm` (só data de início obrigatória; fluxo/cólica/contraceptivo opcionais via "+ detalhes"); exibir a Fase_do_Ciclo de forma discreta apenas quando ativo
  - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6_

- [x] C8. Verificação final do incremento
  - Rodar `npm run lint`, `npm run test` e `npm run build` e corrigir o que aparecer
  - Conferir manualmente: Contexto de Região com alimentos/humor/Bristol; card Sono→dor; risco relativo; novos eventos Medicamentos e Ciclo (opt-in)
  - _Requirements: 13, 14, 15, 16_
