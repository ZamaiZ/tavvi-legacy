# Especificação — reformulação da página de Chamados

**Data:** 3 de outubro de 2026  
**Estado:** proposta para revisão  
**Produto:** painel Web do restaurante (`apps/web`)  
**Superfície:** `/restaurantes/[id]/chamados`

## 1. Objetivo

Tornar a página de Chamados mais clara e refinada para a operação diária do restaurante, preservando a identidade visual do painel Tavvi. Uma pessoa da equipe deve identificar rapidamente qual mesa aguarda atendimento, há quanto tempo, e concluir o chamado sem perder o contexto da fila.

A reformulação cobre os estados com chamados pendentes, fila pendente vazia, histórico com chamados concluídos, histórico vazio, atualização em andamento, falha de atualização e conclusão de um chamado. Inclui o comportamento em desktop, tablet e celular. A interface deve continuar útil quando existe apenas um chamado, sem preencher a página com métricas ou elementos decorativos.

## 2. Diagnóstico da versão atual

- A área principal tem altura mínima proporcional à janela (`min(62dvh, 720px)`). Com um único registro, sobra uma superfície branca grande e pouco estruturada.
- O detalhe selecionado fica centralizado nessa superfície e oferece pouca hierarquia entre mesa, estado, horário e ação.
- Quando a aba ativa está vazia, aparecem dois estados vazios: um na fila e outro no detalhe.
- A lista usa textos auxiliares de 10–11 px. Horário, estado e tempo de espera ficam difíceis de ler rapidamente.
- Na lista de concluídos, “Atendido · há…” usa `createdAt`. O texto pode informar incorretamente quando o atendimento foi concluído.
- As contagens das abas usam o número de itens carregados. Como a lista é paginada em blocos de 100, esse número pode ser menor que o total existente.
- No celular, fila e detalhe ficam empilhados, com a lista limitada a `34dvh`; isso reduz a área de triagem.

O painel já fornece a paleta, os controles e o cabeçalho adequados. O trabalho principal está na composição e na clareza dos estados.

## 3. Direção visual

**Caráter:** serviço de padrão premium, discreto e operacional. A interface deve transmitir cuidado por meio de espaçamento consistente, alinhamento, contraste e organização da informação.

Usar os tokens existentes do território privado, entre eles `--tv-bg`, `--tv-surface`, `--tv-surface-2`, `--tv-line`, `--tv-text`, `--tv-text-2`, `--tv-gold`, `--tv-gold-text`, `--tv-gold-soft`, `--tv-ok`, `--tv-ok-soft` e `--tv-fresh`, com seus equivalentes de modo escuro. Preservar a fonte `--tv-font`, o `PageHeader`, a linguagem de ícones lineares e os raios já empregados no painel. A cor dourada identifica pendência e a ação principal; o verde identifica conclusão. O texto sobre botão dourado usa `--tv-hero-ink`, já preparado para essa superfície. Som e metadados permanecem neutros.

Não introduzir fotos, ilustrações grandes, fontes serifadas, gradientes novos, cartões de métricas sem dados ou animação contínua. O aspecto premium deve continuar coerente com Cardápio, Plaquinhas e as demais telas do painel.

### Escala sugerida

| Elemento | Tratamento |
| --- | --- |
| Título da página | `PageHeader` existente, sem alterar a escala global |
| Título da mesa no detalhe | 28–32 px, peso 600–650 |
| Mesa na fila | 14–15 px, peso 600 |
| Estado e tempo na fila | 12–13 px, contraste de `--tv-text-2` ou superior |
| Metadados secundários | 12 px; evitar `--tv-text-3` em informação necessária à decisão |
| Áreas clicáveis | mínimo de 44 px de altura no celular |
| Superfícies | borda sutil, raio próximo dos 10–14 px existentes, sombra leve quando necessária |

## 4. Estrutura da página

### Cabeçalho

Manter o eyebrow “Atendimento”, o título “Chamados” e uma descrição curta: “Acompanhe e conclua as solicitações feitas pelo cardápio.” O controle de som fica alinhado à direita no desktop e abaixo do título no celular. O texto deve indicar o escopo local: “Som neste aparelho: ativado/desativado”. O controle continua exigindo gesto explícito para ativar áudio e preserva a preferência local atual.

