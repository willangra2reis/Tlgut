# Documento de Requisitos

## Introdução

Este documento especifica o **incremento de redesign visual** do protótipo *Diário Intestinal* (timelinegut): um aplicativo de diário pessoal de bem-estar digestivo, construído em React 19 + Vite 6 + Tailwind 4, que hoje funciona inteiramente no front-end com estado em memória (sem backend e sem persistência).

O protótipo atual já possui: uma linha do tempo diária agrupada por dia, sete tipos de registro com formulários em *bottom-sheet* (Refeição, Água, Sono, Dor, Exercício, Humor e Evacuação), chips de resumo do dia e um mapa corporal interativo do sistema digestivo (a "Silhueta") com marcação de pontos de dor por toque.

Este incremento é **puramente visual e de captura de dados**, sem qualquer trabalho de banco de dados ou persistência — todos os dados continuam vivendo apenas na memória do cliente, exatamente como hoje. As entregas deste incremento, orientadas por uma referência de design aprovada pelo responsável do produto, são:

1. **Temas de ambiência por horário do dia** — a ambiência de fundo do aplicativo muda automaticamente conforme o período do dia (amanhecer, tarde/entardecer e noite), com a noite como *fallback*.
2. **Nova identidade visual verde** — a identidade da marca passa do terracota para a paleta verde da referência aprovada, aplicada de forma coerente sobre todos os temas de ambiência.
3. **Redesign da tela do Diário** — um cabeçalho "hero" com ilustração de mascote, um card de resumo do dia, e uma linha do tempo com fio conector ligando os horários dos registros.
4. **Menu de navegação inferior** — uma barra inferior com quatro abas (Diário, Insights, Hábitos, Perfil) e o botão de adicionar central; neste incremento apenas a aba Diário é funcional, e as demais são espaços reservados (placeholders).
5. **Fonte cursiva opcional** — uma fonte cursiva/manuscrita aplicada aos títulos e aos textos dos registros, **ligada por padrão**, que o usuário pode desativar para usar tipografia normal.
6. **Registro de Evacuação** — mantido como tipo de registro, com seu visual adaptado à nova identidade verde.

Um requisito transversal e inegociável cobre o posicionamento regulatório do produto: o aplicativo é estritamente um diário pessoal de bem-estar, **nunca** uma ferramenta de diagnóstico ou aconselhamento médico.

### Visão de produto de longo prazo (somente contexto — fora do escopo deste incremento)

> Esta seção é **apenas contextual** para orientar decisões de design e **não** gera requisitos neste incremento.
>
> A visão de longo prazo é um rastreador de hábitos de saúde intestinal que registra o dia completo do usuário (sono, água, exercício, refeições, qualidade das evacuações, humor e dor via mapa corporal interativo) para cruzar variáveis que uma pessoa não conseguiria acompanhar manualmente. O valor central é gerar um **relatório de período** (ex.: últimos 30 dias) e, via IA, gerar **perguntas relevantes** que o usuário deveria levar ao seu médico (gastroenterologista/nutricionista) — uma "pré-consulta de perguntas, não de respostas" — exportável/imprimível como PDF de uma página. O objetivo é resolver o problema de **comunicação entre paciente e médico**, nunca dar conselho médico. As abas Insights, Hábitos e Perfil do menu inferior são âncoras visuais para fases futuras (relatório+perguntas por IA, exportação em PDF, sistema de indicação/recompensa, produtos digitais secundários, links de afiliados e uma camada social). O backend será Supabase, adicionado em incremento posterior.

## Glossário

- **Aplicativo**: o aplicativo front-end Diário Intestinal (timelinegut) em sua forma atual de protótipo, com estado em memória.
- **Tema_de_Ambiência**: conjunto de estilos visuais (cores de fundo e elementos decorativos) aplicado conforme o período do dia.
- **Período_do_Dia**: faixa de horário que determina o Tema_de_Ambiência ativo; assume um dos valores "amanhecer", "tarde" ou "noite".
- **Tema_Amanhecer**: Tema_de_Ambiência com tons de azul e amarelo, sol e poucas nuvens, com sensação de "bom dia".
- **Tema_Tarde**: Tema_de_Ambiência com um degradê de céu de entardecer, do tom mais frio (azul suave) no alto ao laranja quente próximo ao horizonte, com sol poente e nuvens.
- **Tema_Noite**: Tema_de_Ambiência escuro, com estrelas e lua.
- **Identidade_Visual_Verde**: a identidade da marca baseada na paleta verde da referência aprovada (verde escuro no cabeçalho, verdes de destaque e cartões claros), que substitui a antiga identidade terracota e deve permanecer coerente sobre todos os Temas_de_Ambiência.
- **Cabeçalho_Hero**: a região superior da tela do Diário que apresenta o nome do produto, um subtítulo, a ilustração do Mascote e os ícones de busca e de menu.
- **Mascote**: a ilustração decorativa do intestino estilizado exibida no Cabeçalho_Hero.
- **Card_Resumo_do_Dia**: o cartão abaixo do Cabeçalho_Hero que exibe a data selecionada e os Chips_de_Resumo_do_Dia.
- **Chip_de_Resumo_do_Dia**: indicador compacto que mostra a contagem de registros de uma categoria no dia selecionado.
- **Linha_do_Tempo**: lista de registros do dia exibida na tela do Diário.
- **Fio_Conector**: o elemento visual vertical que liga, na Linha_do_Tempo, os horários dos registros em sequência, com um ponto colorido por registro.
- **Tipo_de_Registro**: categoria de entrada da Linha_do_Tempo; atualmente Refeição, Água, Sono, Dor, Exercício, Humor e Evacuação.
- **Menu_de_Ações_do_Registro**: controle por registro (ícone de três pontos) que abre ações disponíveis para aquele registro.
- **Menu_Inferior**: a barra de navegação fixa na base da tela, com as abas Diário, Insights, Hábitos e Perfil e o botão de adicionar central.
- **Aba_Ativa**: a aba do Menu_Inferior atualmente selecionada.
- **Aba_Placeholder**: uma aba do Menu_Inferior (Insights, Hábitos ou Perfil) que, neste incremento, exibe apenas um estado reservado, sem funcionalidade.
- **Fonte_Cursiva**: a fonte cursiva/manuscrita aplicada aos títulos e aos textos dos registros.
- **Controle_de_Fonte_Cursiva**: elemento de interface que permite ao usuário ativar ou desativar a Fonte_Cursiva.
- **Registro_de_Evacuação**: Tipo_de_Registro que captura dados de uma evacuação.
- **Escala_de_Bristol**: escala visual de classificação de fezes com sete valores inteiros, de 1 a 7.
- **Formulário_Bottom_Sheet**: padrão de formulário existente que desliza a partir da base da tela para capturar os dados de um registro.
- **Texto_Descritivo**: qualquer rótulo, descrição ou texto auxiliar exibido ao usuário, incluindo as descrições da Escala_de_Bristol.
- **Valor_Padrão_Bristol**: valor inteiro 4 atribuído à Escala_de_Bristol quando o usuário confirma o salvamento de um Registro_de_Evacuação sem selecionar um valor.
- **Etapa_de_Observação**: passo exibido ao salvar qualquer registro, com campo de texto e ditado por voz, que incentiva (sem obrigar) o usuário a anotar uma observação antes de persistir o registro.
- **Controle_de_Intensidade_do_Texto**: controle na aba Perfil que ajusta o brilho/força da cor do texto dos registros.
- **Controle_de_Tamanho_do_Texto**: controle na aba Perfil que ajusta o tamanho do texto de leitura dos registros.

