# Backend Express do Tavvi Mobile — desenho aprovado

Data: 2026-09-24

Status: desenho aprovado em conversa; aguardando revisão deste documento.

## 1. Objetivo

Transferir para o serviço Express em `tavvi-backend/` todas as operações de backend usadas pelo app Tavvi Mobile. O app continuará sendo React Native com Expo, mas não chamará Supabase Auth, tabelas ou RPCs diretamente. O Express será a única API do aplicativo e continuará usando Supabase como provedor de identidade e banco.

O escopo preserva as funcionalidades móveis que já existem: login administrativo, sessão, convites de plataforma e consulta de restaurantes. A migração deve preservar o contrato HTTP usado pelas telas sempre que possível e não inclui recursos de restaurante ou cardápio ainda não implementados no app.

## 2. Restrições e critérios de sucesso

- O foco é o app móvel e seu backend Express dedicado neste repositório.
- O backend deve ser um processo Node.js/Express independente do servidor Expo.
- O Expo Router permanece responsável pelas telas e navegação, não pelas operações de backend.
- Toda comunicação do app com autenticação e dados passa pelo Express.
- O app mantém access e refresh tokens no SecureStore; login e renovação Supabase são solicitados ao Express.
- O Express usa chave anon do Supabase mais o token do usuário; nenhuma service-role key é necessária ou permitida.
- O papel `platform_admin` é confirmado no servidor para cada operação administrativa.
- Preservar a autorização RLS do Supabase, o rate limit e os registros de auditoria.
- Não executar `git`, typecheck, build, lint ou testes, conforme as instruções do projeto.
- O provedor e o processo de deploy do Express ficam em aberto nesta etapa.

O trabalho estará pronto quando o app usar exclusivamente `EXPO_PUBLIC_API_URL`, todas as rotas móveis existentes forem atendidas pelo Express, o app não importar mais o SDK Supabase, e os módulos de API do Expo e o backend embutido em `src/server/` tiverem sido removidos. Configuração documentada e execução local do processo Express fazem parte da entrega; publicação em produção não faz.

## 3. Escopo funcional atual a preservar

O levantamento do código encontrou estes caminhos, que compõem a API v1:

| Domínio | Endpoint | Comportamento atual |
|---|---|---|
| Sessão | `POST /api/mobile/v1/session` | Autentica e confirma o papel de administrador antes de retornar a sessão. |
| Sessão | `GET /api/mobile/v1/session` | Valida a sessão atual e retorna o usuário móvel. |
| Convites | `GET /api/mobile/v1/invites` | Lista convites de plataforma sem expor o hash do token. |
| Convites | `POST /api/mobile/v1/invites` | Cria convite, retorna o link em claro uma única vez e grava auditoria. |
| Convites | `GET /api/mobile/v1/invites/:id` | Consulta um convite de plataforma. |
| Convites | `POST /api/mobile/v1/invites/:id` | Rotaciona o link de convite pendente e invalida o anterior. |
| Convites | `POST /api/mobile/v1/invites/:id/revoke` | Revoga um convite pendente; repetição após revogação é idempotente. |
| Restaurantes | `GET /api/mobile/v1/restaurants` | Lista restaurantes em modo somente leitura. |
| Restaurantes | `GET /api/mobile/v1/restaurants/:id` | Retorna detalhes e membros do restaurante em modo somente leitura. |

O detalhe do restaurante e a rotação do convite estão implementados no código atual, embora estejam ausentes do escopo de uma spec anterior. Esta spec substitui as decisões anteriores sobre manter a API nas rotas Expo e sobre excluir esses dois endpoints.

Fora do escopo: criação ou edição de restaurante, cardápios, equipes, convites de equipe, métricas ou dashboards sem endpoint funcional existente, alterações na aplicação web e publicação do serviço.

## 4. Estado atual e riscos observados

- `tavvi-backend/` contém somente `express` como dependência e ainda não tem bootstrap HTTP, TypeScript, rotas ou serviços.
- As telas chamam as Expo API routes. A lógica servidor e integração Supabase estão em `src/server/` e `src/app/api/mobile/v1/`.
- `src/lib/api-client.ts` e `src/features/auth/auth-context.tsx` usam `@supabase/supabase-js` para ler sessão, renovar token, encerrar sessão e instalar os tokens retornados pelo login. A migração precisa mover renovação e encerramento para o Express, não apenas os endpoints de leitura e escrita.
- A migration `supabase/migrations/0016_mobile_admin_invites.sql` já faz rotação e auditoria na mesma transação. O serviço atual não chama outra auditoria para rotação porque o RPC já o faz.
- Criação e revogação atualmente fazem a alteração e chamam `record_audit` em outra requisição RPC. Uma falha de auditoria pode deixar a alteração aplicada sem confirmação confiável para o app. O novo backend deve usar RPCs transacionais para essas mutações.
- O endereço de deploy e o proxy confiável ainda não foram escolhidos. A API não pode confiar em headers de IP encaminhados diretamente por clientes.
- Não há métricas analíticas funcionais no app atual; o termo “métricas” não será interpretado como autorização para criar um dashboard ou coletar telemetria nova.

