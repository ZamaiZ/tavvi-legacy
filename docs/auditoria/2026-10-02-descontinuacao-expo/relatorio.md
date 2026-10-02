> **Atualizacao pos-implementacao (02/10/2026):** este relatorio registra a auditoria anterior a retirada e seus trechos abaixo descrevem o estado observado naquela data. A autorizacao posterior foi reconstruir o banco vazio e remover tudo que nao representa o produto Web atual. O workspace foi alterado: `apps/mobile`, o pacote de contratos e as migrations historicas foram removidos; `supabase/migrations/0001_web_baseline.sql` e agora o unico schema de instalacao limpa. O Express manteve somente healthcheck e entrega Web Push; o Next usa a RPC web-only `revoke_my_web_push_subscriptions()`. O Supabase remoto **nao** foi resetado: o projeto lido pelo `.env` nao foi confirmado como destino. O baseline nao foi aplicado nem validado em PostgreSQL.
# Auditoria da descontinuação do Expo — 02/10/2026

**Conclusão: o Next precisa de ajustes para uma retirada completa. O Express ainda entrega o push web. Excluir `apps/mobile` não remove contratos biométricos, endpoints, inscrições nem sessões do Supabase.**

Recomendação: preservar Next + Supabase e reduzir inicialmente o Express ao serviço de Web Push. Encerrar a aplicação Expo, suas rotas e credenciais específicas; retirar do banco apenas objetos comprovadamente exclusivos do cliente nativo. Migrar o envio de push para Next ou worker é uma decisão posterior, não uma condição para encerrar Expo.

Esta auditoria não implementa a retirada. Foram criados apenas este relatório, o plano, um inventário SQL para leitura futura e evidências sem credenciais. Não foram executados Git, compilação, lint, checagem de tipos ou testes.

## 1. Evidências e limites

Foram examinados os fluxos e configurações relevantes de `apps/web`, `apps/backend`, `apps/mobile`, `packages/api-contracts`, as 34 migrations SQL, o schema agregado, manifests, ambientes locais e documentação. Buscas de consumidores foram cruzadas entre as aplicações.

Também foram realizadas leituras remotas no projeto Supabase apontado por `apps/backend/.env`: `GET /auth/v1/settings`, `GET /rest/v1/` para OpenAPI e `HEAD` com contagens. Nenhum login, criação de sessão, execução de RPC ou alteração de dados foi realizado.

Resultados em [supabase-readonly.json](./supabase-readonly.json):

| Item | Resultado observado |
|---|---|
| Contratos biométricos | 1 registro; 1 com `revoked_at IS NULL` |
| Tokens Expo Push | 0 |
| Inscrições Web Push | 1 |
| Auth por email | Habilitado |
| Cadastro | Permitido |
| Confirmação de email | Automática (`mailer_autoconfirm=true`) |
| Passkeys | Desabilitadas |
| Login anônimo, telefone e provedores OAuth listados | Desabilitados |
| Estruturas Expo | Tabelas e RPCs ainda expostas no OpenAPI privilegiado |

Os arquivos locais web/backend apontam para a mesma URL Supabase e têm os mesmos valores de anon key, `APP_SERVER_KEY` e chave pública VAPID. Os valores não foram registrados no relatório. Há `SUPABASE_SECRET_KEY` no backend e não há `EXPO_ACCESS_TOKEN` configurado nesse arquivo local.

**Isso não comprova que esse projeto seja produção.** Também não comprova conteúdo das funções, RLS efetiva, grants, triggers, histórico realmente aplicado, duração das sessões, configuração de single-session, cron, hooks, redirects ou consumidores externos. OpenAPI privilegiado não demonstra acesso anônimo. O inventário SQL anexo cobre parte dessas lacunas; Management API/dashboard e configuração da hospedagem cobrem as demais.

Não foi feita validação funcional da aplicação ou reprodução dos possíveis problemas de segurança. Achados de execução inferida estão identificados como tal.

## 2. Arquitetura que existe hoje

