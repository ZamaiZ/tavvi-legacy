# Redesign do Financeiro — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Cada tarefa termina com uma revisão estática do resultado; não criar ou executar testes.

**Goal:** Reorganizar o Financeiro em Visão geral, Operação e Histórico responsivos, sem alterar regras ou contratos financeiros existentes.

**Architecture:** `FinanceScreen` passa a controlar a navegação por áreas e subtabs, reutilizando os componentes de leitura, operação e auditoria já existentes. O status do caixa permanece fora dos painéis; o CSS do Financeiro define a nova hierarquia dentro do shell atual.

**Tech Stack:** Next.js 16, React 19, TypeScript, `@base-ui/react/tabs` por `@/components/ui/tabs`, `react-icons/lu`, CSS atual do workspace.

**Spec:** `docs/superpowers/specs/2026-10-28-financeiro-redesign-design.md`

## Global Constraints

- Preservar acesso `admin` e `cashier` e o shell do workspace existente.
- Não alterar banco, schema, Server Actions, DAL, contratos em `domain/finance.ts`, regras de cálculo ou fluxo de Caixa.
- Usar `totals.expectedCashCents` como valor oficial; ele representa o saldo total esperado da gaveta, não o intervalo analítico selecionado.
- Preservar fuso horário do restaurante, filtros independentes, atualizações em tempo real, idempotência e repetição segura de mutations incertas.
- Reutilizar o padrão das abas de `cash-account-tabs.tsx` e os componentes financeiros existentes; não adicionar dependências.
- Antes de alterar componentes Next, ler `apps/web/node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md` e `apps/web/node_modules/next/dist/docs/01-app/02-guides/server-and-client-boundary.md`, conforme `apps/web/AGENTS.md`.
- As instruções do repositório proíbem testes, build, lint e typecheck. Não criar nem executar esses comandos; revisar estaticamente e informar limites de validação.

## Review Focus

Os cinco pontos abaixo serão conferidos por inspeção estática conforme a regra do repositório; não implicam criar ou executar testes.

1. **Sem caixa ativo:** a primeira área selecionada é Operação, a abertura permanece acessível e as comandas em andamento antes da abertura não são confundidas com recebíveis transportados.
2. **Intervalo analítico:** o filtro afeta métricas e meios de pagamento do intervalo, mas `expectedCashCents` continua sendo o saldo completo do período aberto.
3. **Papéis e fechamento:** fechamento normal continua disponível de acordo com as regras atuais; somente admin recebe os controles para exceção, justificativa e confirmação.
4. **Resposta incerta de mutation:** mudanças de layout não descartam o bloqueio, o identificador de solicitação ou a opção de repetir a mesma operação.
5. **Histórico/auditoria:** expansão, paginação, timezone, motivos, movimentos, contas transportadas e relatório sem caixa continuam acessíveis e sem reconstrução de gaveta.

---

## Arquivos e responsabilidades

- `apps/web/src/features/finance/components/finance-screen.tsx` — composição da página, estado das três áreas e subtabs, status persistente, integração com os componentes e transições após mutations.
- `apps/web/src/features/finance/components/cash-day-overview.tsx` — status persistente do período e resumo ativo com filtro, indicadores e meios de pagamento. Exportar um componente de status separado para que ele fique fora das abas.
- `apps/web/src/features/finance/components/cash-day-movements.tsx` — formulário e lista já existentes; recebe o valor oficial de dinheiro esperado para compor o cartão lateral da operação.
- `apps/web/src/features/finance/styles/finance.css` — abas, resumo, arranjos de operação, estados, breakpoints e ajustes de loading sob `.workspace-territory`.
- `apps/web/src/app/admin/workspace/restaurants/[id]/financeiro/loading.tsx` — skeleton com cabeçalho, status, abas e painel, substituindo o skeleton de cinco métricas sempre visíveis.

`cash-day-opening.tsx`, `cash-day-closing.tsx`, `pending-receivables.tsx`, `cash-day-history.tsx`, `legacy-finance-report.tsx`, `finance-date-range-filter.tsx`, a rota `page.tsx`, as Server Actions e o DAL devem ser reutilizados sem mudança de regra. Se uma alteração nesses contratos parecer necessária, interromper e revisar o escopo com a spec antes de prosseguir.

## Tarefa 1: Navegação principal e status persistente

**Arquivos:**

- Modificar `apps/web/src/features/finance/components/finance-screen.tsx`
- Modificar `apps/web/src/features/finance/components/cash-day-overview.tsx`
- Modificar `apps/web/src/features/finance/styles/finance.css`

