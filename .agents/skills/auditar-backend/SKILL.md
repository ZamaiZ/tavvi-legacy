---
name: auditar-backend
description: Use quando o usuário pedir uma auditoria completa do serviço Express em apps/backend, incluindo cobertura arquivo a arquivo, arquitetura, segurança e más práticas.
---

# Auditar o backend

Faça uma auditoria estática e exaustiva do código próprio em `apps/backend`. O resultado deve permitir conferir quais arquivos foram examinados e localizar cada achado. Uma lista de problemas sem prova de cobertura não satisfaz o pedido.

## Escopo e cobertura

1. Leia `AGENTS.md` da raiz e os arquivos de instruções aplicáveis dentro de `apps/backend`. Respeite as restrições locais: não execute comandos Git, typecheck, build, lint ou test; não crie testes.
2. Faça um inventário recursivo de **todos** os caminhos sob `apps/backend`, inclusive ocultos e ignorados. Classifique cada item como código/configuração/documentação própria, dependência instalada, artefato gerado, mídia/binário ou segredo local. Registre a quantidade por classe e os critérios usados; não omita diretórios silenciosamente.
3. Leia integralmente cada arquivo próprio legível, em partes quando necessário. Inclua entrada do processo, configuração, rotas, middleware, serviços, integração, tipos e documentação. Para binários, examine metadados e referências de uso; para segredos locais, registre apenas existência e papel, sem abrir, copiar ou expor valores. Dependências instaladas e artefatos gerados entram no inventário, mas a análise de qualidade se concentra no código próprio.
4. Mantenha um registro de cobertura por caminho com estado `lido integralmente`, `inspecionado por metadados` ou `não examinado`, mais o motivo. Antes de concluir, compare o registro com um novo inventário e explique qualquer diferença. Se o trabalho atravessar sessões, persista o registro e retome do último arquivo concluído; não chame amostragem de varredura completa.

## Análise

- Reconstrua o fluxo da requisição e da entrega assíncrona entre inicialização, Express, rotas, serviço de push, `web-push` e Supabase. Consulte contratos em `apps/web` e `supabase` quando forem necessários para confirmar uma integração; registre esse contexto separadamente da cobertura do backend.
- Avalie responsabilidades misturadas, acoplamento, repetição, contratos implícitos, tipagem, validação de configuração e entradas, autenticação e autorização, exposição de segredos, respostas e erros HTTP, logs, limites de recursos, concorrência, idempotência, falhas parciais, encerramento do processo e observabilidade. Não trate tamanho de arquivo isolado como defeito.
- Preserve o papel arquitetural do serviço: apenas entrega de Web Push e monitoramento de saúde. Verifique especialmente o isolamento de `APP_SERVER_KEY` e da chave VAPID privada no servidor, a proteção da rota interna, a reivindicação e poda de inscrições no banco, e a diferença entre aceitar uma entrega e concluí-la. Não proponha deslocar sessões ou fluxos públicos do Web para este serviço sem uma justificativa explícita.
- Diferencie defeito comprovado, risco plausível e preferência arquitetural. Verifique afirmações sobre bibliotecas contra as versões instaladas ou documentação relevante. Para cada extração proposta, defina responsabilidade, interface, dependências, ordem de migração e possíveis efeitos colaterais; evite fragmentação motivada apenas por contagem de linhas.

## Entrega

Produza um relatório persistido no projeto e um resumo na conversa. O relatório deve conter:

1. Escopo, método, contagem por classe, inventário/registro de cobertura e limites da inspeção estática.
2. Mapa da arquitetura atual e do fluxo de entrega, com dependências externas e problemas transversais.
3. Achados priorizados por impacto e confiança, cada um com caminhos e linhas, evidência observável, consequência, recomendação concreta e arquivos afetados. Agrupe ocorrências repetidas sem perder suas referências.
4. Plano de reorganização incremental por responsabilidade, com fronteiras propostas, ordem de execução e dependências. Separe correções objetivas de escolhas de arquitetura que exigem decisão do usuário.
5. Áreas inspecionadas sem achados relevantes e arquivos que não puderam ser avaliados, com justificativa.

Não altere o código durante a auditoria, salvo pedido explícito. Se a cobertura integral ficar impossível, entregue o registro parcial e diga precisamente o que falta; nunca apresente a análise parcial como completa.
