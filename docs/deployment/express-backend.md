# Tavvi Mobile Express API

O backend móvel é um processo Node.js/Express independente em `tavvi-backend/`. Nenhum provedor de hospedagem está escolhido ou configurado. O deploy em produção não faz parte desta etapa.

## Execução local

1. Instale as dependências dentro de `tavvi-backend/` com pnpm.
2. Copie `.env.example` para `.env` e preencha as variáveis server-only.
3. Inicie em modo de desenvolvimento com `pnpm dev`.
4. Use `GET /healthz` para verificar se o processo responde.
5. Configure o app com `EXPO_PUBLIC_API_URL` apontando para a origem e porta do Express. No dispositivo físico, use o IP LAN do computador.

## Variáveis do servidor

O serviço requer Node.js 22.9 ou mais recente. Os scripts `dev` e `start` carregam `tavvi-backend/.env` quando o arquivo existe; variáveis já definidas pelo ambiente têm precedência.

- `PORT`: porta HTTP local, padrão `3001`.
- `NODE_ENV`: `development` ou `production`.
- `SUPABASE_URL`: origem do projeto Supabase.
- `SUPABASE_ANON_KEY`: anon/publishable key; operações de dados usam o bearer token do usuário para manter RLS.
- `DEVICE_CONTRACT_ENCRYPTION_KEY`: segredo server-only em Base64 que decodifica para exatamente 32 bytes aleatórios. Gere um valor diferente por ambiente e guarde-o no gerenciador de segredos do backend. Nunca o copie para o app ou para `EXPO_PUBLIC_*`. Perder ou trocar a chave torna os refresh tokens biométricos existentes indecifráveis; usuários entram com senha e cadastram novamente. Nesta versão, a rotação é uma janela de manutenção que exige novo cadastro, sem migração dos ciphertexts antigos.
- `PAINEL_PUBLIC_URL`: origem HTTPS do painel que recebe os links `/convite/{token}`.
- `TRUSTED_PROXIES`: lista opcional de IPs/CIDRs de proxies controlados, separada por vírgulas. Vazio significa que headers encaminhados não são confiáveis.
- `CORS_ORIGINS`: allowlist opcional de origens exatas para clientes web. O app nativo não precisa de CORS.

Nenhuma service-role key é necessária. Não exponha essas variáveis no `.env` do app ou em qualquer variável com prefixo `EXPO_PUBLIC_`.

## Pré-requisitos de produção

Antes de escolher hospedagem, configure TLS, domínio, armazenamento de segredos, reinício do processo, health checks e a relação exata de proxies confiáveis. Configure CORS somente se clientes web forem autorizados. Defina retenção e acesso aos logs conforme a política interna de privacidade.

As migrations `0017_mobile_admin_atomic_invite_writes.sql` e `0018_mobile_device_contracts.sql` adicionam RPCs do painel móvel e os contratos biométricos por instalação. Elas precisam ser revisadas e aplicadas pelo processo de mudanças do projeto Supabase compartilhado; este guia não executa migrações remotas.

## APK Android com biometria

`eas.json` define o perfil `preview` para distribuição interna em formato APK. Antes do primeiro build na nuvem, vincule este app a um projeto EAS; nenhum `projectId` foi inventado neste repositório. Configure `EXPO_PUBLIC_API_URL` no ambiente EAS chamado `preview`, com a origem HTTPS completa do Express e sem barra final ou caminho `/api`.

O build local lê `.env.local`, mas o build em nuvem não herda esse arquivo. Copie para EAS a origem HTTPS atual do ngrok ou configure um hostname ngrok reservado. Se o hostname temporário mudar, atualize `EXPO_PUBLIC_API_URL` no EAS e gere outro APK; o endereço anterior fica incorporado no APK já distribuído.

O plugin `expo-local-authentication` preserva a mensagem Face ID do iOS e `expo-secure-store` mantém o backup Android configurado. A autenticação protegida por biometria exige build nativo; Expo Go não é suficiente. O identificador Android configurado é `com.tavvi.mobile`; confirme que ele não foi distribuído por outro app Tavvi antes de publicar em loja.

Antes de iniciar o backend, configure `DEVICE_CONTRACT_ENCRYPTION_KEY` também no ambiente que executa Express. Por exemplo, `openssl rand -base64 32` gera o valor Base64 para o gerenciador de segredos; não o registre em log nem o inclua em variáveis públicas.