| Fluxo | Caminho atual | Consequência |
|---|---|---|
| Login, cadastro, logout e senha web | Next Server Actions → DAL → Supabase Auth | Não dependem das rotas de autenticação Express |
| Restaurantes, membros, convites e cardápios web | Next DAL → Supabase/PostgREST/RPC | Não é necessário migrar essas operações para Express |
| Mídia | Next + Supabase Storage | Preservar buckets, regras e uploads |
| Feedback público e chamados | Next → RPC com `APP_SERVER_KEY` | Essa chave continua necessária |
| Notificações em tempo real | Navegador → Supabase Realtime privado | Preservar canais, políticas e renovação do JWT |
| Push de navegador | Next → Express `/api/v1/internal/push/deliver` → Supabase + Web Push | Express não pode ser desligado agora sem substituição |
| Expo | Aplicativo → API Express → Supabase | Rotas públicas da API têm consumo nativo identificado |

Evidências principais: `apps/web/src/server/dal/session.ts:75`, `_client.ts:28`, `push.ts:84`, `feedback-public.ts:55`, `service-calls-public.ts:25`, `notifications.ts:127`; `apps/backend/src/routes/v1.routes.ts:10`.

O README e `docs/api/v1.md` descrevem uma convergência web/mobile para Express que não corresponde ao estado integralmente implementado. O `AGENTS.md` diz que o Next é mantido separadamente, mas `apps/web` está neste workspace. Esses textos precisam ser corrigidos.

## 3. Mudanças obrigatórias no Next

### Logout global e referências à digital

`apps/web/src/server/dal/session.ts:134` chama `revoke_all_my_devices()`. A definição em `supabase/migrations/0028_device_contracts_minted_sessions.sql:159` atualiza `platform_admin_device_contracts` e exclui `push_subscriptions` do usuário.

**Se a tabela de contratos for apagada sem reescrever essa função, “sair de todos os aparelhos” quebra.** Se a RPC simplesmente desaparecer, o mesmo fluxo quebra. A limpeza de Web Push precisa continuar existindo.

A transição de menor impacto conserva inicialmente o nome e a assinatura da RPC, mas passa a limpar somente as inscrições web. O Next precisa atualizar mensagens que prometem desativar a digital, incluindo:

- `apps/web/src/server/dal/session.ts:116–145`;
- `apps/web/src/components/shell/account-panel.tsx:47`;
- `apps/web/src/components/shell/console-command-palette.tsx:49`.

Se for desejável um nome mais claro para a RPC, introduzir uma nova função e migrar o consumidor antes de remover a anterior. Não é necessário renomeá-la no mesmo corte.

### Tipos e dependências

`apps/web/src/domain/database.types.ts` contém `mobile_push_tokens`, RPCs nativas e o formato misto do claim. Atualizar após a migração, refletindo o banco final.

O manifesto web declara `@tavvi/api-contracts` e seu script de compilação referencia esse pacote (`apps/web/package.json:7,18`), mas não foram encontradas importações em `apps/web/src`. Remover essas referências se o pacote deixar de existir. Só excluir o diretório do pacote deixaria dependências e scripts quebrados.

### Configuração

Manter `API_BASE_URL` enquanto Web Push for entregue pelo Express: `apps/web/src/server/env.ts:20` a exige no carregamento. Manter `APP_SERVER_KEY`, URL/anon key Supabase, root domain e chave pública VAPID.

O `.env.local` web contém `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT`, mas o código web atual não os lê. São candidatos à limpeza na arquitetura recomendada. Não são públicos só por estarem nesse arquivo; também não há motivo para copiá-los ao navegador. Se o envio migrar para Next, tornam-se configurações server-only necessárias no novo emissor.

### O que permanece

Login por senha, cadastro por convite, cookies por território, proxy, DAL, RLS, ações do servidor, Realtime, PWA e interface responsiva permanecem. Pastas `components/mobile`, CSS mobile, `use-mobile`, o produto “cardápio digital” e a curva de animação `EXPO_OUT` não são dependências do Expo.

## 4. Autenticação, biometria e múltiplas sessões

### Três mecanismos distintos

1. O web mantém sessões Supabase em cookies SSR.
2. O Expo guarda access/refresh tokens no dispositivo.
3. A biometria nativa libera um segredo local; o backend confere seu hash e cria outra sessão Supabase.

O backend não recebe impressões digitais. O fluxo atual usa `deviceId` e `deviceSecret`, protegido no aplicativo por SecureStore/autenticação local. Não é WebAuthn, passkey ou fingerprint de navegador. `draftFingerprint` no editor web compara conteúdo de formulário, sem função de segurança.