## Requisitos

### Requisito 1: Tema de ambiência por horário do dia

**História de usuário:** Como usuário do diário, quero que a ambiência do aplicativo mude conforme o horário do dia, para que a experiência de registrar pareça acolhedora e conectada ao momento em que estou usando.

#### Critérios de Aceitação

1. WHEN o Aplicativo é aberto ou recarregado, THE Aplicativo SHALL determinar o Período_do_Dia a partir do horário local do dispositivo.
2. WHEN o Período_do_Dia é determinado, THE Aplicativo SHALL aplicar o Tema_de_Ambiência correspondente em até 1 segundo.
3. WHILE o horário local estiver entre 05:00 e 11:59, THE Aplicativo SHALL aplicar o Tema_Amanhecer.
4. WHILE o horário local estiver entre 12:00 e 17:59, THE Aplicativo SHALL aplicar o Tema_Tarde.
5. WHILE o horário local estiver entre 18:00 e 04:59, THE Aplicativo SHALL aplicar o Tema_Noite.
6. WHERE o Tema_Amanhecer está ativo, THE Aplicativo SHALL exibir uma ambiência de fundo com tons de azul e amarelo e elementos decorativos de sol e nuvens.
7. WHERE o Tema_Tarde está ativo, THE Aplicativo SHALL exibir uma ambiência de fundo em degradê de céu de entardecer, transicionando de um tom mais frio no alto para tons quentes alaranjados próximo ao horizonte, com elementos decorativos de sol poente e nuvens.
8. WHERE o Tema_Noite está ativo, THE Aplicativo SHALL exibir uma ambiência de fundo escura com elementos decorativos de estrelas e lua.
9. THE Aplicativo SHALL preservar a Identidade_Visual_Verde (acentos de marca em verde) coerente em todos os Temas_de_Ambiência.
10. WHILE qualquer Tema_de_Ambiência estiver ativo, THE Aplicativo SHALL manter o conteúdo de texto dos registros com uma razão de contraste mínima de 4,5:1 em relação ao seu fundo.
11. IF o horário local não puder ser obtido ou for inválido, THEN THE Aplicativo SHALL aplicar o Tema_Noite como fallback sem bloquear o carregamento do Aplicativo.

### Requisito 2: Redesign da tela do Diário

**História de usuário:** Como usuário do diário, quero uma tela inicial com um cabeçalho ilustrado, um resumo do dia e uma linha do tempo conectada, para que registrar e revisar meu dia seja agradável e fácil de ler.

#### Critérios de Aceitação