**Interfaces:**

- Consumir `FinanceDashboardDTO` já recebido por `FinanceScreen`.
- Declarar no escopo da tela os estados locais `FinanceArea = 'overview' | 'operation' | 'history'`, `OperationArea = 'movements' | 'receivables' | 'closing'` e `HistoryArea = 'periods' | 'legacy'`.
- Exportar em `cash-day-overview.tsx` um `CashDayStatus({ dashboard }: { dashboard: FinanceDashboardDTO })` independente do conteúdo de métricas.
- Usar `Tabs`, `TabsList`, `TabsTrigger` e `TabsContent` de `@/components/ui/tabs`, com painéis mantidos montados onde o estado interno precisa persistir.

- [ ] **Passo 1:** Ler os dois guias Next 16 indicados em Global Constraints antes de tocar componentes client.
- [ ] **Passo 2:** Criar os estados controlados da área principal, da operação e do histórico. Inicializar a área principal em Visão geral quando `initialDashboard.activeDay` existir e em Operação quando não existir.
- [ ] **Passo 3:** Extrair o status aberto/fechado de `CashDayOverview` para `CashDayStatus` e posicioná-lo depois do cabeçalho e antes das abas.
- [ ] **Passo 4:** Compor as abas principais com ícones `react-icons/lu`; renderizar um único painel visual por vez e manter os painéis necessários montados.
- [ ] **Passo 5:** Remover o banner “Escopo atual” do fluxo principal, mantendo descrição concisa no cabeçalho, indicador realtime, atualização manual, erros e estado de carregamento.
- [ ] **Passo 6 — revisão estática:** conferir que o status está fora dos painéis, os três valores de aba são consistentes, as áreas iniciais dependem de `activeDay` e não há navegação global duplicada.

## Tarefa 2: Visão geral aberta e fechada

**Arquivos:**

- Modificar `apps/web/src/features/finance/components/finance-screen.tsx`
- Modificar `apps/web/src/features/finance/components/cash-day-overview.tsx`
- Modificar `apps/web/src/features/finance/styles/finance.css`

**Interfaces:**

- `CashDayOverview` consome `dashboard`, `loading` e `onFilter(from, to)` como hoje; seu conteúdo é montado dentro do painel Visão geral.
- A ação “Ir para abertura do caixa” altera somente `FinanceArea` para `'operation'`.

- [ ] **Passo 1:** Para `activeDay === null`, renderizar estado vazio com chamada para abrir o caixa; omitir métricas zeradas.
- [ ] **Passo 2:** Quando houver um período encerrado com `countedCashCents` não nulo em `dashboard.history`, mostrar discretamente a data e o valor contado; omitir essa linha sem dados reais.
- [ ] **Passo 3:** Para período ativo, manter `FinanceDateRangeFilter` e os quatro indicadores complementares; usar `totals.expectedCashCents` como valor de destaque.
- [ ] **Passo 4:** Rotular o dinheiro esperado como saldo da gaveta no período inteiro e manter o aviso sobre vendas/gorjetas brutas e estornos separados. Não derivar breakdown no browser.
- [ ] **Passo 5:** Preservar meios de pagamento, estado vazio, erro, timezone e atualização por `onFilter`; os dados do relatório legado não entram neste painel.
- [ ] **Passo 6 — revisão estática:** seguir os props do filtro até `reload(from, to)` e confirmar que dinheiro esperado não é recalculado no componente nem declarado como parte do intervalo filtrado.

## Tarefa 3: Operação e subtabs por responsabilidade

**Arquivos:**

- Modificar `apps/web/src/features/finance/components/finance-screen.tsx`
- Modificar `apps/web/src/features/finance/components/cash-day-movements.tsx`
- Modificar `apps/web/src/features/finance/styles/finance.css`

**Interfaces:**

- `CashDayMovements` recebe uma nova prop obrigatória `expectedCashCents: number`, fornecida como `dashboard.totals.expectedCashCents`.
- Reutilizar `CashDayOpening({ restaurantId, onUpdated })`, `PendingReceivables({ restaurantId, accounts, timezone })` e `CashDayClosing({ restaurantId, dashboard, role, onUpdated })` sem alterar seus contratos.
- Subtabs controladas: `movements`, `receivables`, `closing`.