Evidências: `apps/mobile/src/features/auth/device-contract-store.ts`, `use-device-contract-auth.ts:88–108`; `apps/backend/src/features/auth/device-contract.service.ts:97–159`; `packages/api-contracts/src/auth.ts:25`.

Não foi encontrada implementação de biometria web nem inventário próprio de sessões por aparelho. O PWA não herda a biometria do Expo.

### Preservar múltiplas sessões web

Os cookies `sb-admin` e `sb-painel` são separados por território, sem `Domain`, com `SameSite=lax`, `Secure` em produção e path `/` (`_client.ts:10`, `territory.ts:60`). Essa separação continua útil para console, painel e diferentes navegadores.

Manter logout comum com `scope: 'local'` (`session.ts:120`); trocar para `global` só porque o Expo saiu derrubaria outros logins web. Manter logout global como ação explícita. Atualmente sua interface aparece no console, enquanto as configurações do painel usam `showSessions={false}`. Oferecê-la também no painel é decisão de produto separada.

A política real de múltiplas sessões depende do Supabase hospedado. Conferir Single session per user, timebox e inactivity timeout antes de afirmar que logins simultâneos estão garantidos. Remover Expo não justifica habilitar single-session.

### Sessões antigas não desaparecem com os arquivos

O login biométrico chama `auth.admin.generateLink` e `verifyOtp` (`device-contract.service.ts:126,133`) e entrega uma sessão Supabase comum. O contrato não guarda os IDs das sessões emitidas. A leitura remota confirma que a tabela não tem uma coluna de associação a `auth.sessions`.

Revogar um contrato impede novas autenticações com aquele segredo, mas não encerra os refresh tokens emitidos. Remover a rota de refresh Express também não revoga tokens que poderiam ser apresentados diretamente ao Supabase.

É necessário inventariar sessões e decidir o corte: se não houver vínculo confiável, a opção mais segura é revogar sessões das contas nativas afetadas, aceitando que elas também precisarão entrar novamente no web. Nem todo usuário que usou Expo precisa ter cadastrado biometria; o único contrato encontrado não delimita sozinho todas as contas afetadas. Não excluir sessões por user agent, IP ou método magiclink como se identificassem exclusivamente Expo. Não apagar `auth.users`, perfis ou papéis.

Antes da revogação, fechar emissão/registro e drenar requisições. O contrato é conferido antes de chamadas externas e não é revalidado atomicamente junto à emissão; uma requisição em andamento pode criar sessão após uma revogação concorrente.

### Limites do logout e mudança de senha

Supabase revoga refresh tokens no logout, mas access JWTs já emitidos podem continuar válidos até `exp`. A aplicação não tem uma checagem geral de `session_id` contra `auth.sessions` nas políticas/RPCs revisadas. `getUser()` e os guards validam identidade/papel, sem constituir uma garantia universal de revogação imediata para todos os canais.

O arquivo local configura `jwt_expiry=3600`, refresh rotation ligada e tolerância de reutilização de 10 segundos. Esses valores cloud não foram confirmados. Não prometer que logout global fecha imediatamente todas as abas, APIs e conexões Realtime.