1. THE Aplicativo SHALL exibir um Cabeçalho_Hero contendo o nome do produto, um subtítulo, a ilustração do Mascote e os controles de busca e de menu.
2. THE Aplicativo SHALL exibir um Card_Resumo_do_Dia com a data do dia selecionado e os Chips_de_Resumo_do_Dia.
3. WHEN existe ao menos um registro de uma categoria no dia selecionado, THE Aplicativo SHALL exibir o Chip_de_Resumo_do_Dia dessa categoria com a contagem exata de registros da categoria no dia.
4. THE Aplicativo SHALL exibir a Linha_do_Tempo dos registros do dia com um Fio_Conector que liga os horários em sequência, apresentando um ponto colorido por registro com a cor do seu Tipo_de_Registro.
5. THE Aplicativo SHALL exibir, para cada registro da Linha_do_Tempo, o horário do registro, seu ícone e cor próprios, o título e a descrição.
6. THE Aplicativo SHALL exibir, em cada registro da Linha_do_Tempo, um Menu_de_Ações_do_Registro que permite ao usuário remover aquele registro.
7. WHEN o usuário aciona a remoção de um registro pelo Menu_de_Ações_do_Registro, THE Aplicativo SHALL remover o registro da Linha_do_Tempo e atualizar as contagens dos Chips_de_Resumo_do_Dia de forma consistente.
8. THE Aplicativo SHALL preservar a Silhueta interativa e a marcação de pontos de dor existentes.
9. WHERE a descrição ou as observações de um registro excedem um limite de tamanho, THE Aplicativo SHALL exibir o texto de forma recolhida com um controle para expandir ("ver mais") e recolher ("ver menos") o conteúdo completo.
10. WHERE um Registro de Dor é exibido na Linha_do_Tempo, THE Aplicativo SHALL apresentar a intensidade da dor de forma gráfica (escala de verde a vermelho conforme a intensidade) acompanhada da legenda numérica no formato "N/10", e exibir as observações de forma visualmente distinta da descrição da dor.
11. WHEN o usuário toca na silhueta de um Registro de Dor na Linha_do_Tempo, THE Aplicativo SHALL exibir uma visualização ampliada da silhueta com as marcas de dor sobre a tela atual, sem navegar para fora do Diário, com um controle para fechar.

### Requisito 3: Menu de navegação inferior

**História de usuário:** Como usuário do diário, quero um menu de navegação na base da tela, para que eu perceba as áreas do aplicativo e tenha acesso rápido ao registro.

#### Critérios de Aceitação

1. THE Aplicativo SHALL exibir um Menu_Inferior fixo com as abas Diário, Insights, Hábitos e Perfil e o botão de adicionar central.
2. THE Aplicativo SHALL iniciar com a aba Diário como Aba_Ativa.
3. THE Aplicativo SHALL indicar visualmente exatamente uma Aba_Ativa por vez no Menu_Inferior.
4. WHEN o usuário aciona o botão de adicionar central, THE Aplicativo SHALL abrir o seletor de Tipo_de_Registro em Formulário_Bottom_Sheet.
5. WHEN o usuário seleciona a aba Diário, THE Aplicativo SHALL exibir a tela do Diário com a Linha_do_Tempo.
6. WHEN o usuário seleciona uma Aba_Placeholder (Insights, Hábitos ou Perfil), THE Aplicativo SHALL exibir um estado reservado indicando que a área estará disponível futuramente, sem alterar nem remover os registros existentes.

### Requisito 4: Fonte cursiva opcional

**História de usuário:** Como usuário do diário, quero que o aplicativo use por padrão uma letra cursiva agradável, mas possa trocar para letra normal, para que eu escolha o estilo de leitura que prefiro.

#### Critérios de Aceitação

1. THE Aplicativo SHALL fornecer um Controle_de_Fonte_Cursiva que permite ao usuário ativar e desativar a Fonte_Cursiva, com estado inicial ativado.
2. WHILE a Fonte_Cursiva estiver ativa, THE Aplicativo SHALL aplicar a fonte cursiva/manuscrita aos títulos da interface e aos textos dos registros exibidos na Linha_do_Tempo.
3. WHEN o usuário desativa a Fonte_Cursiva, THE Aplicativo SHALL restaurar a tipografia normal dos títulos e dos textos dos registros em até 1 segundo.
4. WHEN o usuário ativa a Fonte_Cursiva, THE Aplicativo SHALL aplicar a fonte cursiva/manuscrita em até 1 segundo, inclusive aos registros adicionados após a ativação.
5. WHILE a Fonte_Cursiva estiver ativa, THE Aplicativo SHALL manter o tamanho da fonte dos textos dos registros igual ou superior ao tamanho da tipografia normal.
6. WHILE a Fonte_Cursiva estiver ativa, THE Aplicativo SHALL preservar o layout, as cores e o espaçamento dos elementos da Linha_do_Tempo inalterados em relação ao estado com tipografia normal.
7. IF a fonte cursiva/manuscrita não puder ser carregada, THEN THE Aplicativo SHALL aplicar uma fonte alternativa cursiva legível e manter o Controle_de_Fonte_Cursiva no estado vigente.
8. THE Aplicativo SHALL manter o estado do Controle_de_Fonte_Cursiva em memória durante a sessão atual.

### Requisito 5: Registro de Evacuação

**História de usuário:** Como usuário do diário, quero registrar minhas evacuações com detalhes como a Escala de Bristol, cor, odor, esforço e tempo gasto, para que eu acompanhe esse aspecto do meu bem-estar digestivo junto dos demais registros do dia.

#### Critérios de Aceitação

1. THE Aplicativo SHALL incluir o Registro_de_Evacuação como um Tipo_de_Registro selecionável na lista de tipos do Formulário_Bottom_Sheet.
2. WHEN o usuário seleciona o Registro_de_Evacuação, THE Aplicativo SHALL exibir um Formulário_Bottom_Sheet seguindo o mesmo padrão visual e de interação dos formulários dos Tipos_de_Registro existentes, com suas cores alinhadas à Identidade_Visual_Verde.
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

### Requisito 6: Posicionamento de bem-estar (guarda-corpo regulatório)

**História de usuário:** Como responsável pelo produto, quero garantir que o aplicativo se mantenha estritamente como um diário pessoal de bem-estar digestivo, para que ele nunca seja interpretado como ferramenta de diagnóstico ou aconselhamento médico.

#### Critérios de Aceitação

