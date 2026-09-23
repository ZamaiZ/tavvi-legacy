# API routes no EAS Hosting

O bundle web deste projeto usa `web.output: server` para executar as Expo Router API routes no EAS Hosting/Cloudflare Workers. O deploy não faz parte desta etapa.

## Variáveis públicas do app

- `EXPO_PUBLIC_API_URL`: URL absoluta da API, sem depender de `localhost` em produção.
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## Variáveis server-only

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `PAINEL_PUBLIC_URL`: origem HTTPS que recebe os links `/convite/{token}`.

As chaves server-only nunca devem usar o prefixo `EXPO_PUBLIC_` e nenhuma service-role key é necessária. O deploy deve ser autorizado e configurado separadamente; `eas deploy` permanece bloqueado nesta etapa porque exporta o bundle web antes de publicar.
