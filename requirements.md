# Documento de Requisitos

## Introdução

Este documento especifica o **primeiro incremento** de evolução do protótipo *Diário Intestinal* (timelinegut): um aplicativo de diário pessoal de bem-estar digestivo, construído em React 19 + Vite 6 + Tailwind 4, que hoje funciona inteiramente no front-end com estado em memória (sem backend e sem persistência).

O protótipo atual já possui: uma linha do tempo diária agrupada por dia, seis tipos de registro com formulários em *bottom-sheet* (Refeição, Água, Sono, Dor, Exercício e Humor), chips de resumo do dia e um mapa corporal interativo do sistema digestivo (a "Silhueta") com marcação de pontos de dor por toque.

Este incremento é **puramente visual e de captura de dados**, sem qualquer trabalho de banco de dados ou persistência — todos os dados continuam vivendo apenas na memória do cliente, exatamente como hoje. As três entregas deste incremento são:

1. **Temas de ambiência por horário do dia** — a identidade visual do aplicativo muda automaticamente conforme o período do dia (amanhecer, tarde/entardecer e noite).
2. **Estilo caderno (manuscrito)** — uma estética opcional de caderno, com fonte cursiva/manuscrita, para que os registros pareçam anotações pessoais reais.
3. **Novo tipo de registro de Evacuação** — um novo tipo de entrada que captura Escala de Bristol (1–7), cor, odor, esforço para evacuar e tempo gasto para evacuar, seguindo o mesmo padrão de formulário em *bottom-sheet* dos demais tipos.

Um requisito transversal e inegociável cobre o posicionamento regulatório do produto: o aplicativo é estritamente um diário pessoal de bem-estar, **nunca** uma ferramenta de diagnóstico ou aconselhamento médico.

### Visão de produto de longo prazo (somente contexto — fora do escopo deste incremento)

> Esta seção é **apenas contextual** para orientar decisões de design e **não** gera requisitos neste incremento.
>
> A visão de longo prazo é um rastreador de hábitos de saúde intestinal que registra o dia completo do usuário (sono, água, exercício, refeições, qualidade das evacuações, humor e dor via mapa corporal interativo) para cruzar variáveis que uma pessoa não conseguiria acompanhar manualmente. O valor central é gerar um **relatório de período** (ex.: últimos 30 dias) e, via IA, gerar **perguntas relevantes** que o usuário deveria levar ao seu médico (gastroenterologista/nutricionista) — uma "pré-consulta de perguntas, não de respostas" — exportável/imprimível como PDF de uma página. O objetivo é resolver o problema de **comunicação entre paciente e médico**, nunca dar conselho médico. Fases futuras (não neste incremento) incluem: gerador de relatório+perguntas por IA, exportação em PDF, sistema de indicação/recompensa, produtos digitais secundários, área de links de afiliados e uma camada social. O backend será Supabase, adicionado em incremento posterior. A economia unitária atual do negócio é apertada (LTV:CAC ~1,65x), o que torna o sistema de indicação e os produtos secundários importantes para a viabilidade — relevante como contexto, porém trabalho futuro.

## Glossário

- **Aplicativo**: o aplicativo front-end Diário Intestinal (timelinegut) em sua forma atual de protótipo, com estado em memória.
- **Tema_de_Ambiência**: conjunto de estilos visuais (cores de fundo, tons de destaque e elementos decorativos) aplicado conforme o período do dia.
- **Período_do_Dia**: faixa de horário que determina o Tema_de_Ambiência ativo; assume um dos valores "amanhecer", "tarde" ou "noite".
- **Tema_Amanhecer**: Tema_de_Ambiência com tons de azul e amarelo, sol e poucas nuvens, com sensação de "bom dia".
- **Tema_Tarde**: Tema_de_Ambiência com tons mais quentes e levemente alaranjados, evocando o entardecer.
- **Tema_Noite**: Tema_de_Ambiência escuro, com estrelas e lua.
- **Identidade_Visual_Base**: a identidade existente do Aplicativo baseada na cor terracota e na tipografia serifada, que deve permanecer coerente em todos os temas.
- **Estilo_Caderno**: estética opcional de caderno que aplica uma fonte cursiva/manuscrita aos registros, fazendo-os parecerem anotações pessoais.
- **Controle_de_Estilo_Caderno**: elemento de interface que permite ao usuário ativar ou desativar o Estilo_Caderno.
- **Tipo_de_Registro**: categoria de entrada da linha do tempo; atualmente Refeição, Água, Sono, Dor, Exercício e Humor.
- **Registro_de_Evacuação**: novo Tipo_de_Registro que captura dados de uma evacuação.
- **Escala_de_Bristol**: escala visual de classificação de fezes com sete valores inteiros, de 1 a 7.
- **Formulário_Bottom_Sheet**: padrão de formulário existente que desliza a partir da base da tela para capturar os dados de um registro.
- **Linha_do_Tempo**: lista de registros agrupada por dia exibida na tela principal do Aplicativo.
- **Chip_de_Resumo_do_Dia**: indicador compacto no topo da Linha_do_Tempo que mostra a contagem de registros de cada Tipo_de_Registro no dia atual.
- **Texto_Descritivo**: qualquer rótulo, descrição ou texto auxiliar exibido ao usuário, incluindo as descrições da Escala_de_Bristol.
- **Valor_Padrão_Bristol**: valor inteiro 4 atribuído à Escala_de_Bristol quando o usuário confirma o salvamento de um Registro_de_Evacuação sem selecionar um valor.

