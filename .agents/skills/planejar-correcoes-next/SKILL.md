---
name: planejar-correcoes-next
description: Use quando o usuário pedir para interpretar um relatório de auditoria de apps/web, conferir os achados no Next.js atual e propor um plano completo de correções sem implementar mudanças.
---

# Planejar correções a partir da auditoria do Next.js

Transforme um relatório de auditoria de `apps/web` em um plano de correções executável e rastreável. Use o relatório indicado pelo usuário; na ausência de caminho, procure o relatório mais recente do Next.js em `docs/auditoria/`. O relatório é uma hipótese documentada, não prova de que o código atual ainda contém cada problema.

## Conferência das evidências

1. Leia o relatório inteiro, os arquivos de cobertura referenciados por ele, `AGENTS.md` e instruções locais. Respeite as proibições do projeto: não execute comandos Git, typecheck, build, lint ou test; não crie testes.
2. Extraia todos os achados, recomendações, decisões pendentes, limites e áreas sem achados. Monte uma matriz com identificador, prioridade original, evidência citada e estado da revisão. Nenhum achado pode desaparecer por agrupamento.
3. Reabra os trechos citados no código atual e acompanhe seus contratos nas rotas, componentes, Server Actions, DAL, configuração de hospedagem e SQL pertinentes. Confira linhas e comportamento atuais, causa e impacto. Marque cada achado como `confirmado`, `parcial`, `superado` ou `não verificável`, com motivo. Não converta uma condição de proxy, banco ou produção em fato observado.
4. Antes de propor qualquer mudança de código Next.js, consulte o guia pertinente da versão instalada em `apps/web/node_modules/next/dist/docs/`. Considere a versão Next.js 16 e sinalize APIs ou convenções cuja recomendação depende dessa documentação.

## Proposta de correção

- Para cada item confirmado ou parcial, defina comportamento desejado, mudança mínima coerente, arquivos e contratos afetados, pré-requisitos, risco de regressão e critério de conferência estática. Para itens superados ou não verificáveis, registre a evidência e a próxima verificação necessária.
- Agrupe mudanças em etapas revisáveis, ligando explicitamente cada achado à etapa que o resolve. Ordene por dependência e redução de risco; prioridade original é entrada, não a única regra da sequência.
- Preserve os três territórios (site público, painel e console da plataforma), a separação dos cookies, as sessões locais e globais, autorização por membership e privilégios de plataforma, e o requisito de que fluxos públicos não criem sessões autenticadas. Não amplie acesso com base apenas na leitura pública permitida por uma policy RLS.
- Para operações que cruzam Server Actions, Supabase e Storage, descreva estado intermediário, falha parcial, idempotência, compensação ou reconciliação. Não prometa atomicidade entre banco e Storage. Para auditoria, diferencie evento obrigatório na mesma transação da trilha operacional fora da transação.
- Para URL pública, convites, IP e CSP, identifique a origem de cada valor confiável, o comportamento de fallback e as dependências de proxy/hospedagem. Não trate validação por regex como proteção de rede nem recomende nonce/hash de CSP antes de verificar os requisitos de scripts do Next, tema e PWA.
- Para SQL, diferencie `supabase/migrations/0001_web_baseline.sql`, destinado a projeto vazio, de uma migração segura para ambiente com dados. Não proponha aplicar o baseline sobre banco existente; especifique pré-condições, migração compatível, transição, reversão e identificação do ambiente para qualquer ação futura.
- Não presuma que maior divisão de arquivos resolve os achados. Para cada extração, declare responsabilidade, interface, direção das dependências e benefício verificável. Mantenha decisões de produto/arquitetura visíveis, apresentando opções, recomendação condicionada, custo e dado faltante.
- Não invente comandos de validação proibidos nem acrescente testes. Critérios de aceite podem usar inspeção estática, revisão dos contratos e evidências operacionais a coletar numa etapa futura; identifique o que não foi executado.

## Entrega

Grave o plano em um novo arquivo junto ao relatório, sem sobrescrevê-lo, e forneça um resumo na conversa. Inclua:

1. Relatório de origem, data da revisão, escopo e limites.
2. Matriz de todos os achados com estado após revalidação, prioridade revisada, evidência atual e etapa responsável.
3. Arquitetura alvo e fluxos afetados entre UI, Server Actions, DAL, Supabase, Storage, proxy e sessões, quando pertinentes.
4. Etapas em ordem, cada uma com objetivo, mudanças por arquivo/componente, contratos, dependências, migração, risco, critério de aceite e reversão.
5. Decisões pendentes com alternativas e recomendação, riscos residuais e itens fora de escopo.

Esta skill entrega uma proposta, não altera código da aplicação nem aplica SQL. Se a evidência atual contrariar o relatório, corrija o plano e explique a divergência. Não declare o plano completo enquanto todo achado não tiver um destino explícito.