- [ ] **Passo 1:** Em Operação sem caixa, renderizar `CashDayOpening` e a lista de `accountsBlockingClose`; manter o alerta e os valores fornecidos pelo dashboard.
- [ ] **Passo 2:** Em Operação com caixa, criar subtabs Movimentações, Recebimentos pendentes e Fechamento. Selecionar Movimentações como padrão e adicionar badge somente quando houver pendências.
- [ ] **Passo 3:** Mover `PendingReceivables` para a subtab correspondente, mantendo o destino de recebimento no Caixa e o empty state atual.
- [ ] **Passo 4:** Dar ao painel Movimentações um layout de formulário/lista e cartão lateral; adaptar `CashDayMovements` para exibir a prop `expectedCashCents` sem calcular seus próprios valores.
- [ ] **Passo 5:** Montar `CashDayClosing` somente no painel Fechamento mantendo-o montado ao alternar; preservar motivo de diferença, bloqueadores, papel, justificativa e confirmação de exceção do próprio componente.
- [ ] **Passo 6:** Após abertura bem-sucedida, permanecer em Operação com Movimentações selecionada; após fechamento bem-sucedido, permanecer em Operação e mostrar abertura. Reiniciar a subtab operacional em Movimentações quando o período ativo mudar de identidade ou for fechado. Refresh/realtime atualizam dados sem alterar a área escolhida.
- [ ] **Passo 7 — revisão estática:** verificar que cada subtab monta o componente existente correto, os badges usam arrays reais e o novo cartão recebe apenas o saldo oficial.

## Tarefa 4: Histórico separado em períodos e receitas sem caixa

**Arquivos:**

- Modificar `apps/web/src/features/finance/components/finance-screen.tsx`
- Modificar `apps/web/src/features/finance/styles/finance.css`

**Interfaces:**

- Reutilizar `CashDayHistory` com os props atuais e `LegacyFinanceReport` com `initialReport` e `refreshVersion` atuais.
- Subtabs controladas: `periods` e `legacy`.

- [ ] **Passo 1:** Criar subtabs Períodos de caixa e Receitas sem caixa no painel Histórico.
- [ ] **Passo 2:** Posicionar `CashDayHistory` no primeiro painel, mantendo estado de período expandido, carregamento de detalhe, paginação e erros.
- [ ] **Passo 3:** Posicionar `LegacyFinanceReport` no segundo painel, mantendo seu filtro de datas, indicadores, métodos, nota de escopo e refresh independente.
- [ ] **Passo 4:** Não criar o botão “Filtrar datas” do protótipo para a lista de períodos; não misturar registros legados com valores de caixa físico.
- [ ] **Passo 5 — revisão estática:** conferir fluxo de `refreshVersion`, props de histórico, ação de paginação e presença dos dois filtros independentes onde já existem.

## Tarefa 5: Acabamento responsivo, acessibilidade e loading

**Arquivos:**

- Modificar `apps/web/src/features/finance/styles/finance.css`
- Modificar `apps/web/src/app/admin/workspace/restaurants/[id]/financeiro/loading.tsx`
- Ajustar `apps/web/src/features/finance/components/finance-screen.tsx` somente se necessário para atributos ARIA ou estados de feedback.

- [ ] **Passo 1:** Aplicar tokens existentes do workspace e a hierarquia do protótipo: status, abas, heading do painel, ação principal e conteúdo secundário.
- [ ] **Passo 2:** Em desktop, manter abas principais em linha e permitir cartões em duas colunas onde há espaço; preservar largura máxima do workspace.
- [ ] **Passo 3:** Em tablet, empilhar blocos quando a largura reduzir; em mobile, manter abas e subtabs utilizáveis, formulários em coluna e ações principais largas.
- [ ] **Passo 4:** Ajustar linhas de meios de pagamento e histórico para mobile sem ocultar rótulos, status, diferença ou valores e sem rolagem horizontal da página.
- [ ] **Passo 5:** Atualizar skeleton para espelhar cabeçalho, status, navegação e painel, removendo a grade fixa de cinco métricas.
- [ ] **Passo 6:** Conferir labels acessíveis, ícones decorativos ocultos, foco visível, mensagens `status`/`alert` e nomes/controles ARIA das abas.
- [ ] **Passo 7 — revisão estática:** inspecionar breakpoints atuais em 1100px e 680px, seletores sob `.workspace-territory`, semântica de painéis e inexistência de navegação duplicada. Não executar comandos automatizados proibidos.

## Limites de validação

Este plano prevê comparação estática dos componentes, contratos e estados descritos na especificação. Pelas instruções do repositório, não serão criados ou executados testes, build, lint ou typecheck. A revisão final deve declarar explicitamente qualquer comportamento que não pôde ser confirmado por inspeção estática.