Fontes oficiais: [Sign out](https://supabase.com/docs/guides/auth/signout), [Sessions](https://supabase.com/docs/guides/auth/sessions).

O logout global atual tem duas operações remotas: limpa dispositivos/push e depois encerra Auth. Uma falha na segunda deixa efeitos parciais. A nova mensagem deve refletir isso sem afirmar “nada foi encerrado” depois de alterações já feitas.

`changeMyPassword` reautentica por senha e depois usa `updateUser` (`apps/web/src/server/dal/profile.ts:78`). O trigger biométrico em `auth.users` precisa sair antes da tabela de contratos; deixá-lo com referência inválida pode bloquear mudanças de senha.

## 5. Backend: o que retirar e o que manter

| Componente | Destino recomendado |
|---|---|
| `features/auth/*` e `/auth/*` | Encerrar após definir corte de sessões; retirar emissão biométrica e transporte de tokens mobile |
| `features/invitations/*` e `/platform/invitations/*` | Encerrar se logs/inventário não mostrarem outro consumidor |
| `features/restaurants/*` e `/platform/restaurants/*` | Mesma condição; Next tem DAL própria |
| `features/notifications/*` e `/notifications/*` | Retirar API do cliente nativo; preservar notificações no banco/web |
| `features/push/expo-push.ts` | Retirar |
| Ramo Expo e poda de tokens em `push.service.ts` | Retirar, conservando envio/poda Web Push |
| `/internal/push/deliver`, `web-push.ts`, `/healthz` | Manter no Express reduzido |
| Middleware de auth e integração Supabase admin | Retirar quando não houver outros consumidores |
| `SUPABASE_SECRET_KEY` | Pode sair do serviço reduzido após retirar todos os consumidores admin; envio web usa anon client + `APP_SERVER_KEY` |
| `PANEL_PUBLIC_URL` | Pode sair com os serviços de convites que geram URLs |
| `EXPO_ACCESS_TOKEN` | Retirar do schema, tipo, exemplos e ambientes onde existir |
| VAPID privada/pública/subject, `APP_SERVER_KEY`, Supabase URL/anon | Manter no emissor web |
| CORS | Não é necessário para a chamada servidor-servidor do Next; remover permissões sem consumidor confirmado |
| Trusted proxies, cabeçalhos, limites de corpo, logs e healthcheck | Reavaliar segundo a hospedagem; não são resíduos do Expo por definição |

Evidências: `apps/backend/src/config/env.ts:9–74`, `app.ts:8–42`, `routes/v1.routes.ts:10–15`, `features/push/push.service.ts:23–66`, `push.routes.ts:14–29`.

CORS não impede aplicativos nativos nem chamadas diretas ao Supabase. Reduzi-lo não substitui fechar endpoints, revogar RPCs específicas e tratar sessões.

O pacote `api-contracts` pode sair por completo se, após a redução do Express, não restar consumidor. Isso inclui envelopes de resposta/erro, além de DTOs de auth. Caso algo permaneça, reduzir o pacote ou mover os tipos restantes explicitamente; não apagar baseado apenas nos imports do Next.

## 6. Supabase: mapa de dependências

### Preservar

- Auth e suas tabelas de usuários, identidades, sessões e refresh tokens; alteração seletiva de sessões exige política de corte, não exclusão de estruturas.
- `profiles`, `platform_admins`, memberships, papéis e guards/RLS.
- Restaurantes, cardápios, mídia/Storage, tags/mesas, feedbacks e chamados.
- `notifications`, `push_subscriptions`, broadcasts e políticas privadas Realtime.
- `app_server_keys`, validação da chave e RPCs de feedback/chamados.
- `list_platform_admin_invites`, `get_platform_admin_invite`, `rotate_platform_admin_invite`.
- Auditoria e rate limit usados pelo web.
- `send_test_notification`: é a função do botão de diagnóstico do produto web, não uma suíte de testes nem recurso Expo.

As RPCs de listagem/detalhe/rotação vêm de migrations com “mobile” no nome. O Next as chama em `apps/web/src/server/dal/invites.ts:188,205,222`. **Não apagar `0016`/`0017` nem o histórico por associação de nome.**

### Reescrever antes de remover tabelas

| Objeto | Mudança |
|---|---|
| `revoke_all_my_devices()` | Remover atualização de contratos e manter limpeza do Web Push do próprio usuário |
| `claim_notification_pushes(text)` | Remover join/ramo Expo; manter autorização, claim atômico e entrega web |
| Trigger de senha em `auth.users` | Remover explicitamente antes de retirar sua função/tabela referenciada |

Na transição do claim, conservar inicialmente as 14 colunas de `0033`, devolvendo somente `channel='web'` e campos Expo nulos. Isso permite compatibilidade com o backend atual e `CREATE OR REPLACE` sem mudar o tipo de retorno. A forma final pode eliminar essas colunas numa etapa coordenada; mudar retorno exige recriar a função e revisar dependências/grants.

### Remover prospectivamente

- `register_mobile_device_contract(uuid,bytea)`;
- `get_mobile_device_contract(uuid,bytea)`;
- `revoke_mobile_device_contract(uuid,bytea,text)`;
- `is_my_device_contract_active(uuid)`;
- trigger e função `revoke_device_contracts_on_password_change`;
- tabela `platform_admin_device_contracts`;
- `save_mobile_push_token(text,text,text)`;
- `delete_mobile_push_token(text)`;
- `server_prune_mobile_push_tokens(text,text[])`;
- tabela `mobile_push_tokens`;
- overloads antigos apenas se realmente presentes no catálogo.

`create_platform_admin_invite` e `revoke_platform_admin_invite` são candidatos condicionais: backend os chama, Next faz as escritas por sua DAL. As funções não apareceram no OpenAPI consultado, o que exige conferir existência/ACL no catálogo antes de tirar conclusões.

Usar migrations novas após `0034`; não editar arquivos já aplicados. Remover dependências explicitamente e usar `RESTRICT`, sem `CASCADE`. O catálogo não detecta toda referência em corpos PL/pgSQL: procurar também nomes de tabelas/funções nos corpos e nos triggers.

### Inconsistências de documentação do banco

`supabase/schema.sql` agrega `0001–0015` e depois `0023/0024`; omite outras migrations, inclusive o mecanismo atual de auth/notificações. Não representa o catálogo remoto. Não reaplicá-lo para fazer a retirada. Gerar a representação final a partir de uma fonte consolidada e reconciliada.

`supabase/config.toml` aponta o seed `./seed.sql`, ausente; existe `seed/bootstrap-admin.sql`. Rever essa configuração local, sem executar bootstrap em ambiente existente.

## 7. Push e PWA

Preservar o par VAPID atual. Trocá-lo desnecessariamente força reinscrição dos navegadores. A única inscrição web encontrada não deve ser apagada pela descontinuação nativa.

O Expo atual já não registra notificações: `remove-legacy-mobile-push-token.ts` apenas tenta apagar um token legado ao abrir/sair. Isso não substitui limpeza no servidor, porque usuários podem nunca reabrir o aplicativo. Apesar disso, backend e SQL ainda suportam registro e envio Expo.

PWA e Web Push continuam disponíveis conforme suporte do navegador; no iOS o fluxo depende da instalação na Tela de Início. O service worker oferece fallback offline, não funcionamento completo sem conexão. Nada disso depende de conservar `apps/mobile`.

O emissor atual faz uma tentativa após reivindicar notificações; marca `push_claimed_at` antes do envio, usa lote de até 200 e janela de 10 minutos (`0033:131–145`). `scheduleDelivery()` usa `setImmediate` fora da resposta HTTP (`push.service.ts:71`). Não há retry persistido identificado.

Se futuramente migrar o envio para Next/ambiente serverless, não copiar `setImmediate` sem considerar o ciclo de vida da hospedagem. Definir processamento durável, limite/continuidade de lotes e observabilidade. Esse risco favorece separar a retirada do Expo da migração do emissor web.

## 8. Achados de segurança adicionais

Estes pontos existiam antes da descontinuação. Alguns desaparecem com a remoção do mecanismo nativo; outros exigem trabalho web/Supabase próprio.

| Prioridade | Achado e evidência | Tratamento |
|---|---|---|
| Alta, durante o corte | Registro de contrato via RPC aceita usuário admin autenticado sem senha recente/checagem de sessão viva (`0028:54,66,215`). Um JWT ainda válido após logout pode potencialmente reativar um contrato enquanto o emissor continuar ativo. | Fechar registro direto e emissão antes de revogar sessões/contratos |
| Alta, condicionada à implantação | Destino Web Push aceita HTTPS arbitrário (`domain/push.ts:10`, `0031:51`); o backend faz requisição a esse endpoint (`web-push.ts:30`). Há potencial de SSRF cego conforme a rede acessível pelo serviço. | Restringir destinos/egress e considerar resolução DNS/redirecionamentos; hipótese não explorada |
| Média, evidência estática | `internalPathSchema` barra `//` e `/\\`, mas não controles; `"/\t/host.example"` pode normalizar para destino externo no navegador (`domain/common.ts:38`, formulário chama `location.replace`). | Rejeitar controles e validar origem do URL normalizado; não reproduzido em execução |
| Média | `client-ip.ts:14` confia no primeiro `x-forwarded-for`. Sua confiabilidade depende do proxy real. | Usar fonte de IP garantida pela hospedagem e bloquear bypass do proxy |
| Média | `record_audit` tem grant para authenticated, mas o histórico não revoga EXECUTE de PUBLIC (`0005:80–113`). | Conferir privilégios efetivos; evitar chamadas anônimas e metadata tratada como prova confiável |
| Média | `check_rate_limit` aceita bucket, identificador, limite e janela do chamador (`0005:42`). | Endurecer autorização/validação; não tratar apenas a validação Next como barreira a RPC direta |
| Média | Logout local web ignora erro do Auth (`session.ts:120`); backend também informa sucesso ignorando retorno de revogação. | No web, definir comportamento entre limpar cookie e confirmar revogação remota |
| Média | Logout global apaga Web Push, mas não `mobile_push_tokens` (`0028:177`). | Desativar entrega/registro Expo no corte; zero tokens no projeto consultado não corrige o código |
| Revisão | Server Actions permitem domínio público, admin e painel em `allowedOrigins`; cookies host-only não impedem por si só solicitações same-site entre subdomínios (`next.config.ts:41`). | Confirmar necessidade das origens cruzadas e fronteiras de confiança |
| Revisão | Cookies SSR não são configurados HttpOnly e Realtime recebe access JWT no navegador (`_client.ts:10`, `notifications.ts:127`); CSP permite inline e conexões amplas (`next.config.ts:17,32`). | Revisão integrada de cookies/Realtime/CSP, sem edição isolada que quebre auth |
| Revisão | Auth local exige senha mínima 6, formulários web exigem 8; estado remoto só confirmou autoconfirmação/signup. | Alinhar política Auth hospedada e aplicação; conferir senha comprometida, rate limits e MFA conforme necessidade |
| Alta para higiene de credenciais | Os `.gitignore` examinados na raiz/web/mobile e `.git/info/exclude` não contêm regra para `.env`/`.env.local`; backend tem arquivo com segredo. | Proteger os arquivos locais e preservar `.env.example`; não foi verificado rastreamento/histórico ou ignore global, portanto não se afirma vazamento |

Ativar confirmação de email ou mudar recuperação exige revisar redirects, templates e callbacks web. Não fazer essa alteração como uma suposta limpeza de Expo sem preparar o fluxo web correspondente.

## 9. Workspace e serviços externos

Limpar `package.json` raiz: aliases Expo/mobile, filtro de mobile em `dev`, extensão de pacote Gluestack quando não houver consumidor, e referências a contratos que deixarem de existir. `concurrently` está declarado mas os scripts usam o runner pnpm; avaliar remoção por consumo. `pnpm-workspace.yaml` usa globs, não exige lista nova só por apagar mobile. Não remover overrides/allowBuilds sem conferir dependências restantes; esbuild e tooling CSS também atendem backend/web.

Atualizar lockfile com pnpm junto dos manifests. Revisar `.vscode/extensions.json`, `.gitignore`, documentação de API/deploy, README e AGENTS. Proteger segredos continua necessário mesmo quando padrões Expo forem removidos.

O projeto mobile configura scheme `tavvimobile`, pacote Android `com.tavvi.mobile`, projeto EAS e perfis internos development/preview. Isso não comprova distribuição em lojas. Inventariar, se existirem, builds/APKs compartilhados, links, projetos EAS, automações, tokens dedicados, credenciais de distribuição, notificações Expo/APNs/FCM e redirecionamentos `tavvimobile://`/`exp://` no Supabase. Não revogar recursos que também tenham consumidores web.

Não foram encontradas configurações de deploy/CI que comprovem o estado de Vercel/Railway/DNS/CDN. Conferir root directory web, monitoramento do Express, hosts/URLs, variáveis e secrets diretamente no provedor. Não remover hostname usado pelo push enquanto a chamada do Next permanecer.

## 10. Condições para encerrar com segurança

1. Projeto Supabase e ambientes reais identificados; diferença entre migrations, schema e catálogo reconciliada.
2. Logout global e claim web desacoplados dos objetos nativos.
3. Emissão/registro nativos fechados, requisições em andamento drenadas e política para sessões antigas concluída.
4. Web Push continua com VAPID/inscrições preservadas e emissor operacional.
5. Trigger de senha, RPCs e tabelas nativos retirados numa ordem explícita.
6. Nenhum consumidor atual referencia objetos/pacotes removidos; tipos, manifests, lockfile, ambientes e docs coerentes.
7. Serviços de distribuição e credenciais exclusivamente Expo encerrados conforme inventário.

O plano de execução está em [2026-10-02-descontinuacao-expo.md](../../superpowers/plans/2026-10-02-descontinuacao-expo.md). As lacunas de produção permanecem explícitas; a inspeção estática não é uma garantia de funcionamento em execução.