1. THE Aplicativo SHALL apresentar todo Texto_Descritivo contendo apenas descrições factuais dos dados registrados, sem termos de avaliação, recomendação ou julgamento.
2. WHERE a Escala_de_Bristol exibe descrições de seus valores, THE Aplicativo SHALL limitar as descrições a atributos observáveis das fezes (forma, consistência e textura), sem associá-las a qualquer condição, diagnóstico, juízo de normalidade ou anormalidade, ou recomendação.
3. THE Aplicativo SHALL manter todo Texto_Descritivo livre de nomes de condições ou doenças, de termos diagnósticos, de afirmações de causalidade e de recomendações de tratamento.
4. IF um Texto_Descritivo precisaria comunicar uma interpretação de saúde, um diagnóstico ou uma recomendação para ser exibido, THEN THE Aplicativo SHALL substituí-lo por uma descrição factual limitada a atributos observáveis do dado registrado.

### Requisito 7: Observações nos registros (empurrão suave)

**História de usuário:** Como usuário do diário, quero ser incentivado a anotar uma observação ao salvar qualquer registro, para que meu histórico fique mais rico do que apenas números.

#### Critérios de Aceitação

1. WHEN o usuário confirma o salvamento de qualquer Tipo_de_Registro, THE Aplicativo SHALL apresentar uma etapa de observação antes de persistir o registro, com um campo de texto para anotação e um controle de ditado por voz.
2. THE Aplicativo SHALL permitir concluir o salvamento com observação preenchida ou sem observação, sem bloquear o salvamento (empurrão suave, não obrigatório).
3. WHERE o navegador suporta reconhecimento de voz, THE Aplicativo SHALL permitir ditar a observação por voz; caso contrário, THE Aplicativo SHALL desabilitar o controle de voz sem impedir a digitação.
4. WHEN um registro possui observação, THE Aplicativo SHALL exibi-la na Linha_do_Tempo de forma visualmente distinta da descrição, e recolhida com controle "ver mais"/"ver menos" quando longa.
5. THE Aplicativo SHALL aplicar a etapa de observação a todos os Tipos_de_Registro (Refeição, Água, Sono, Dor, Exercício, Humor e Evacuação).

### Requisito 8: Acessibilidade de leitura

**História de usuário:** Como usuário com dificuldade visual, quero ajustar a força da cor e o tamanho do texto dos registros, para que eu consiga ler confortavelmente.

#### Critérios de Aceitação

1. THE Aplicativo SHALL fornecer, na aba Perfil, um Controle_de_Intensidade_do_Texto que ajusta o brilho/força da cor do texto dos registros, com efeito imediato.
2. THE Aplicativo SHALL fornecer, na aba Perfil, um Controle_de_Tamanho_do_Texto que ajusta o tamanho do texto de leitura dos registros dentro de uma faixa que preserve o layout, com efeito imediato.
3. THE Aplicativo SHALL manter o estado do Controle_de_Intensidade_do_Texto e do Controle_de_Tamanho_do_Texto em memória durante a sessão atual.
4. WHILE o Controle_de_Tamanho_do_Texto é ajustado, THE Aplicativo SHALL manter o conteúdo legível sem quebrar o layout (os cartões crescem em altura e a lista permanece rolável).

## Glossário (incremento Insights)

- **Insight**: observação factual derivada do cruzamento/agergação dos registros do próprio usuário, apresentada sem diagnóstico, causalidade ou recomendação.
- **Janela_Temporal**: intervalo de tempo (em horas) usado para relacionar dois eventos registrados — por exemplo, dor que ocorre até N horas após uma refeição.
- **Historico_Mock**: conjunto de registros gerado artificialmente (com volume e padrões plantados) para desenvolver e validar os Insights antes da persistência real.
- **Mapa_de_Calor_da_Dor**: visualização que mostra, sobre a Silhueta, a frequência de dor por região do corpo.

### Requisito 9: Insights (análise dos registros)

**História de usuário:** Como usuário do diário, quero ver gráficos e descobertas a partir dos meus registros — inclusive relações de tempo entre eventos — para entender meus padrões de bem-estar digestivo, sem que isso seja interpretado como diagnóstico.

#### Critérios de Aceitação

1. THE Aplicativo SHALL calcular os Insights no cliente a partir dos registros do período, sem enviar os dados a terceiros (sobre Historico_Mock nesta fase; sobre dados do Supabase em fase futura, trocando apenas a fonte dos dados).
2. THE Aplicativo SHALL exibir tendências temporais das métricas dos registros ao longo de um período.
3. THE Aplicativo SHALL exibir um Mapa_de_Calor_da_Dor por região do corpo, reaproveitando a Silhueta.
4. THE Aplicativo SHALL apresentar cruzamentos factuais entre variáveis, incluindo a relação de proximidade temporal entre eventos por meio de uma Janela_Temporal (ex.: intervalo entre refeições e episódios de dor; água e consistência da evacuação).
5. IF não há dados suficientes para um Insight confiável, THEN THE Aplicativo SHALL exibir um estado de "dados insuficientes" em vez de apresentar um padrão.
6. THE Aplicativo SHALL apresentar todo texto de Insight de forma factual e descritiva (observação dos próprios dados), sem diagnóstico, afirmação de causalidade ou recomendação, consistente com o Requisito 6.
7. THE Aplicativo SHALL permitir interação com os Insights (por exemplo, tocar em um ponto/dia para ver os registros relacionados, ou tocar numa região do corpo para filtrar a dor).
8. THE Aplicativo SHALL disponibilizar um gerador de Historico_Mock com volume suficiente (ex.: 60–90 dias) e padrões plantados, para desenvolvimento e validação dos Insights.

