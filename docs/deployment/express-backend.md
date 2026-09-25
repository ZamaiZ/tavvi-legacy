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
- `PAINEL_PUBLIC_URL`: origem HTTPS do painel que recebe os links `/convite/{token}`.
- `TRUSTED_PROXIES`: lista opcional de IPs/CIDRs de proxies controlados, separada por vírgulas. Vazio significa que headers encaminhados não são confiáveis.
- `CORS_ORIGINS`: allowlist opcional de origens exatas para clientes web. O app nativo não precisa de CORS.

Nenhuma service-role key é necessária. Não exponha essas variáveis no `.env` do app ou em qualquer variável com prefixo `EXPO_PUBLIC_`.

## Pré-requisitos de produção

Antes de escolher hospedagem, configure TLS, domínio, armazenamento de segredos, reinício do processo, health checks e a relação exata de proxies confiáveis. Configure CORS somente se clientes web forem autorizados. Defina retenção e acesso aos logs conforme a política interna de privacidade.

A migration `supabase/migrations/0017_mobile_admin_atomic_invite_writes.sql` adiciona RPCs de criação e revogação com auditoria na mesma transação. Ela precisa ser revisada e aplicada pelo processo de mudanças do projeto Supabase compartilhado; este guia não executa migrações remotas.
