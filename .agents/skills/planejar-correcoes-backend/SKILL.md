---
name: planejar-correcoes-backend
description: Use quando o usuário pedir para interpretar um relatório de auditoria do backend, conferir seus achados e propor um plano completo de correções sem implementar mudanças.
---

# Planejar correções a partir da auditoria do backend

Transforme um relatório de auditoria de `apps/backend` em um plano de correções executável e rastreável. Use o relatório indicado pelo usuário; na ausência de caminho, procure o relatório mais recente do backend em `docs/auditoria/`. O relatório é uma hipótese documentada, não prova de que o código atual ainda contém cada problema.

## Conferência das evidências

1. Leia o relatório inteiro, `AGENTS.md` e instruções locais. Respeite as proibições do projeto: não execute comandos Git, typecheck, build, lint ou test; não crie testes.
2. Extraia todos os achados, recomendações, decisões pendentes, limites de observação e áreas sem achados. Monte uma matriz com identificador, prioridade original, evidência citada e estado da revisão. Nenhum achado pode desaparecer por agrupamento.
3. Reabra os trechos citados no código atual e siga o fluxo até seus contratos em `apps/web`, `supabase` e configuração pertinente. Confira se arquivos e linhas ainda correspondem, se a consequência decorre do código e se dois achados têm a mesma causa. Marque cada item como `confirmado`, `parcial`, `superado` ou `não verificável`, com motivo. Não transforme risco condicionado à infraestrutura em defeito comprovado.
4. Leia a documentação relevante das versões instaladas quando a proposta depender de comportamento de biblioteca. Para qualquer alteração sugerida no código Next.js, consulte antes o guia pertinente em `apps/web/node_modules/next/dist/docs/`.

## Proposta de correção

- Para cada item confirmado ou parcial, descreva o comportamento desejado, a menor mudança coerente, arquivos e contratos afetados, dependências, risco de regressão e como conferir estaticamente o resultado. Para itens superados ou não verificáveis, registre evidência e próxima verificação necessária.
- Agrupe mudanças em etapas que possam ser revisadas separadamente, mantendo o vínculo explícito com todos os achados. Ordene por pré-requisito e redução de risco; não use a prioridade do relatório como única regra de sequência.
- Modele as fronteiras entre backend, Web e banco antes de sugerir nomes de funções ou arquivos. Em Web Push, trate explicitamente claim, lease, tentativas, conclusão por destino, duplicação possível, lote, concorrência, agendamento, shutdown, classificação de erros, poda e observabilidade. Declare qual garantia de entrega a proposta oferece e o que ela não pode garantir.
- Para SQL, diferencie o baseline de instalação limpa de uma migração para ambiente existente. Não proponha aplicar `supabase/migrations/0001_web_baseline.sql` sobre um banco com dados; descreva migração compatível, transição entre protocolos, reversão e identificação do projeto/ambiente antes de qualquer aplicação.
- Para endpoint de inscrição e rede, compare opções de validação de provedores e política de egress com seus limites reais. Separe o que o código comprova da topologia que não foi observada. Preserve `APP_SERVER_KEY` e VAPID privada no servidor e o escopo do backend em Web Push e saúde.
- Quando uma escolha depender de produto ou infraestrutura, apresente opções, recomendação condicionada, custo e dado faltante. Proponha um caminho padrão fundamentado para que o plano continue útil sem resposta imediata; sinalize o ponto de decisão antes de implementar a parte dependente.
- Não invente comandos de validação proibidos nem acrescente testes. Critérios de aceite podem combinar inspeção estática, revisão de contratos e evidências operacionais que uma implementação futura deverá coletar, claramente identificadas como não executadas agora.

## Entrega

Grave o plano em um novo arquivo junto ao relatório, sem sobrescrevê-lo, e forneça um resumo na conversa. Inclua:

1. Identificação do relatório, data da revisão, escopo e limites.
2. Matriz de todos os achados com estado após revalidação, prioridade revisada, evidência atual e etapa que o resolve.
3. Arquitetura alvo e fluxo de ponta a ponta, incluindo estados persistidos e contratos entre Web, backend e Supabase.
4. Etapas de implementação em ordem, cada uma com objetivo, alterações concretas por arquivo/componente, dependências, migração, risco, critérios de aceite e eventual reversão.
5. Decisões pendentes, alternativas e recomendação; riscos residuais e itens fora de escopo.

Esta skill entrega uma proposta, não edita código de produção nem aplica SQL. Se a evidência atual contrariar o relatório, corrija o plano e explique a divergência. Não declare o plano completo enquanto algum achado do relatório não tiver destino explícito.