## 5. Abordagens

### 5.1 Express como fronteira de API, Supabase por usuário — escolhida

O Express oferece endpoints móveis versionados, autentica o usuário no Supabase e constrói clientes Supabase limitados pelo token daquele usuário. A autorização administrativa e o banco continuam sujeitos a RLS e aos RPCs. O app guarda os tokens em SecureStore e nunca importa o SDK Supabase.

Vantagens: separação clara entre interface e dados, manutenção de RLS, ausência de chave privilegiada no binário e baixo acoplamento do contrato móvel ao schema do banco. O custo é implementar no Express a renovação de sessão e a adaptação das rotas existentes.

### 5.2 Express com service-role key — rejeitada

Uma chave service-role simplificaria o acesso, mas contorna RLS e amplia o impacto de um erro de autorização ou vazamento. Não é necessária para os fluxos encontrados.

### 5.3 Acesso direto do app ao Supabase — rejeitada

Manter login, renovação ou consulta direta no app deixa parte do backend fora do Express e não cumpre a fronteira solicitada.

## 6. Arquitetura alvo

```text
React Native / Expo
  ├─ SecureStore: access token + refresh token
  ├─ TanStack Query: cache em memória
  └─ cliente HTTP ── HTTPS ──> tavvi-backend (Node.js + Express)
                                 ├─ routers /api/mobile/v1
                                 ├─ controllers HTTP
                                 ├─ middleware compartilhado
                                 │    ├─ validação de sessão e admin
                                 │    ├─ validação de entrada
                                 │    ├─ rate limit e IP confiável
                                 │    └─ erros e request id
                                 ├─ serviços de domínio
                                 │    ├─ auth/session
                                 │    ├─ invitations
                                 │    └─ restaurants
                                 └─ adaptadores Supabase por usuário
                                          ├─ Supabase Auth
                                          ├─ RLS + tabelas/RPCs
                                          └─ rate limit + auditoria
```

O projeto mantém fronteiras por domínio e separa a camada HTTP da regra de negócio. Controllers convertem requisições e respostas; serviços implementam os casos de uso; middleware resolve identidade, papel, rate limit e erros transversais. Não será criado um repositório genérico sobre cada tabela sem uma necessidade concreta: consultas permanecem em adaptadores ou serviços tipados, com responsabilidades focadas.

Os tipos de resposta móveis ficam explícitos no contrato do app e no backend. DTOs não expõem linhas completas do banco, campos de token_hash ou dados além do necessário. A compatibilidade das duas definições será documentada junto da API v1; importar código servidor no bundle móvel é proibido.

## 7. Autenticação e ciclo de sessão

### Login

1. O app envia e-mail e senha por HTTPS a `POST /api/mobile/v1/session`.
2. O Express valida formato e limites de tamanho, aplica rate limit de login e autentica com Supabase Auth.
3. O Express consulta `is_platform_admin` usando o access token do usuário.
4. Só após autorização o Express devolve access token, refresh token, expiração e DTO mínimo de usuário.
5. O app persiste tokens no SecureStore e limpa o cache de dados anterior.

Credenciais inválidas mantêm uma resposta uniforme `401`. Conta válida sem o papel esperado recebe `403` e nenhum token é guardado pelo app.

### Renovação e validação

- O app envia o access token em `Authorization: Bearer` às rotas protegidas.
- Em `401`, o cliente coordena uma única chamada concorrente a `POST /api/mobile/v1/session/refresh`, envia o refresh token ao Express, recebe nova sessão e tenta novamente a chamada original uma vez.
- O Express usa Supabase Auth para renovar e confirma o papel administrativo antes de devolver tokens renovados.
- `GET /api/mobile/v1/session` revalida identidade e papel; ao voltar ao primeiro plano, o app pode validar a sessão sem apagar cache por falha de rede transitória.
- Falha permanente de renovação encerra a sessão local e limpa o cache. `403` invalida acesso administrativo e apresenta o estado apropriado.

### Encerramento

`DELETE /api/mobile/v1/session` revoga a sessão remota pelo Supabase Auth quando possível. O app sempre remove tokens locais e limpa dados em memória; uma falha de rede não deve manter a sessão acessível neste dispositivo. O servidor não armazena sessão própria.

## 8. Domínios e regras de negócio

### Convites

- Manter o contrato atual de listagem, detalhe, criação, rotação e revogação.
- Validar UUIDs, e-mail e validade entre 1 e 30 dias na fronteira HTTP.
- Gerar token criptograficamente aleatório no servidor; armazenar somente SHA-256; retornar link em claro somente na resposta de criação/rotação.
- Nunca repetir automaticamente criação, rotação ou revogação no cliente após erro de rede.
- Preservar estados e códigos `404`/`409` atuais e idempotência da revogação repetida.
- Continuar usando `rotate_platform_admin_invite`, cujo código atual já revoga, cria e audita na mesma transação.
- Adicionar RPCs aditivas de criação e revogação para executar alteração e auditoria na mesma transação. Manter as funções existentes para consumidores legados; não alterar o contrato do app web.
- Aplicar rate limit às mutações e não registrar token, URL de convite ou e-mail em logs de aplicação.