## Requisitos

### Requisito 1: Tema de ambiência por horário do dia

**História de usuário:** Como usuário do diário, quero que a aparência do aplicativo mude conforme o horário do dia, para que a experiência de registrar pareça acolhedora e conectada ao momento em que estou usando.

#### Critérios de Aceitação

1. WHEN o Aplicativo é aberto ou recarregado, THE Aplicativo SHALL determinar o Período_do_Dia a partir do horário local do dispositivo.
2. WHEN o Período_do_Dia é determinado, THE Aplicativo SHALL aplicar o Tema_de_Ambiência correspondente em até 1 segundo.
3. WHILE o horário local estiver entre 05:00 e 11:59, THE Aplicativo SHALL aplicar o Tema_Amanhecer.
4. WHILE o horário local estiver entre 12:00 e 17:59, THE Aplicativo SHALL aplicar o Tema_Tarde.
5. WHILE o horário local estiver entre 18:00 e 04:59, THE Aplicativo SHALL aplicar o Tema_Noite.
6. WHERE o Tema_Amanhecer está ativo, THE Aplicativo SHALL exibir uma ambiência de fundo com tons de azul e amarelo e elementos decorativos de sol e nuvens.
7. WHERE o Tema_Tarde está ativo, THE Aplicativo SHALL exibir uma ambiência de fundo com tons quentes alaranjados.
8. WHERE o Tema_Noite está ativo, THE Aplicativo SHALL exibir uma ambiência de fundo escura com elementos decorativos de estrelas e lua.
9. THE Aplicativo SHALL preservar a Identidade_Visual_Base (cor terracota e tipografia serifada) em todos os Temas_de_Ambiência.
10. WHILE qualquer Tema_de_Ambiência estiver ativo, THE Aplicativo SHALL manter o conteúdo de texto dos registros com uma razão de contraste mínima de 4,5:1 em relação à ambiência de fundo.
11. IF o horário local não puder ser obtido ou for inválido, THEN THE Aplicativo SHALL aplicar o Tema_Noite como fallback sem bloquear o carregamento do Aplicativo.

### Requisito 2: Estilo caderno (manuscrito)

**História de usuário:** Como usuário do diário, quero ativar um estilo de caderno com letra manuscrita, para que minhas anotações pareçam notas pessoais reais de um diário.

#### Critérios de Aceitação

1. THE Aplicativo SHALL fornecer um Controle_de_Estilo_Caderno que permite ao usuário ativar e desativar o Estilo_Caderno, com estado inicial desativado.
2. WHEN o usuário ativa o Estilo_Caderno, THE Aplicativo SHALL aplicar a fonte cursiva/manuscrita a todos os textos dos registros exibidos na Linha_do_Tempo em até 1 segundo.
3. WHEN o usuário desativa o Estilo_Caderno, THE Aplicativo SHALL restaurar a tipografia padrão de todos os textos dos registros exibidos na Linha_do_Tempo em até 1 segundo.
4. WHILE o Estilo_Caderno estiver ativo, THE Aplicativo SHALL manter o tamanho da fonte dos textos dos registros igual ou superior ao tamanho da tipografia padrão.
5. WHILE o Estilo_Caderno estiver ativo, THE Aplicativo SHALL preservar a Identidade_Visual_Base, mantendo inalterados o layout, as cores e o espaçamento dos elementos da Linha_do_Tempo.
6. WHILE o Estilo_Caderno estiver ativo, THE Aplicativo SHALL aplicar a fonte cursiva/manuscrita também aos registros adicionados após a ativação.
7. IF a fonte cursiva/manuscrita não puder ser carregada, THEN THE Aplicativo SHALL aplicar uma fonte alternativa cursiva legível e manter o Controle_de_Estilo_Caderno no estado ativo.
8. THE Aplicativo SHALL manter o estado do Controle_de_Estilo_Caderno em memória durante a sessão atual.