Não mostrar “Ao vivo”, ponto de conexão ou outro selo permanente enquanto não existir um estado de conexão confiável para sustentá-lo. Durante uma sincronização efetiva, exibir apenas “Atualizando…” de forma discreta. Uma falha de atualização não pode ser comunicada como fila vazia.

### Abas

As abas “Pendentes” e “Concluídos” permanecem como navegação principal. Torná-las visualmente mais presentes, com altura de toque de pelo menos 44 px e estado selecionado inequívoco. O número da aba representa os **itens carregados**: se houver outra página, mostrar `100+`, `200+` etc.; após carregar a última página, mostrar o número exato. Não apresentar esses valores como total geral sem uma contagem confiável do servidor.

### Área principal no desktop

Com itens na aba ativa, manter a leitura em duas colunas: fila à esquerda e detalhe à direita. A fila deve ocupar cerca de 42–46% da largura; o detalhe, o restante. A altura da superfície deve seguir o conteúdo, com mínimo moderado próximo de 360 px em vez do mínimo atual atrelado a `62dvh`. Em filas longas, a lista rola dentro da área disponível e mantém o cabeçalho visível. A página conserva a largura máxima de 1240 px e os espaçamentos do painel.

O detalhe se alinha ao topo. Deve parecer um registro de atendimento bem composto, com informação e ação agrupadas, deixando o restante da superfície respirar. Não posicionar um pequeno bloco de texto no centro de uma coluna alta.

### Área principal no celular

Mostrar a fila como tela principal. Tocar num chamado abre os detalhes em uma folha ou tela de detalhe alinhada aos padrões móveis já usados pelo painel. A folha exibe estado, mesa, horários e ação; ao fechar, preserva a posição de rolagem da fila. Na aba de pendentes, “Marcar atendido” permanece visível na parte inferior da folha sem cobrir texto nem a área segura do aparelho.

Trocar de aba fecha o detalhe aberto. Um chamado novo recebido enquanto a pessoa lê um detalhe não deve abrir outra folha automaticamente. O `MobileNavBar` e o retorno para Serviço permanecem.

## 5. Fila e histórico

### Linha de chamado pendente

Cada linha exibe ícone de sino em superfície `--tv-gold-soft`, “Mesa N” como informação principal, “Aguardando · há X” baseado em `createdAt` e o horário absoluto como informação secundária. O número da mesa e o tempo de espera devem ser entendidos sem depender apenas da cor. A seleção usa fundo `--tv-surface-2` e borda perceptível, sem sombras pesadas. O alvo de toque ocupa toda a linha.

Chamados pendentes permanecem do mais antigo para o mais recente, para priorizar quem espera há mais tempo. A chegada de um ID novo pode receber realce suave e temporário com `--tv-fresh`; o realce cessa após aproximadamente 2 segundos, não pisca e é eliminado quando a pessoa prefere movimento reduzido. Nenhuma chamada recém-chegada toma o foco ou substitui automaticamente a seleção atual.

### Linha de chamado concluído

Cada linha exibe ícone de confirmação em superfície `--tv-ok-soft`, “Mesa N”, “Atendido · há X” calculado a partir de `resolvedAt` e o horário absoluto da conclusão. Se `resolvedAt` estiver ausente, mostrar apenas “Atendido” e omitir o horário da conclusão; não usar `createdAt` como se fosse o horário do atendimento.

O histórico deve ser ordenado pelo atendimento mais recente (`resolvedAt` descendente). A paginação do histórico precisa usar a mesma ordem; não basta alterar apenas a ordenação visual dos itens já carregados. O momento em que o chamado foi criado continua disponível no detalhe.

### Atualização do texto relativo

Textos como “há 5 min” devem avançar com o passar do tempo enquanto a página está aberta, sem exigir que chegue um novo chamado. O horário absoluto continua acessível no próprio detalhe e no atributo `title`/`datetime` quando aplicável. A atualização periódica do texto não deve reordenar a fila pendente.

## 6. Detalhe selecionado

### Pendente

No topo: um marcador discreto “PENDENTE”, seguido de “Mesa N” em destaque. Abaixo, mostrar uma linha temporal curta:

1. “Chamado recebido” — data e hora de `createdAt`.
2. “Aguardando atendimento” — tempo decorrido desde `createdAt`.

O único comando principal é “Marcar atendido”, com fundo `--tv-gold`, rótulo legível e tamanho mínimo de 44 px. Durante a ação, exibir “Salvando…” e impedir envio duplicado. Não criar comandos de prioridade, atribuição de atendente ou notas, pois esses dados e fluxos não existem nesta página.

### Concluído

Exibir “ATENDIDO”, “Mesa N” e dois eventos: “Chamado recebido” (`createdAt`) e “Atendimento concluído” (`resolvedAt`, quando presente). Usar confirmação verde suave. Não exibir ação principal para um chamado já concluído. Se o horário de conclusão estiver ausente, informar apenas que o chamado consta como atendido.

### Seleção e mudança de estado

No desktop, selecionar uma linha atualiza apenas o detalhe; mantém a aba e a rolagem da lista. Ao trocar de aba, selecionar o primeiro chamado da nova lista no desktop. No celular, trocar de aba apresenta a nova lista sem abrir um detalhe automaticamente. Nunca mostrar no painel de detalhe um chamado cujo estado difere da aba ativa.

Um link direto com `?c=<id>` abre a aba correspondente e mostra aquele chamado. Se o chamado estiver fora da página já carregada, exibir o detalhe com a indicação discreta “Aberto por link”, sem atribuir seleção visual a outra linha. No celular, esse link abre a folha do chamado. Quando uma página posterior trouxer o item, a linha correspondente passa a refletir a seleção.

Ao concluir um chamado, manter a aba “Pendentes” ativa para a equipe continuar a triagem. Remover o chamado da fila, selecionar o próximo mais antigo se existir e mostrar confirmação breve: “Mesa N marcada como atendida”, com caminho para o histórico. Se era o último, mostrar o estado vazio “Tudo em dia”. No celular, fechar a folha após a confirmação. Limpar ou atualizar o parâmetro `c` quando ele apontar para o chamado concluído, evitando que um foco antigo reapareça na fila pendente.

Se a conclusão falhar, conservar o chamado como pendente, preservar a seleção e exibir o erro junto à ação ou em toast, sem afirmar que o atendimento ocorreu.

## 7. Estados vazios e exceções

| Situação | Apresentação e comportamento |
| --- | --- |
| Nenhum pendente | Um único estado ocupando a área principal: “Tudo em dia” e “Nenhuma mesa aguardando atendimento.” Se houver concluídos carregados, oferecer “Ver concluídos”. Não renderizar um segundo estado vazio de detalhe. |
| Histórico vazio | Um único estado: “Nenhum atendimento concluído por enquanto.” Explicar que chamados marcados como atendidos aparecerão ali. |
| Há itens, mas nada selecionado | No desktop, uma instrução discreta no detalhe: “Selecione uma mesa para ver o chamado.” No celular, permanece apenas a fila. |
| Carregamento inicial | Esqueleto com a geometria final do cabeçalho, fila e detalhe; evitar salto grande na montagem. |
| Atualização em andamento | Manter dados visíveis e mostrar “Atualizando…” junto ao cabeçalho da fila. |
| Falha de atualização | Manter o último retrato recebido e mostrar aviso discreto: “Não foi possível atualizar a fila. Tente novamente.” com ação de retry. Se o último retrato estiver vazio, não comunicar “Tudo em dia” como estado confirmado. |
| Mais páginas | “Carregar mais” no fim da lista ativa, com estado de carregamento e sem perder a seleção ou a posição de rolagem. |

## 8. Acessibilidade e interação

- Manter um `h1` na página e um título de detalhe que anuncie a mesa selecionada.
- As abas devem ter nomes, contagens e seleção acessíveis. Se forem implementadas como padrão de tabs, completar a relação entre `tab`, `tabpanel`, foco e navegação de teclado; caso contrário, usar botões de filtro com `aria-pressed` coerente.
- A linha selecionada deve ter estado perceptível por borda/fundo, além do rótulo para tecnologia assistiva. Foco visível usa o anel dourado do painel.
- A folha móvel deve receber foco ao abrir, devolver o foco à linha de origem ao fechar e permitir fechamento pelo controle do painel e pela tecla Escape.
- Mensagens de conclusão, erro e atualização devem ser anunciadas sem substituir todo o detalhe por uma região `aria-live` extensa.
- Não usar animação contínua de sino, pulso ou contagem. Respeitar `prefers-reduced-motion`.
- Preservar contraste de texto principal e estados em temas claro e escuro; informações necessárias não devem depender só de `--tv-text-3` nem da cor do ícone.