9. THE Aplicativo SHALL oferecer uma opção de suavização (média móvel) das séries de tendência, para evidenciar tendências além do ruído diário.
10. THE Aplicativo SHALL incluir Humor (escala 1–5) e Exercício (minutos por dia) como métricas dos Insights.
11. WHERE há dados suficientes, THE Aplicativo SHALL avaliar correlações com defasagem temporal (lag) entre variáveis e apresentar a defasagem observada de forma factual; caso o mínimo de dados não seja atingido, THE Aplicativo SHALL exibir "dados insuficientes".

### Requisito 10: Nota subjetiva de evacuação

**História de usuário:** Como usuário do diário, quero dar uma nota de como me senti em relação a uma evacuação, para que esse aspecto também entre nas análises sem o app emitir qualquer juízo clínico.

#### Critérios de Aceitação

1. THE Formulário_Bottom_Sheet de Evacuação SHALL permitir ao usuário atribuir uma nota subjetiva de conforto/satisfação como inteiro de 1 a 5, de forma opcional.
2. WHERE a nota subjetiva não é informada, THE Aplicativo SHALL salvar a evacuação sem a nota, sem impedir a confirmação.
3. THE Aplicativo SHALL tratar a nota como percepção do próprio usuário, sem interpretá-la como juízo de normalidade ou diagnóstico (consistente com o Requisito 6).

### Requisito 11: Registro de Gases

**História de usuário:** Como usuário do diário, quero registrar episódios de gases com seus atributos, para acompanhar esse sintoma e permitir cruzamentos (ex.: com alimentação).

#### Critérios de Aceitação

1. THE Aplicativo SHALL incluir o Registro de Gases como um Tipo_de_Registro selecionável no Formulário_Bottom_Sheet.
2. THE Formulário de Gases SHALL permitir registrar, de forma opcional: Intensidade (Pouco/Moderado/Muito), Odor (Sem odor/Leve/Moderado/Forte), Alívio (Aliviou/Continua estufado) e Som (Silencioso/Ruidoso).
3. THE Aplicativo SHALL salvar o Registro de Gases mesmo sem nenhum campo preenchido, sem bloquear a confirmação.
4. THE Aplicativo SHALL apresentar todos os rótulos do Registro de Gases como atributos observáveis, sem juízo clínico (consistente com o Requisito 6).
5. THE Aplicativo SHALL tornar a Intensidade do Gases disponível como métrica (1–3) para os Insights.

> Decisão de design: "Dor/cólica associada" foi removida do Gases para evitar sobreposição com o evento Dor; a relação Gases↔Dor é obtida por proximidade temporal nos Insights.

### Requisito 12: Refeição estruturada com tags (planejado)

**História de usuário:** Como usuário do diário, quero marcar os alimentos da refeição por tags (e adicionar os meus), para que a análise consiga relacionar comida e sintomas, mantendo o registro rápido.

#### Critérios de Aceitação

1. THE Formulário de Refeição SHALL permitir selecionar alimentos por tags predefinidas (por categoria) e adicionar tags personalizadas, reutilizáveis.
2. THE Aplicativo SHALL manter a captura principal rápida (tipo + tags), com qualificadores opcionais — Ritmo ao comer (Rápido/Normal/Devagar) e Como ficou depois (Leve/Satisfeito/Muito cheio) — atrás de uma seção "+ detalhes" (divulgação progressiva), priorizando baixa fricção.
3. THE Aplicativo SHALL tratar o texto livre da refeição como observação (etapa de observação), evitando duplicação.

> Princípio: baixa fricção > riqueza máxima por registro. Poucos campos preenchidos com consistência produzem correlações mais confiáveis do que muitos campos esparsos.

## Glossário (incremento Cruzamentos+ e novos eventos)

- **Contexto_de_Região**: painel factual exibido ao tocar numa região da Silhueta no Mapa_de_Calor_da_Dor, descrevendo os dados observados nos dias com dor naquela região.
- **Alimentos_Frequentes**: as tags de alimento mais recorrentes nas refeições dos dias em que houve dor numa dada região.
- **Cruzamento_Defasado**: cruzamento que avalia a relação entre duas variáveis com defasagem em dias (lag), reportando a defasagem observada de forma factual.
- **Risco_Relativo**: razão factual entre a taxa de um sintoma "com" um fator e "sem" o fator (ex.: "~3x mais frequente"), apresentada como observação dos próprios dados.
- **Registro_de_Medicamento**: Tipo_de_Registro que captura a tomada de um medicamento/suplemento por tags, de forma opcional e de baixa fricção.
- **Registro_de_Ciclo**: marcação opt-in do início da menstruação, a partir da qual o Aplicativo deriva a fase aproximada do ciclo para contextualizar os Insights.
- **Fase_do_Ciclo**: estimativa textual e factual da fase do ciclo (ex.: "menstrual", "folicular", "lútea") derivada da data de início mais recente, sem juízo clínico.

### Requisito 13: Contexto de região da dor (expansão de "Onde a dor aparece")

**História de usuário:** Como usuário do diário, quero que ao tocar numa região do mapa de dor eu veja não só água e sono, mas também os alimentos que mais aparecem, o humor e a consistência típica nos dias com dor ali, para entender melhor o contexto sem que o app afirme causa.

#### Critérios de Aceitação

