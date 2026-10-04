---
name: auditar-next
description: Use quando o usuário pedir uma auditoria completa da aplicação Next.js em apps/web, incluindo cobertura arquivo a arquivo, arquitetura, responsabilidades e más práticas.
---

# Auditar a aplicação Next.js

Faça uma auditoria estática e exaustiva do código próprio em `apps/web`. O resultado deve permitir conferir quais arquivos foram examinados e localizar cada achado. Uma lista de problemas sem prova de cobertura não satisfaz o pedido.

## Escopo e cobertura

1. Leia `AGENTS.md` da raiz e os arquivos de instruções aplicáveis dentro de `apps/web`. Respeite as restrições locais: não execute comandos Git, typecheck, build, lint ou test; não crie testes.
2. Faça um inventário recursivo de **todos** os caminhos sob `apps/web`, inclusive ocultos e ignorados. Classifique cada item como código/configuração/documentação própria, dependência instalada, artefato gerado, mídia/binário ou segredo local. Registre a quantidade por classe e os critérios usados; não omita diretórios silenciosamente.
3. Leia integralmente cada arquivo próprio legível, em partes quando necessário. Inclua rotas, componentes, estilos, hooks, utilitários, ações, acesso a dados, configuração, scripts e documentação. Para mídia e binários, examine metadados e referências de uso; para segredos locais, registre apenas a existência e o papel, sem expor valores. Dependências instaladas e artefatos gerados entram no inventário, mas a análise de qualidade se concentra no código próprio.
4. Mantenha um registro de cobertura por caminho com estado `lido integralmente`, `inspecionado por metadados` ou `não examinado`, mais o motivo. Antes de concluir, compare o registro com um novo inventário e explique qualquer diferença. Se o trabalho atravessar sessões, persista o registro e retome do último arquivo concluído; não chame amostragem de varredura completa.

## Análise

- Reconstrua a organização por domínio e as relações entre `app`, `features`, `server`, `lib`, componentes, estilos e arquivos de configuração. Consulte código compartilhado fora de `apps/web` somente quando necessário para entender uma dependência; registre esse contexto separadamente.
- Procure responsabilidades misturadas, arquivos ou componentes grandes por *motivo concreto* de acoplamento, repetição, dependências cruzadas, fronteiras cliente/servidor confusas, lógica de negócio em UI, acesso a dados espalhado, contratos implícitos, tratamento inconsistente de erros, autorização, validação, dados sensíveis, acessibilidade, desempenho e manutenção de estilos. Não trate tamanho de arquivo isolado como defeito.
- Para afirmações que dependem de comportamento ou convenções do Next.js 16, consulte o guia relevante em `apps/web/node_modules/next/dist/docs/`. Diferencie regra documentada, risco plausível e preferência arquitetural.
- Verifique se cada proposta de extração cria uma unidade com responsabilidade e interface claras. Descreva dependências, sequência de migração e possíveis efeitos colaterais; evite sugerir fragmentação apenas para reduzir linhas.

## Entrega

Produza um relatório persistido no projeto e um resumo na conversa. O relatório deve conter:

1. Escopo, método, contagem por classe, inventário/registro de cobertura e limites da inspeção estática.
2. Mapa da arquitetura atual e problemas transversais.
3. Achados priorizados por impacto e confiança, cada um com caminhos e linhas, evidência observável, consequência, recomendação concreta e arquivos afetados. Agrupe ocorrências repetidas sem perder suas referências.
4. Plano de reorganização incremental por domínio, com fronteiras e responsabilidades propostas, ordem de execução e dependências. Separe correções objetivas de escolhas de arquitetura que exigem decisão do usuário.
5. Áreas inspecionadas sem achados relevantes e arquivos que não puderam ser avaliados, com justificativa.

Não altere o código durante a auditoria, salvo pedido explícito. Se a cobertura integral ficar impossível, entregue o registro parcial e diga precisamente o que falta; nunca apresente a análise parcial como completa.