## 9. Dados e limites de escopo

A especificação usa os dados já disponíveis em `ServiceCallDTO`: mesa, estado, criação e conclusão. `resolvedBy` é um ID e não fornece nome legível; não exibir “atendido por” sem consulta apropriada e decisão de produto. Não introduzir média de espera, chamadas de hoje, SLA, prioridade por cor, gráficos ou indicadores de conexão sem fonte confiável.

A alteração funcional necessária para a semântica do histórico é ordenar e paginar concluídos por `resolvedAt` descendente, com ID descendente em empates. Para pendentes, a ordem e o cursor continuam baseados em `createdAt` ascendente e ID ascendente. O cursor do histórico passa a representar `(resolvedAt, id)`; consulta e contrato do cursor devem mudar juntos. O esquema atual garante `resolved_at` para registros com `status = 'resolved'`; a apresentação ainda deve tratar dados inesperadamente incompletos de forma defensiva. Para manter essa ordenação eficiente quando o histórico crescer, a futura implementação inclui índice adequado em `(restaurant_id, status, resolved_at desc, id desc)` por migração própria em ambientes existentes. A baseline de instalação limpa não deve ser aplicada sobre um banco em uso. A contagem visual paginada segue a regra de `N+` até a última página; não é necessária nova consulta de total para esta versão.

As ações existentes de listar, receber atualizações e concluir chamados são preservadas. O som continua sendo preferência do navegador atual. Esta spec não altera o cardápio público, o Web Push nem o esquema do banco.

## 10. Critérios de revisão da implementação

1. Com um único chamado, a mesa, o tempo de espera e a ação são encontrados imediatamente, sem uma grande superfície vazia dominando a página.
2. Com a fila pendente vazia, há somente um estado vazio; nenhum painel secundário repete a ausência de seleção.
3. A lista de concluídos usa `resolvedAt` para o texto e o horário de atendimento, e apresenta primeiro os atendimentos mais recentes mesmo com paginação.
4. A conclusão de um chamado mantém a pessoa na fila pendente, avança para o próximo chamado e preserva o item quando a ação falha.
5. Ao abrir `?c=<id>`, a aba e o detalhe correspondem ao chamado; ao concluir esse item, o foco da URL não reabre um detalhe obsoleto.
6. No celular, a fila tem prioridade; o detalhe abre sem comprimir a lista e a ação fica acessível acima da área segura.
7. Som, foco, estados de carregamento, falha de atualização e modo escuro usam padrões e tokens existentes do painel.
8. As contagens não se apresentam como totais exatos enquanto houver páginas não carregadas.

## 11. Pontos do projeto envolvidos na futura implementação

- Composição, seleção, estados, conclusão e som: `apps/web/src/features/calls/components/calls-screen.tsx`.
- Linhas e conteúdo da fila: `apps/web/src/features/calls/components/call-list.tsx`.
- Layout responsivo e acabamento: `apps/web/src/features/calls/styles/calls.css`.
- Ordenação e cursor do histórico: `apps/web/src/server/dal/service-calls.ts` e contrato de paginação em `apps/web/src/domain/service-call.ts`.
- Índice do histórico: migração SQL apropriada em `supabase/migrations/`, respeitando a separação entre ambientes existentes e baseline de instalação limpa.
- Entrada por link direto e dados iniciais: `apps/web/src/app/admin/workspace/restaurants/[id]/chamados/page.tsx`.
- Tokens e tipografia do painel: `apps/web/src/app/base.css`.

Esta é uma especificação de produto e interface. A revisão visual posterior deve comparar, no mínimo, os estados com um pendente, fila vazia e concluídos em desktop e celular. Conforme as instruções do repositório, a validação técnica desta etapa é por inspeção estática, sem comandos de teste, lint, build, typecheck ou Git.