1. WHEN o usuário toca numa região no Mapa_de_Calor_da_Dor, THE Aplicativo SHALL exibir um Contexto_de_Região com a contagem de registros de dor da região, sua participação no total e a intensidade média.
2. THE Contexto_de_Região SHALL apresentar os Alimentos_Frequentes (tags de alimento mais recorrentes) nas refeições dos dias com dor naquela região, limitados a uma quantidade pequena (ex.: até 3) e ordenados por frequência.
3. THE Contexto_de_Região SHALL apresentar o humor médio (1–5) e a consistência (Bristol) média observados nos dias com dor naquela região, quando houver dados.
4. WHERE não há dados suficientes para um item do Contexto_de_Região, THE Aplicativo SHALL omitir esse item ou indicar "dados insuficientes", sem fabricar um valor.
5. THE Aplicativo SHALL apresentar todo o texto do Contexto_de_Região como observação factual dos próprios dados, sem afirmação de causalidade, diagnóstico ou recomendação (consistente com o Requisito 6).

### Requisito 14: Cruzamentos refinados (Sono→dor, risco relativo, textos)

**História de usuário:** Como usuário do diário, quero cruzamentos mais úteis e fáceis de entender, com uma relação de sono e dor ao longo de dias e indicações de "quantas vezes mais" um sintoma aparece, para perceber padrões reais sem interpretação clínica.

#### Critérios de Aceitação

1. THE Aplicativo SHALL apresentar um Cruzamento_Defasado entre qualidade de sono e dor (sono→dor), reportando a defasagem observada (em dias) de forma factual, usando o motor de correlação defasada.
2. THE Aplicativo SHALL substituir o cruzamento anterior "Hidratação e sono (defasagem)" pelo cruzamento sono→dor, mantendo o mesmo padrão visual de card.
3. WHERE o mínimo de dados de um Cruzamento_Defasado não é atingido, THE Aplicativo SHALL exibir "dados insuficientes" em vez de um padrão.
4. THE Aplicativo SHALL apresentar o cruzamento água↔Bristol com texto factual sobre consistência (ex.: "nos dias com mais água, a consistência registrada foi mais macia"), sem termos de normalidade ou recomendação.
5. WHERE um cruzamento alimento→sintoma possui dados suficientes, THE Aplicativo SHALL exibir o Risco_Relativo de forma factual (ex.: "~Nx mais frequente nos dias/refeições com o alimento").
6. THE Aplicativo SHALL apresentar todos os textos de cruzamento como observação dos próprios dados, sem causalidade, diagnóstico ou recomendação (consistente com o Requisito 6).

### Requisito 15: Registro de Medicamentos

**História de usuário:** Como usuário do diário, quero registrar rapidamente medicamentos ou suplementos por tags, para que eu possa acompanhar seu uso e permitir cruzamentos com sintomas, mantendo o registro rápido.

#### Critérios de Aceitação

1. THE Aplicativo SHALL incluir o Registro_de_Medicamento como um Tipo_de_Registro selecionável no Formulário_Bottom_Sheet.
2. THE Formulário de Medicamento SHALL permitir selecionar medicamentos/suplementos por tags predefinidas (ex.: Antibiótico, Laxante, Probiótico, Antidepressivo, Anti-inflamatório) e adicionar tags personalizadas reutilizáveis, seguindo o padrão das tags da Refeição.
3. THE Aplicativo SHALL salvar o Registro_de_Medicamento mesmo sem detalhes adicionais, sem bloquear a confirmação (baixa fricção).
4. WHEN o usuário confirma o salvamento, THE Aplicativo SHALL adicionar o registro à Linha_do_Tempo no dia atual com o horário local, com ícone e cores próprios, consistente com os demais Tipos_de_Registro.
5. WHERE há dados suficientes, THE Aplicativo SHALL disponibilizar o cruzamento de proximidade temporal entre medicamento e sintomas (ex.: medicamento→dor, medicamento→evacuação) nos Insights.
6. THE Aplicativo SHALL apresentar todos os rótulos do Registro_de_Medicamento como atributos observáveis, sem diagnóstico, prescrição ou recomendação (consistente com o Requisito 6).

### Requisito 16: Registro de Ciclo menstrual (minimalista, opt-in)

**História de usuário:** Como usuária do diário, quero, de forma opcional, marcar o início da menstruação para que o app contextualize meus sintomas pela fase do ciclo, sem precisar preencher muitos campos e sem qualquer juízo clínico.

#### Critérios de Aceitação

1. THE Aplicativo SHALL oferecer o Registro_de_Ciclo como funcionalidade opt-in, desativada por padrão, ativável pela usuária.
2. WHILE o Registro_de_Ciclo está ativo, THE Aplicativo SHALL permitir marcar o início da menstruação como uma data, com fricção mínima (apenas a data como campo obrigatório).
3. THE Aplicativo SHALL derivar a Fase_do_Ciclo aproximada a partir da data de início mais recente, apresentando-a como estimativa factual, sem afirmar normalidade, diagnóstico ou recomendação.
4. THE Formulário de Ciclo SHALL permitir registrar, de forma opcional, atributos como fluxo, cólica e uso de contraceptivo, sem bloquear a confirmação quando ausentes.
5. WHERE o Registro_de_Ciclo está desativado, THE Aplicativo SHALL ocultar a Fase_do_Ciclo e não exigir nenhum dado relacionado.
6. THE Aplicativo SHALL apresentar todo texto relacionado ao ciclo como observação factual, sem diagnóstico, juízo de normalidade ou recomendação (consistente com o Requisito 6).

> Princípio (reafirmado): baixa fricção > riqueza máxima por registro. Ciclo e Medicamentos seguem divulgação progressiva — captura rápida primeiro, qualificadores opcionais depois.


---

## Glossário (incremento Polimentos de UX e PWA)

