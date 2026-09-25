# Tavvi Mobile

Console mobile privado para administradores da plataforma Tavvi. O app usa Expo Router, SecureStore e uma API Express independente em `tavvi-backend/`. O Express é a única fronteira do app para autenticação, convites e restaurantes; Supabase Auth e dados são acessados somente pelo servidor.

## Desenvolvimento local

O serviço Express requer Node.js 22.9 ou mais recente.

1. Copie `.env.example` para `.env.local` e configure `EXPO_PUBLIC_API_URL` com o endereço do Express acessível pelo dispositivo. Em aparelho físico, use o IP LAN da máquina; `localhost` aponta para o próprio aparelho.
2. Copie `tavvi-backend/.env.example` para `tavvi-backend/.env` e preencha os valores server-only do ambiente Supabase e `PAINEL_PUBLIC_URL`.
3. Em um terminal, inicie o backend a partir de `tavvi-backend/` com `pnpm dev`.
4. Em outro terminal, inicie o app com `npx expo start` e abra pelo Expo Go ou por um development build.

Os processos Expo e Express são independentes. A API não é servida por Expo Router, e as credenciais Supabase não fazem parte das variáveis do bundle móvel. Nenhuma publicação do backend está configurada neste repositório.

## Escopo atual

- Login, restauração, renovação e encerramento de sessão de `platform_admin`.
- Convites de plataforma: listar, consultar, criar, copiar, rotacionar e revogar.
- Restaurantes: consulta somente leitura de lista e detalhe.
- Tema Sistema, Claro e Escuro; dock móvel.

O cache de listas é somente memória. O link de convite recém-criado existe apenas no painel aberto até ser copiado ou descartado.

## Backend e API

- O serviço e as variáveis locais estão descritos em [docs/deployment/express-backend.md](docs/deployment/express-backend.md).
- O contrato HTTP atual está em [docs/api/mobile-v1.md](docs/api/mobile-v1.md).
- A migration aditiva de auditoria para mutações de convite deve passar pelo fluxo existente de alterações do Supabase antes do deploy do serviço. Ela não é aplicada automaticamente pelo app.