### Requisito 3: Registro de Evacuação

**História de usuário:** Como usuário do diário, quero registrar minhas evacuações com detalhes como a Escala de Bristol, cor, odor, esforço e tempo gasto, para que eu acompanhe esse aspecto do meu bem-estar digestivo junto dos demais registros do dia.

#### Critérios de Aceitação

1. THE Aplicativo SHALL incluir o Registro_de_Evacuação como um Tipo_de_Registro selecionável na lista de tipos do Formulário_Bottom_Sheet.
2. WHEN o usuário seleciona o Registro_de_Evacuação, THE Aplicativo SHALL exibir um Formulário_Bottom_Sheet seguindo o mesmo padrão visual e de interação dos formulários dos Tipos_de_Registro existentes.
3. THE Formulário_Bottom_Sheet de Evacuação SHALL permitir ao usuário selecionar exatamente um valor inteiro da Escala_de_Bristol no intervalo de 1 a 7.
4. THE Formulário_Bottom_Sheet de Evacuação SHALL permitir ao usuário selecionar a cor da evacuação a partir de uma lista predefinida de opções de cor, aceitando no máximo uma opção selecionada.
5. THE Formulário_Bottom_Sheet de Evacuação SHALL permitir ao usuário selecionar o odor da evacuação a partir de uma lista predefinida de níveis de intensidade, aceitando no máximo uma opção selecionada.
6. THE Formulário_Bottom_Sheet de Evacuação SHALL permitir ao usuário selecionar o nível de esforço para evacuar como um valor inteiro no intervalo de 1 a 5.
7. THE Formulário_Bottom_Sheet de Evacuação SHALL permitir ao usuário registrar o tempo gasto para evacuar como um valor inteiro em minutos no intervalo de 1 a 120.
8. WHEN o usuário confirma o salvamento de um Registro_de_Evacuação, THE Aplicativo SHALL adicionar o registro à Linha_do_Tempo no dia atual com o horário local do momento do salvamento.
9. THE Aplicativo SHALL exibir o Registro_de_Evacuação na Linha_do_Tempo com ícone e cores próprios, de forma consistente com os demais Tipos_de_Registro.
10. WHEN existe ao menos um Registro_de_Evacuação no dia atual, THE Aplicativo SHALL exibir um Chip_de_Resumo_do_Dia para o Registro_de_Evacuação com a contagem correspondente.
11. IF o usuário confirma o salvamento sem selecionar um valor da Escala_de_Bristol, THEN THE Aplicativo SHALL registrar a evacuação atribuindo o valor inteiro 4 como valor padrão da Escala_de_Bristol.
12. WHERE os campos de cor, odor, nível de esforço ou tempo gasto não foram preenchidos pelo usuário, THE Aplicativo SHALL salvar o Registro_de_Evacuação mantendo esses campos vazios, sem impedir a confirmação do salvamento.

### Requisito 4: Posicionamento de bem-estar (guarda-corpo regulatório)

**História de usuário:** Como responsável pelo produto, quero garantir que o aplicativo se mantenha estritamente como um diário pessoal de bem-estar digestivo, para que ele nunca seja interpretado como ferramenta de diagnóstico ou aconselhamento médico.

#### Critérios de Aceitação

1. THE Aplicativo SHALL apresentar todo Texto_Descritivo contendo apenas descrições factuais dos dados registrados, sem termos de avaliação, recomendação ou julgamento.
2. WHERE a Escala_de_Bristol exibe descrições de seus valores, THE Aplicativo SHALL limitar as descrições a atributos observáveis das fezes (forma, consistência e textura), sem associá-las a qualquer condição, diagnóstico, juízo de normalidade ou anormalidade, ou recomendação.
3. THE Aplicativo SHALL manter todo Texto_Descritivo livre de nomes de condições ou doenças, de termos diagnósticos, de afirmações de causalidade e de recomendações de tratamento.
4. IF um Texto_Descritivo precisaria comunicar uma interpretação de saúde, um diagnóstico ou uma recomendação para ser exibido, THEN THE Aplicativo SHALL substituí-lo por uma descrição factual limitada a atributos observáveis do dado registrado.