- **Hero_Colapsado**: estado do Cabeçalho_Hero recolhido ao rolar a timeline — exibe apenas a barra de marca fina com o nome cursivo.
- **Swipe_Horizontal**: gesto de deslize horizontal sobre a área de conteúdo para navegar entre abas, análogo ao Instagram.
- **PWA**: Progressive Web App — instalável na tela inicial do dispositivo, com ícones, manifesto e service worker.
- **Entidade_de_Edição**: qualquer campo editável de um registro existente (horário, dia, título, descrição, observação).

---

## Requisito 17: Polimentos do Diário (collapse, hero, cards, edição, ordem)

**História de usuário:** Como usuário, quero que o hero se recolha ao rolar a timeline, que os cards tenham identidade visual rica e que eu possa editar registros existentes, para que o app seja mais agradável e útil no dia a dia.

### Critérios de Aceitação

1. WHEN o usuário rola a timeline da aba Diário para cima, THE Aplicativo SHALL recolher o Cabeçalho_Hero progressivamente até o estado Hero_Colapsado.
2. WHILE no estado Hero_Colapsado, THE Aplicativo SHALL exibir o nome do produto em fonte cursiva na barra fina do cabeçalho.
3. WHEN o usuário rola a timeline para baixo até o início, THE Aplicativo SHALL expandir o Hero de volta ao estado completo.
4. THE Aplicativo SHALL aplicar a transição de colapso/expansão do Hero com animação suave via GPU (sem serrilhado), usando requestAnimationFrame e histerese para evitar oscilação.
5. THE Menu_de_Ações_do_Registro SHALL incluir a opção "Editar" além da opção "Remover" já existente.
6. WHEN o usuário seleciona "Editar" em um registro, THE Aplicativo SHALL exibir um formulário de edição com os campos horário, dia, título, descrição e observação preenchidos com os dados atuais do registro.
7. WHEN o usuário confirma a edição, THE Aplicativo SHALL atualizar o registro na Linha_do_Tempo mantendo o mesmo id e tipo, preservando campos não editados.
8. THE Aplicativo SHALL exibir os registros da Linha_do_Tempo em ordem cronológica dentro de cada agrupamento de dia.
9. THE Menu_de_Ações_do_Registro SHALL fechar automaticamente quando o usuário toca fora dele em qualquer área da tela.
10. WHERE um card de registro não tem altura suficiente para exibir o menu de ações completamente, THE Aplicativo SHALL posicionar o menu acima do botão para evitar corte.
11. THE Card_Resumo_do_Dia SHALL ser expansível/recolhível ao toque do usuário.
12. THE Aplicativo SHALL aplicar um mesh gradient animado sutilmente no fundo do Card_Resumo_do_Dia para diferenciá-lo visualmente dos cards de registro.

---

## Requisito 18: Navegação por swipe e PWA instalável

**História de usuário:** Como usuário mobile, quero navegar entre abas deslizando o dedo horizontalmente e instalar o app na tela inicial, para que a experiência seja fluída e nativa.

### Critérios de Aceitação

1. WHEN o usuário executa um Swipe_Horizontal com deslocamento horizontal ≥ 60px, relação |dx| > 1,5×|dy| e duração < 700ms sobre a área de conteúdo, THE Aplicativo SHALL navegar para a aba adjacente na direção do swipe.
2. THE Aplicativo SHALL ignorar swipes em elementos marcados com `data-noswipe` (ex.: sliders, players de vídeo, scrolls internos).
3. THE Aplicativo SHALL ignorar swipes que ocorrem enquanto um overlay ou modal está aberto.
4. THE Aplicativo SHALL publicar um Web App Manifest com nome, ícones (192×192 e 512×512 px) e cor de tema da marca.
5. THE Aplicativo SHALL registrar um service worker com estratégia network-first para permitir uso offline básico e instalação.
6. WHERE o navegador suporta instalação de PWA, THE Aplicativo SHALL permitir que o usuário adicione o app à tela inicial.

---

## Glossário (incremento Aba Aulas)

- **Aula**: unidade de vídeo-aula disponível para compra individual ou em combo.
- **Catálogo_de_Aulas**: tela da aba Aulas que lista todas as Aulas disponíveis em cards estilo Netflix.
- **Card_de_Aula**: card de proporção 9/16 que representa uma Aula no catálogo.
- **Tela_de_Detalhe**: sub-view que exibe informações completas de uma Aula selecionada.
- **Player_de_Video**: componente que reproduz vídeo de um provedor (Panda Video, YouTube, Bunny Stream ou arquivo mp4 direto).
- **Entitlement**: registro que confirma que um usuário tem acesso a uma Aula específica (compra, combo ou recompensa).
- **Combo**: pacote que reúne múltiplas Aulas com desconto em relação à soma dos preços individuais.
- **Provedor_de_Video**: serviço externo que hospeda o vídeo (Panda Video, YouTube, Bunny Stream, Wistia ou mp4 direto).

---

## Requisito 19: Catálogo de vídeo-aulas (Aba Aulas)

**História de usuário:** Como usuário, quero explorar e comprar vídeo-aulas no app, visualizando um catálogo atrativo e acessando o conteúdo desbloqueado diretamente pelo player, para que eu consuma o conteúdo sem sair do app.

### Critérios de Aceitação

