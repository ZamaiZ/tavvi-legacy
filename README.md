# Tavvi Mobile

Console mobile privado para administradores da plataforma Tavvi. O app usa Expo Router, Supabase Auth e API routes versionadas no próprio projeto Expo.

## Desenvolvimento

1. Copie `.env.example` para `.env.local` e preencha as variáveis públicas e server-only do ambiente escolhido.
2. Em aparelho físico, use o IP LAN da máquina em `EXPO_PUBLIC_API_URL`; `localhost` aponta para o próprio aparelho.
3. Inicie com `npx expo start` e abra pelo Expo Go ou por um development build.

As rotas `/api/mobile/v1/*` são servidas pelo mesmo processo local do Expo. O cliente nunca importa módulos de `src/server/`; a autorização administrativa é revalidada no servidor a cada requisição.

## Escopo atual

- Login exclusivo de `platform_admin`, com sessão persistida no SecureStore.
- Convites de plataforma: listar, criar, copiar e revogar.
- Restaurantes: consulta somente leitura.
- Tema Sistema, Claro e Escuro; dock móvel inspirado na navegação do nfc-menu.

O cache de listas é somente memória. O link de convite recém-criado existe apenas no painel aberto até ser copiado ou descartado.

## Separação de ambientes

Consulte [docs/deployment/eas-hosting.md](docs/deployment/eas-hosting.md) para a configuração de API routes no EAS Hosting.