### Restaurantes

- Preservar lista e detalhe como leituras somente.
- Usar colunas específicas e mapear datas, estado e membros para DTOs móveis menores.
- Não adicionar edição, criação, suspensão, arquivos, cardápios ou operações de equipe.

### Contrato HTTP

Manter respostas de sucesso como `{ "data": ... }` e falhas como `{ "error": { "code": ..., "message": ... } }`. Todas as respostas administrativas incluem `Cache-Control: no-store`. Mensagens públicas não incluem erros Supabase, SQL, stack trace, tokens ou configurações.

Status existentes a preservar: `400` JSON inválido, `401` sem sessão/inválida, `403` sem papel, `404` recurso ausente, `409` conflito de estado, `422` entrada inválida, `429` limite excedido e `500` erro opaco.

## 9. Segurança, privacidade e compliance operacional

- Todas as rotas administrativas exigem autenticação remota válida e confirmação de `platform_admin` no servidor. Esconder telas no app não conta como autorização.
- Criar cliente Supabase sem persistência de sessão no processo; para operações de dados, encaminhar apenas o token do usuário. Nunca usar service-role key.
- Validar entrada com Zod no servidor, limitar tamanho do corpo e aceitar apenas os métodos/caminhos previstos.
- Exigir HTTPS em produção. Configurar CORS com allowlist apenas se a superfície web/de desenvolvimento precisar; CORS não é mecanismo de autenticação e chamadas nativas não dependem dele.
- Configurar `trust proxy` apenas para a topologia efetivamente escolhida. Só derivar IP de origem de proxy conhecido; ignorar headers arbitrários fornecidos pelo app.
- Segredos server-only ficam em variáveis do processo do Express; o app recebe somente `EXPO_PUBLIC_API_URL`. Remover variáveis `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` do app quando nenhum uso direto permanecer.
- Excluir senha, bearer/refresh token, token de convite e link de convite de logs, telemetria, erros e auditoria. Minimizar e limitar retenção de IP/e-mail conforme a política operacional aplicável à LGPD.
- Reutilizar rate limit e auditoria do Supabase com identidade derivada da sessão. Não aceitar ator, papel ou IP como autoridade fornecida pelo payload do app.
- Preferir RPCs transacionais para toda mutação auditada, evitando falso erro com operação persistida e auditoria ausente.
- Não declarar certificação legal: a implementação reduz dados e protege fronteiras; revisão jurídica/política de retenção permanece decisão organizacional.

## 10. Configuração e execução

O serviço será configurável por ambiente, sem provedor de deploy embutido no código. Configurações mínimas previstas:

- `PORT` e `NODE_ENV`;
- `SUPABASE_URL` e `SUPABASE_ANON_KEY` server-only;
- `PAINEL_PUBLIC_URL` para criar links de convite;
- configuração explícita de proxies confiáveis e origens web autorizadas, somente quando aplicável.

O app usará `EXPO_PUBLIC_API_URL` com origem absoluta da API Express. O ambiente local deve explicar como iniciar app e backend em processos separados e como usar endereço LAN no dispositivo físico. A documentação de deploy deve ficar neutra quanto ao provedor até ele ser escolhido.

O diretório `tavvi-backend` deve conter bootstrap Express, roteadores versionados, módulos de domínio, configuração tipada/validada, tipos Supabase e scripts de desenvolvimento/produção. Como a aplicação usa TypeScript e pnpm, o serviço seguirá TypeScript com build Node apropriado e lockfile coerente; eventual organização de workspace será decidida no plano sem importar dependências servidor para o app.

## 11. Migração sem quebra de contrato

1. Preparar o serviço Express e confirmar contrato, middlewares e adaptadores Supabase.
2. Implementar e documentar os endpoints v1, incluindo sessão/refresh/logout e mutações auditáveis.
3. Configurar o app para apontar à URL do Express, adaptar armazenamento e refresh, e trocar todas as chamadas.
4. Conferir que login, listagens, detalhes e mutações não fazem chamadas diretas ao Supabase.
5. Remover Expo API routes e `src/server/`, limpar configuração Expo de execução web/API e atualizar `.env.example` e documentação.
6. Manter DTOs e URLs `/api/mobile/v1` compatíveis durante a troca; não migrar dados de negócio nem alterar o schema usado pela web fora das novas RPCs aditivas necessárias à atomicidade de auditoria.

Sem testes automatizados ou comandos proibidos. A revisão final será documental/estática e a operação real do servidor não será declarada validada por build, deploy ou teste que não foi executado.

## 12. Itens que permanecem para decisão antes do deploy

- Provedor, domínio, TLS, health checks, processo de restart e secrets manager.
- Allowlist de origem web, caso o app seja usado no browser.
- Proxy/load balancer específico e respectiva política de IP confiável.
- Aplicação e coordenação das novas migrations/RPCs no Supabase compartilhado.
- Política operacional de retenção e acesso a logs de auditoria/IP.

Essas escolhas não bloqueiam a arquitetura nem a execução local; são pré-requisitos para uma implantação segura em produção.