1. THE Aplicativo SHALL substituir a aba "Hábitos" por uma aba "Aulas" no Menu_Inferior, mantendo swipe e navegação por toque.
2. THE Aplicativo SHALL exibir o Catálogo_de_Aulas na aba Aulas com os cursos disponíveis em Cards_de_Aula de proporção 9/16, um por linha.
3. EACH Card_de_Aula SHALL exibir o título, subtítulo, preço e status de acesso (Liberado / Bloqueado).
4. WHEN o usuário toca em um Card_de_Aula, THE Aplicativo SHALL exibir a Tela_de_Detalhe da aula selecionada com prévia, aprendizados, meta-informações e barra de compra/acesso.
5. WHERE a Aula está bloqueada, THE Aplicativo SHALL exibir o preço e um botão "Adquirir agora" na Tela_de_Detalhe.
6. WHERE a Aula está liberada e possui link de vídeo, THE Aplicativo SHALL exibir o Player_de_Video na área de prévia da Tela_de_Detalhe ao usuário acionar "Assistir".
7. THE Player_de_Video SHALL detectar automaticamente o tipo de link (iframe embed ou arquivo mp4 direto) e usar o player adequado: `<video>` nativo para mp4/webm, `<iframe>` para qualquer embed (Panda, YouTube, Bunny, Wistia etc.).
8. THE Aplicativo SHALL exibir um banner de Combo no Catálogo_de_Aulas mostrando o preço original, o preço promocional e o desconto obtido ao adquirir o pacote.
9. THE Aplicativo SHALL apresentar todo texto descritivo das Aulas como experiência pessoal/rotina do autor, sem promessa de cura, efeito terapêutico ou alegação clínica (consistente com o Requisito 6).
10. THE Aplicativo SHALL indicar claramente quando a compra é simulada (Fase 1 sem pagamento real), com aviso visível ao usuário.

---

## Requisito 20: Player de vídeo agnóstico de provedor

**História de usuário:** Como administrador do conteúdo, quero trocar o provedor de vídeo de um curso alterando apenas a URL no cadastro, sem precisar modificar a interface do app, para que eu tenha flexibilidade de migrar entre Panda, YouTube, Bunny ou mp4 direto.

### Critérios de Aceitação

1. THE Aplicativo SHALL determinar o tipo de player exclusivamente a partir da URL do vídeo, sem campo de tipo explícito.
2. IF a URL terminar em extensão de vídeo (`.mp4`, `.webm`, `.ogv`, `.ogg`, `.mov`, `.m4v`) ou seguir o padrão de entrega de arquivo com `filename=*.mp4` (ex.: Wistia deliveries), THEN THE Aplicativo SHALL usar o player nativo `<video>` com controles.
3. IF a URL for qualquer outro formato (domínio de embed do Panda, YouTube, Bunny, Wistia player etc.), THEN THE Aplicativo SHALL usar `<iframe>` com `allow="autoplay; fullscreen"`.
4. THE Aplicativo SHALL aceitar links de pelo menos os provedores: Panda Video (`player-vz-*.tv.pandavideo.com.br`), YouTube (`youtube.com/embed`), Bunny Stream (`iframe.mediadelivery.net/embed`), Wistia player (`fast.wistia.net/embed/iframe`) e arquivos mp4 diretos.
5. WHEN o link de vídeo de uma Aula é `null`, THE Aplicativo SHALL exibir um estado "Vídeo em breve" no lugar do player.

---

## Roadmap futuro documentado (fora do escopo atual — referência para fases seguintes)

> Esta seção documenta as decisões e contornos das próximas fases acordadas entre produto e desenvolvimento. Não gera tarefas implementáveis até que cada fase seja detalhada em seu próprio incremento.

### Fase 2 — Supabase + autenticação

- Introduzir Supabase como backend: tabelas `cursos`, `aulas`, `entitlements`, `users`.
- Implementar login/cadastro com e-mail e confirmação.
- Catálogo da aba Aulas passa a vir do banco de dados (substituindo as constantes `AULAS`/`AULAS_COMBO` locais) sem alterar a lógica de UI.
- URLs de vídeo com token assinado (Bunny/Panda) geradas pelo backend no momento do acesso (conteúdo pago não fica exposto).

### Fase 3 — Pagamento + entitlement

- Integrar gateway de pagamento (Mercado Pago recomendado para Brasil/Pix, ou Stripe).
- Ao confirmar pagamento, registrar o entitlement na tabela `entitlements` (usuário × curso).
- A verificação de acesso no app lê a tabela de entitlements (não o estado local de simulação).
- Conteúdo pago exige provedor com URL assinada (Bunny Stream ou Panda Video); YouTube e Wistia público ficam apenas para prévias gratuitas.

### Fase 4 — Painel admin

- Interface web separada (ou seção protegida no app) para o administrador gerenciar: capas, links de vídeo, descrições, preços, idioma dos cursos.
- Os dados gerenciados ficam no Supabase; o app os consome via API.

### Fase 5 — Sistema de Recompensa por Indicação (Referral)

- Cada usuário recebe um código/link de indicação único.
- Mecânica de pontos: cada indicação "válida" gera 1 ponto; a UI exibe progresso como meta ("convide N amigos e libere o curso de Kefir").
- Critério de indicação válida (a definir, mínimo recomendado): cadastro + e-mail confirmado + ao menos 1 registro no diário.
- Recompensa inicial: desbloqueio do curso "Como produzir Kefir sem muda" ao atingir a meta.
- Recompensas em conteúdo/desconto apenas — nunca transferência de dinheiro entre usuários.
- Anti-fraude: bloquear autoindicação, 1 conta por e-mail, teto de indicações válidas por dia.
- Implementação depende das Fases 2 e 3 (entitlement e usuários autenticados).

### Fase 6 — Relatórios gerados por IA

- Aba "Relatórios" (futura) com relatório textual gerado por IA a partir dos dados do diário.
- IA redige o relatório no servidor; o app exibe e permite exportação em PDF.
- Posicionamento: "perguntas para levar ao médico", nunca diagnóstico.
