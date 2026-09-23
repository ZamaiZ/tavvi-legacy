# Tavvi Mobile Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Do not dispatch subagents unless the user explicitly authorizes that execution mode.

**Goal:** Entregar um aplicativo Expo nativo para administradores da plataforma entrarem, gerenciarem convites e consultarem restaurantes, com sessão segura, API própria no Expo Router e a identidade visual privada do `nfc-menu`.

**Architecture:** O mesmo repositório conterá duas fronteiras separadas: o cliente React Native e as rotas `+api.ts` executadas no EAS Hosting. O cliente só conhece DTOs versionados e usa Supabase diretamente apenas para persistir/renovar a sessão; toda autorização e todo acesso administrativo passam pela API com Bearer token, anon key, RLS e verificação explícita de `platform_admin`.

**Tech Stack:** Expo SDK 57, React Native 0.86, Expo Router 57, TypeScript 6, Supabase JS, TanStack Query, SecureStore, Gluestack UI, NativeWind 5 preview, `@expo/ui`, Reanimated 4, Expo Blur, Expo Haptics e Inter.

**Spec:** `docs/superpowers/specs/2026-09-22-tavvi-mobile-admin-design.md`

## Global Constraints

- Plataformas de aceite: iOS e Android; web existe apenas como artefato necessário às API routes.
- Não alterar, importar nem implantar código de `C:\Users\Eduardo Zamai\Documents\nfc-menu`; ele é somente referência visual e de regras.
- Não criar nem editar diretórios `ios/` e `android/`; o projeto usa Continuous Native Generation.
- Não usar service-role key. Cliente e servidor usam somente as anon keys próprias de cada ambiente e a sessão do usuário.
- Não importar nenhum módulo de `src/server/` em componentes, hooks, providers ou módulos do cliente.
- Não persistir listas administrativas, resposta de convite criado ou fila de mutações.
- O token em claro de um convite só pode existir na resposta da criação e no estado do painel aberto.
- Não executar `git`, `typecheck`, `build`, `lint` ou `test`; não criar testes automatizados.
- Não executar `eas deploy`: o comando exporta o bundle web e permanece bloqueado pela proibição de build.
- Instalar dependências somente com `npx expo install`, pois o projeto não usa Bun.
- Todas as fontes, ícones essenciais e elementos de login/navegação devem estar locais no binário.
- Toda tela remota deve distinguir carregamento inicial, erro, vazio e conteúdo; erro de atualização pode coexistir com conteúdo em memória.
- Mutações de criação e revogação usam `retry: false` e ficam inacessíveis enquanto estiverem pendentes.
- O dock mantém 12dp laterais/inferiores, 68dp de altura, botões laterais 44×44dp e botão central 58×58dp elevado 14dp.
- A animação do dock e dos painéis usa somente `transform` e `opacity`, roda no UI runtime e respeita reduced motion.

## Review Focus

1. **Sessão maior que o limite confortável de uma entrada do SecureStore:** Task 3 fragmenta o valor em blocos de 1.800 caracteres, alterna bancos A/B e só troca o ponteiro após gravar todos os blocos; a verificação manual inclui fechar e reabrir o app.
2. **Duas requisições recebem `401` ao mesmo tempo:** Task 3 usa uma única promessa de refresh, repete cada chamada no máximo uma vez e limpa a sessão se a renovação falhar.
3. **Convite muda de estado entre confirmação e revogação:** Task 5 faz update condicional, refaz a leitura quando zero linhas forem alteradas e diferencia revogado idempotente de resgatado/vencido em conflito.
4. **Link recém-criado é descartado sem cópia:** Task 8 remove o link do cache de mutação, intercepta dismiss/back e exige confirmação antes de destruir o estado efêmero.
5. **Restaurante removido logicamente ainda aparece:** Task 9 mantém o registro na lista, deriva o rótulo `Removido` de `deletedAt` e usa apresentação neutra, sem ação ou navegação.

## Mapa final de arquivos

```text
app.json
babel.config.js
package.json
pnpm-lock.yaml
tsconfig.json
.env.example
docs/deployment/eas-hosting.md

src/
  app/
    _layout.tsx
    (auth)/
      _layout.tsx
      entrar.tsx
    (app)/
      _layout.tsx
      index.tsx
      restaurantes.tsx
    api/mobile/v1/
      session+api.ts
      invites+api.ts
      invites/[id]/revoke+api.ts
      restaurants+api.ts
  components/
    primitives/
      app-button.tsx
      app-text.tsx
      form-field.tsx
      screen-header.tsx
      skeleton-card.tsx
      state-view.tsx
      status-badge.tsx
      surface.tsx
      theme-selector.tsx
    shell/
      adaptive-blur-surface.tsx
      app-shell.tsx
      mobile-dock.tsx
  contracts/mobile-api.ts
  features/
    auth/
      auth-context.tsx
      login-screen.tsx
    invitations/
      create-invitation-sheet.tsx
      invitation-card.tsx
      invitations-screen.tsx
      queries.ts
    restaurants/
      queries.ts
      restaurant-card.tsx
      restaurants-screen.tsx
  lib/
    api-client.ts
    connectivity.ts
    format.ts
    query-client.ts
    secure-store-adapter.ts
    supabase.ts
  providers/app-providers.tsx
  server/
    auth.ts
    database.types.ts
    env.ts
    http.ts
    invitations.ts
    restaurants.ts
    security.ts
    supabase.ts
  theme/
    theme-context.tsx
    tokens.ts
    typography.ts
    index.ts
  global.css
```

Os primitives Gluestack gerados permanecem em `components/ui/` e são importados com `@ui/*`. Código não relacionado a rotas nunca entra em `src/app/`.

---

### Task 1: Corrigir a fundação Expo, aliases e dependências

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml` por meio do instalador do Expo
- Modify: `tsconfig.json`
- Modify: `babel.config.js`
- Modify: `app.json`
- Modify: `src/app/_layout.tsx`
- Modify: imports existentes sob `src/`
- Create: `.env.example`

**Interfaces:**
- Consumes: Expo `~57.0.24`, Router `~57.0.22`, NativeWind 5 preview e primitives em `components/ui/`.
- Produces: aliases únicos `@/*`, `@ui/*`, `@assets/*`; Metro capaz de resolver `src/components/animated-icon.tsx`; dependências compatíveis com SDK 57.

- [ ] **Step 1: Instalar as dependências compatíveis com o SDK**

Executar somente:

```powershell
npx expo install @supabase/supabase-js @tanstack/react-query zod expo-secure-store expo-clipboard expo-haptics expo-blur @react-native-community/netinfo @expo-google-fonts/inter
```

Depois executar `pnpm remove -D babel-plugin-module-resolver` para retirar a dependência e atualizar o lockfile; não adicionar outro gerenciador.

- [ ] **Step 2: Tornar os aliases não ambíguos**

Substituir os paths do `tsconfig.json` por:

```json
{
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@ui/*": ["./components/ui/*"],
      "@assets/*": ["./assets/*"]
    }
  }
}
```

Normalizar imports: código em `src` usa formas como `@/components/animated-icon`, primitives gerados usam formas como `@ui/button`, assets usam formas como `@assets/images/icon.png` e o CSS global usa `@/global.css`.

- [ ] **Step 3: Remover a segunda autoridade de resolução do Babel**

Manter apenas os presets necessários e deixar o Expo configurar Worklets:

```js
module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo', 'nativewind/babel'],
  }
}
```

- [ ] **Step 4: Preparar API routes e módulos nativos no app config**

Em `app.json`:

```json
{
  "expo": {
    "web": { "output": "server", "favicon": "./assets/images/favicon.png" },
    "plugins": [
      "expo-router",
      ["expo-secure-store", { "configureAndroidBackup": true }],
      [
        "expo-font",
        {
          "android": {
            "fonts": [
              {
                "fontFamily": "Inter",
                "fontDefinitions": [
                  { "path": "./node_modules/@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf", "weight": 400 },
                  { "path": "./node_modules/@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf", "weight": 500 },
                  { "path": "./node_modules/@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf", "weight": 600 },
                  { "path": "./node_modules/@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf", "weight": 700 }
                ]
              }
            ]
          },
          "ios": {
            "fonts": [
              "./node_modules/@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf",
              "./node_modules/@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf",
              "./node_modules/@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf",
              "./node_modules/@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf"
            ]
          }
        }
      ],
      [
        "expo-splash-screen",
        {
          "backgroundColor": "#FBFAF8",
          "image": "./assets/images/splash-icon.png",
          "imageWidth": 88,
          "dark": { "backgroundColor": "#111114", "image": "./assets/images/splash-icon.png" }
        }
      ]
    ]
  }
}
```

- [ ] **Step 5: Documentar todas as variáveis sem valores reais**

Criar `.env.example`:

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.0.10:8081
EXPO_PUBLIC_SUPABASE_URL=https://project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=public-anon-key

SUPABASE_URL=https://project-ref.supabase.co
SUPABASE_ANON_KEY=public-anon-key
PAINEL_PUBLIC_URL=https://painel.example.com
```

Registrar no comentário do arquivo que a URL nativa local deve usar o IP LAN acessível pelo aparelho, não `localhost`.

- [ ] **Step 6: Verificar a correção inicial permitida**

Executar `npx expo start --clear`, observar que o Metro não relata `Unable to resolve ../../components/animated-icon` e encerrar o processo. Não executar comandos proibidos.

---

### Task 2: Implantar o sistema visual Tavvi como fonte única

**Files:**
- Create: `src/theme/tokens.ts`
- Create: `src/theme/typography.ts`
- Create: `src/theme/theme-context.tsx`
- Create: `src/theme/index.ts`
- Modify: `src/global.css`
- Modify: `components/ui/gluestack-ui-provider/index.tsx`
- Create: `src/components/primitives/app-text.tsx`
- Create: `src/components/primitives/app-button.tsx`
- Create: `src/components/primitives/form-field.tsx`
- Create: `src/components/primitives/surface.tsx`
- Create: `src/components/primitives/screen-header.tsx`
- Create: `src/components/primitives/skeleton-card.tsx`
- Create: `src/components/primitives/state-view.tsx`
- Create: `src/components/primitives/status-badge.tsx`
- Create: `src/components/primitives/theme-selector.tsx`

**Interfaces:**
- Consumes: preferência `'system' | 'light' | 'dark'` e cores convertidas dos tokens privados do `nfc-menu`.
- Produces: `useAppTheme(): { preference, resolved, colors, setPreference }`, `tokens`, `typeStyles` e primitives acessíveis usados por todas as telas.

- [ ] **Step 1: Definir paletas sRGB tipadas e escalas imutáveis**

`tokens.ts` deve declarar exatamente:

```ts
export const palettes = {
  light: {
    background: '#FFFFFF', foreground: '#09090B',
    surface1: '#FBFAF8', surface2: '#FFFFFF', surface3: '#FFFFFF',
    primary: '#00786F', primaryForeground: '#F0FDFA',
    secondary: '#F6F5F2', secondaryForeground: '#1C1915',
    muted: '#F6F5F2', mutedForeground: '#78726C',
    accent: '#F4F2EE', accentForeground: '#1C1915',
    destructive: '#E7000B', border: '#E7E5E1', input: '#E7E5E1', ring: '#00877D',
    statusDraft: '#78726C', statusDraftBackground: '#F4F2EE',
    statusActive: '#267D30', statusActiveBackground: '#DFF6DE',
    statusSuspended: '#A06700', statusSuspendedBackground: '#FFF0CC',
  },
  dark: {
    background: '#09090B', foreground: '#FAFAFA',
    surface1: '#111114', surface2: '#18181B', surface3: '#212124',
    primary: '#005F5A', primaryForeground: '#F0FDFA',
    secondary: '#27272A', secondaryForeground: '#FAFAFA',
    muted: '#27272A', mutedForeground: '#9F9FA9',
    accent: '#27272A', accentForeground: '#FAFAFA',
    destructive: '#FF6467', border: 'rgba(255,255,255,0.10)', input: 'rgba(255,255,255,0.15)', ring: '#39B6A5',
    statusDraft: '#A5A099', statusDraftBackground: '#292622',
    statusActive: '#79C77C', statusActiveBackground: '#1A2F1B',
    statusSuspended: '#E7AF5C', statusSuspendedBackground: '#382810',
  },
} as const

export const spacing = { x1: 4, x2: 8, x3: 12, x4: 16, x5: 20, x6: 24, x8: 32, x12: 48 } as const
export const radii = { sm: 8, md: 10, lg: 16, dockCenter: 18, full: 999 } as const
export const shadows = {
  light: { low: '0 1px 2px rgba(70,58,45,0.05), 0 1px 3px rgba(70,58,45,0.04)', raised: '0 2px 4px rgba(70,58,45,0.05), 0 8px 20px rgba(70,58,45,0.07)' },
  dark: { low: '0 1px 2px rgba(0,0,0,0.30)', raised: '0 2px 4px rgba(0,0,0,0.30), 0 8px 20px rgba(0,0,0,0.35)' },
} as const
export const motion = { press: 120, fast: 150, panelIn: 220, panelOut: 160, easeOut: [0.16, 1, 0.3, 1] as const } as const
```

- [ ] **Step 2: Centralizar a tipografia Inter**

`typography.ts` exporta exatamente esta rampa; metadados numéricos e datas acrescentam `fontVariant: ['tabular-nums']`. Nenhum componente desativa `allowFontScaling`.

```ts
export const typeStyles = {
  display: { fontFamily: 'Inter', fontSize: 28, lineHeight: 34, fontWeight: '700' },
  title: { fontFamily: 'Inter', fontSize: 20, lineHeight: 26, fontWeight: '600' },
  heading: { fontFamily: 'Inter', fontSize: 16, lineHeight: 22, fontWeight: '600' },
  body: { fontFamily: 'Inter', fontSize: 15, lineHeight: 22, fontWeight: '400' },
  bodyMedium: { fontFamily: 'Inter', fontSize: 15, lineHeight: 22, fontWeight: '500' },
  label: { fontFamily: 'Inter', fontSize: 14, lineHeight: 20, fontWeight: '600' },
  meta: { fontFamily: 'Inter', fontSize: 13, lineHeight: 18, fontWeight: '400' },
  caption: { fontFamily: 'Inter', fontSize: 12, lineHeight: 16, fontWeight: '500' },
} as const
```

- [ ] **Step 3: Persistir e resolver o tema corretamente**

O provider usa esta API:

```ts
export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'
export type AppThemeValue = {
  preference: ThemePreference
  resolved: ResolvedTheme
  colors: (typeof palettes)[ResolvedTheme]
  setPreference(next: ThemePreference): Promise<void>
  hydrated: boolean
}
```

Ler/gravar `tavvi.theme.preference` no SecureStore. Para `system`, chamar `Appearance.setColorScheme(null)` e observar `useColorScheme()`; para preferências explícitas, chamar `Appearance.setColorScheme('light' | 'dark')`. Atualizar `expo-system-ui` e a `StatusBar` com o tema resolvido.

- [ ] **Step 4: Alimentar NativeWind e Gluestack a partir da paleta tipada**

`global.css` mantém apenas imports e aliases sem valores de paleta duplicados:

```css
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/preflight.css" layer(base);
@import "tailwindcss/utilities.css";
@import "nativewind/theme";

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--surface-2);
  --color-popover: var(--surface-3);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
}
```

`ThemeProvider` passa os mesmos valores de `palettes[resolved]` por `VariableContextProvider` do `react-native-css`. O `GluestackUIProvider` deixa de forçar `mode="dark"` e deixa de chamar `Appearance.setColorScheme('system')`.

- [ ] **Step 5: Construir primitives mínimos e acessíveis**

Contratos obrigatórios:

```ts
type AppButtonProps = {
  label: string
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'icon'
  loading?: boolean
  disabled?: boolean
  icon?: React.ReactNode
  onPress: () => void
}

type StatusBadgeProps = {
  label: string
  tone: 'primary' | 'success' | 'warning' | 'muted' | 'danger'
}

type ThemeSelectorProps = {
  value: ThemePreference
  onChange(next: ThemePreference): void
  compact?: boolean
}
```

Usar `@ui/button` e `@ui/input` onde a primitive gerada atende; estados pressed têm feedback visual, alvos icon-only têm 44×44dp e `accessibilityLabel`, loading mantém as dimensões e informa `busy`. `ThemeSelector` é compartilhado pelo login e pelo popover Conta. `SkeletonCard` reproduz a geometria das duas listas e troca shimmer por pulso/fade curto quando reduced motion estiver ativo.

- [ ] **Step 6: Fazer inspeção estática do sistema visual**

Pesquisar por cores hex fora de `src/theme/` e por tamanhos repetidos fora dos tokens. Exceções permitidas: scrim preto translúcido e nudges ópticos documentados no próprio componente.

---

### Task 3: Definir o contrato móvel, persistência segura e cliente HTTP

**Files:**
- Create: `src/contracts/mobile-api.ts`
- Create: `src/lib/secure-store-adapter.ts`
- Create: `src/lib/supabase.ts`
- Create: `src/lib/api-client.ts`
- Create: `src/lib/query-client.ts`
- Create: `src/lib/connectivity.ts`
- Create: `src/lib/format.ts`

**Interfaces:**
- Consumes: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- Produces: DTOs compartilháveis, `supabase`, `apiRequest<T>()`, `publicApiRequest<T>()`, `registerSessionInvalidator()`, `queryClient`, formatadores `pt-BR`.

- [ ] **Step 1: Fixar DTOs e envelopes sem tipos do banco**

`mobile-api.ts`:

```ts
export type ApiSuccess<T> = { data: T }
export type ApiFailure = { error: { code: string; message: string } }

export type MobileUser = { id: string; email: string }
export type MobileSession = {
  accessToken: string
  refreshToken: string
  expiresAt: number
  expiresIn: number
  tokenType: 'bearer'
  user: MobileUser
}
export type SessionInfo = { user: MobileUser }

export type MobileInvite = {
  id: string
  email: string | null
  expiresAt: string
  redeemedAt: string | null
  revokedAt: string | null
}
export type CreateInviteInput = { email?: string; expiresInDays: number }
export type CreatedInvite = { id: string; link: string }
export type RevokedInvite = { id: string; revokedAt: string }

export type RestaurantStatus = 'draft' | 'active' | 'suspended'
export type MobileRestaurant = {
  id: string
  name: string
  slug: string
  segment: string | null
  status: RestaurantStatus
  deletedAt: string | null
}
```

- [ ] **Step 2: Implementar storage A/B fragmentado**

O adaptador do Supabase implementa:

```ts
export const secureStoreAdapter = {
  getItem(key: string): Promise<string | null>,
  setItem(key: string, value: string): Promise<void>,
  removeItem(key: string): Promise<void>,
}
```

Cada valor é dividido a cada 1.800 caracteres. Para cada chave, manter `pointer`, `a.meta`, `a.0..n`, `b.meta`, `b.0..n`. `setItem` grava o banco inativo inteiro, grava o metadata, troca o pointer e só então remove o banco antigo. `getItem` rejeita metadata inválido ou bloco ausente e limpa o valor corrompido. Usar `SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY` para escrita.

- [ ] **Step 3: Criar o cliente Supabase somente para autenticação nativa**

```ts
export const supabase = createClient(
  requirePublicEnv('EXPO_PUBLIC_SUPABASE_URL'),
  requirePublicEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY'),
  {
    auth: {
      storage: secureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      lock: processLock,
    },
  },
)
```

Não exportar helpers de `.from()` ou `.rpc()` no cliente; uso direto do Supabase fora deste módulo fica limitado a `auth`.

- [ ] **Step 4: Implementar HTTP tipado com refresh single-flight**

```ts
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) { super(message); this.name = 'ApiError' }
}

export type SessionInvalidationReason = 'expired' | 'forbidden'
export function registerSessionInvalidator(
  handler: (reason: SessionInvalidationReason) => Promise<void>,
): () => void

export async function publicApiRequest<T>(path: string, init?: RequestInit): Promise<T>
export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T>
```

`apiRequest` obtém o access token atual, envia `Authorization: Bearer`, analisa sempre o envelope, converte falha de rede em `ApiError(status=0, code='NETWORK_ERROR')`, e não registra body, headers ou tokens. Em `401`, usa uma promessa global de `supabase.auth.refreshSession()`, repete uma vez e invalida como `expired` se falhar. Em `403`, não repete e invalida como `forbidden`.

- [ ] **Step 5: Configurar cache apenas em memória e lifecycle nativo**

```ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (count, error) => error instanceof ApiError && error.status >= 500 && count < 2,
      refetchOnReconnect: true,
    },
    mutations: { retry: false },
  },
})
```

Ligar `onlineManager` ao NetInfo e `focusManager` ao `AppState`. Não instalar persister do TanStack Query.

- [ ] **Step 6: Criar formatadores estáveis**

`format.ts` usa instâncias únicas de `Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' })`; nunca chama `new Intl.DateTimeFormat()` dentro de linhas da `FlatList`.

---

### Task 4: Construir a infraestrutura server-only das API routes

**Files:**
- Create: `src/server/database.types.ts`
- Create: `src/server/env.ts`
- Create: `src/server/http.ts`
- Create: `src/server/supabase.ts`
- Create: `src/server/auth.ts`
- Create: `src/server/security.ts`

**Interfaces:**
- Consumes: variáveis server-only, Bearer token, headers Cloudflare e RPCs existentes.
- Produces: `AdminContext`, `requirePlatformAdmin(request)`, clientes Supabase por requisição, respostas JSON uniformes, rate limit e auditoria.

- [ ] **Step 1: Trazer um snapshot local tipado do schema**

Copiar o conteúdo vigente de `nfc-menu/src/domain/database.types.ts` para `src/server/database.types.ts`, com cabeçalho explícito:

```ts
/**
 * Snapshot server-only do schema Supabase compartilhado.
 * Atualizar manualmente quando migrations relevantes mudarem.
 * Nunca importar este arquivo no bundle React Native.
 */
```

O snapshot precisa conter as tabelas `invites`, `restaurants`, `profiles`, `platform_admins` e as assinaturas exatas de `is_platform_admin`, `check_rate_limit` e `record_audit`.

- [ ] **Step 2: Validar ambiente no servidor sem exportar valores**

```ts
export type ServerEnv = {
  supabaseUrl: string
  supabaseAnonKey: string
  painelPublicUrl: string
}

export function getServerEnv(): ServerEnv
```

Remover barra final de `PAINEL_PUBLIC_URL`; exigir `https:` fora de desenvolvimento. Nenhuma chave do retorno pode começar com `EXPO_PUBLIC_`.

- [ ] **Step 3: Padronizar erros e respostas sem vazamento**

```ts
export class HttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message)
  }
}

const ADMIN_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
}

export function ok<T>(data: T, status = 200): Response
export function fail(error: HttpError): Response
export function handleRouteError(error: unknown): Response
```

`handleRouteError` preserva somente `HttpError`; converte `ZodError` em `422 VALIDATION_ERROR`; JSON malformado vira `400 INVALID_JSON`; qualquer outra falha retorna `500 INTERNAL_ERROR` com `Não foi possível concluir esta operação.`. Não devolver `error.message` de Supabase.

- [ ] **Step 4: Criar clientes Supabase sem estado compartilhado de sessão**

```ts
export function createAnonymousServerClient(): SupabaseClient<Database>
export function createUserServerClient(accessToken: string): SupabaseClient<Database>
```

Ambos usam `persistSession: false`, `autoRefreshToken: false`, `detectSessionInUrl: false`; o cliente de usuário recebe `Authorization: Bearer ${accessToken}` em `global.headers`.

- [ ] **Step 5: Revalidar usuário e papel em toda requisição administrativa**

```ts
export type AdminContext = {
  accessToken: string
  user: { id: string; email: string }
  supabase: SupabaseClient<Database>
  trustedIp: string | null
}

export async function requirePlatformAdmin(request: Request): Promise<AdminContext>
```

Aceitar somente o padrão `Bearer <token>`, chamar `auth.getUser(token)`, exigir e-mail e então `rpc('is_platform_admin')`. Ausência/token inválido vira `401 UNAUTHORIZED`; RPC falso vira `403 FORBIDDEN`; erro do RPC vira 500 opaco.

- [ ] **Step 6: Encapsular IP confiável, rate limit e auditoria**

```ts
export function trustedClientIp(request: Request): string | null
export async function enforceRateLimit(
  supabase: SupabaseClient<Database>,
  bucket: 'auth:login' | 'mutation',
  identifier: string,
): Promise<void>
export async function recordAudit(
  context: AdminContext,
  input: { action: string; subjectType: string; subjectId?: string; metadata?: Record<string, string | number | boolean | null> },
): Promise<void>
```

Ler somente `cf-connecting-ip`; ignorar `x-forwarded-for` e headers escolhidos pelo cliente. Limites: `auth:login = 10/60s`, `mutation = 60/60s`. Falha do contador fecha a operação; `data !== true` retorna `429 RATE_LIMITED`.

---

### Task 5: Implementar serviços de sessão, convites e restaurantes no servidor

**Files:**
- Create: `src/server/invitations.ts`
- Create: `src/server/restaurants.ts`
- Create: `src/app/api/mobile/v1/session+api.ts`
- Create: `src/app/api/mobile/v1/invites+api.ts`
- Create: `src/app/api/mobile/v1/invites/[id]/revoke+api.ts`
- Create: `src/app/api/mobile/v1/restaurants+api.ts`

**Interfaces:**
- Consumes: infraestrutura da Task 4 e DTOs da Task 3.
- Produces: os seis métodos HTTP aprovados em `/api/mobile/v1`.

- [ ] **Step 1: Implementar login e validação de sessão**

Schema:

```ts
const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(1024),
})
```

`POST /session` aplica rate limit pelo IP confiável ou `local-shared`, chama `signInWithPassword`, confirma `is_platform_admin` usando o access token retornado e devolve somente `MobileSession`. Credenciais inválidas sempre retornam `401 INVALID_CREDENTIALS`; conta válida sem papel retorna `403 FORBIDDEN`. `GET /session` usa `requirePlatformAdmin` e devolve `SessionInfo`.

- [ ] **Step 2: Gerar token e hash somente com Web Crypto**

```ts
export function generateInviteToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('')
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export async function hashInviteTokenForDb(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  const hex = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  return `\\x${hex}`
}
```

Não importar `node:crypto` e não criar fallback com `Math.random()`.

- [ ] **Step 3: Listar e criar apenas convites de plataforma**

```ts
const createInviteSchema = z.object({
  email: z.union([z.string().trim().email().max(254), z.literal('')]).optional(),
  expiresInDays: z.number().int().min(1).max(30),
})
```

Listagem seleciona somente `id,email,expires_at,redeemed_at,revoked_at`, filtra `restaurant_id IS NULL` e ordena `created_at DESC`. Criação aplica o balde `mutation` com identificador `${context.user.id}:${context.trustedIp ?? 'no-ip'}`, fixa `restaurant_id: null`, `role: 'admin'`, `created_by: context.user.id`, persiste apenas o hash, registra `invite.created` e devolve `${painelPublicUrl}/convite/${token}`. Normalizar e-mail vazio para `null`.

- [ ] **Step 4: Tornar revogação condicional e idempotente**

Validar `[id]` com `z.string().uuid()` e aplicar o balde `mutation` com identificador `${context.user.id}:${context.trustedIp ?? 'no-ip'}`. Fluxo obrigatório:

```text
lookup inexistente ou restaurant_id não nulo -> 404 INVITE_NOT_FOUND
revoked_at preenchido -> 200 com o revokedAt existente
redeemed_at preenchido ou expires_at <= agora -> 409 INVITE_NOT_PENDING
update condicional de pendente -> registrar invite.revoked -> 200
zero linhas atualizadas -> reler e mapear idempotência/conflito
```

O update deve repetir todos os predicados: id, `restaurant_id IS NULL`, `redeemed_at IS NULL`, `revoked_at IS NULL`, `expires_at > now`.

- [ ] **Step 5: Listar restaurantes com DTO mínimo**

Selecionar `id,name,slug,segment,status,deleted_at`, ordenar por `created_at DESC` e mapear snake_case para camelCase. Não criar endpoint de detalhe nem URL por restaurante.

- [ ] **Step 6: Conectar cada handler ao wrapper de erro**

Cada export `GET`/`POST` usa `try/catch` e `handleRouteError`, sem lógica de domínio duplicada. Todos os sucessos e erros carregam `Cache-Control: no-store`.

Assinaturas das rotas dinâmicas e estáticas:

```ts
export async function GET(request: Request): Promise<Response>
export async function POST(request: Request): Promise<Response>
export async function POST(request: Request, { id }: { id: string }): Promise<Response>
```

- [ ] **Step 7: Fazer probes locais não destrutivos**

Com `npx expo start`, consultar sem token:

```powershell
Invoke-WebRequest -Uri 'http://localhost:8081/api/mobile/v1/session' -SkipHttpErrorCheck
Invoke-WebRequest -Uri 'http://localhost:8081/api/mobile/v1/invites' -SkipHttpErrorCheck
Invoke-WebRequest -Uri 'http://localhost:8081/api/mobile/v1/restaurants' -SkipHttpErrorCheck
```

Esperado: JSON uniforme, `401`, `Cache-Control: no-store`, nenhum stack trace. Não executar criação/revogação contra ambiente real sem conta e ambiente indicados pelo usuário.

---

### Task 6: Montar providers, autenticação e roteamento protegido

**Files:**
- Create: `src/providers/app-providers.tsx`
- Create: `src/features/auth/auth-context.tsx`
- Rewrite: `src/app/_layout.tsx`
- Create: `src/app/(auth)/_layout.tsx`
- Create: `src/app/(auth)/entrar.tsx`
- Create: `src/app/(app)/_layout.tsx`
- Create: `src/app/(app)/index.tsx`
- Create: `src/app/(app)/restaurantes.tsx`
- Delete: `src/app/index.tsx`
- Delete: `src/app/explore.tsx`
- Delete: `src/components/app-tabs.tsx`
- Delete: `src/components/app-tabs.web.tsx`
- Delete: `src/components/animated-icon.tsx`
- Delete: `src/components/animated-icon.web.tsx`
- Delete: `src/components/animated-icon.module.css`
- Delete: `src/components/external-link.tsx`
- Delete: `src/components/hint-row.tsx`
- Delete: `src/components/themed-text.tsx`
- Delete: `src/components/themed-view.tsx`
- Delete: `src/components/web-badge.tsx`
- Delete: `src/components/ui/collapsible.tsx`
- Delete: `src/constants/theme.ts`
- Delete: `src/hooks/use-theme.ts`
- Delete: `src/hooks/use-color-scheme.ts`
- Delete: `src/hooks/use-color-scheme.web.ts`

**Interfaces:**
- Consumes: `supabase`, clientes HTTP, tema e Query Client.
- Produces: `useAuth()` com quatro estados explícitos e redirects sem piscar a rota errada.

- [ ] **Step 1: Definir a máquina de sessão**

```ts
export type AuthStatus = 'initializing' | 'authenticated' | 'signed-out' | 'forbidden'
export type AuthContextValue = {
  status: AuthStatus
  user: MobileUser | null
  message: string | null
  signIn(input: { email: string; password: string }): Promise<void>
  signOut(): Promise<void>
}
```

Na inicialização: ler `supabase.auth.getSession()`, renovar se necessário, chamar `GET /session` e só então sair de `initializing`. Registrar o invalidator da Task 3: `expired` limpa a sessão com mensagem de expiração; `forbidden` limpa a sessão e mantém status `forbidden` até o usuário voltar ao formulário.

- [ ] **Step 2: Coordenar auto-refresh com AppState**

Em native, quando `AppState` vira `active`, chamar `supabase.auth.startAutoRefresh()` e revalidar a sessão; quando sai de active, chamar `stopAutoRefresh()`. Remover subscriptions no unmount.

- [ ] **Step 3: Montar todos os providers sem esconder o navigator raiz**

Ordem:

```tsx
<GestureHandlerRootView style={{ flex: 1 }}>
  <ThemeProvider>
    <GluestackUIProvider>
      <QueryClientProvider client={queryClient}>
        <Host>
          <AuthProvider>
            <RootStack />
          </AuthProvider>
        </Host>
      </QueryClientProvider>
    </GluestackUIProvider>
  </ThemeProvider>
</GestureHandlerRootView>
```

`RootStack` sempre monta; layouts aninhados decidem redirect. Manter o splash até tema e sessão estarem hidratados, e escondê-lo em `finally` mesmo se a sessão falhar.

- [ ] **Step 4: Proteger os grupos de rota**

`(auth)/_layout.tsx` redireciona autenticado para `/`. `(app)/_layout.tsx` mantém `null` durante `initializing` e redireciona os demais estados para `/entrar`. O grupo protegido usa `Stack` com `headerShown: false` e `animation: 'none'`; não usa `unstable-native-tabs`.

- [ ] **Step 5: Limpar completamente o starter**

Remover exatamente as duas telas de demonstração, tabs, componentes, constants e hooks listados nesta tarefa. Manter primitives Gluestack e infraestrutura reutilizada; não fazer reorganização global sem relação com o app.

---

### Task 7: Construir o login e o shell com dock fiel

**Files:**
- Create: `src/features/auth/login-screen.tsx`
- Create: `src/components/shell/adaptive-blur-surface.tsx`
- Create: `src/components/shell/app-shell.tsx`
- Create: `src/components/shell/mobile-dock.tsx`
- Modify: `src/app/(auth)/entrar.tsx`
- Modify: `src/app/(app)/_layout.tsx`

**Interfaces:**
- Consumes: `useAuth()`, `useAppTheme()`, Router e safe-area insets.
- Produces: login funcional, Conta, Menu, logout e navegação `/` ↔ `/restaurantes`.

- [ ] **Step 1: Implementar o login mobile-first**

Usar `KeyboardAvoidingView` + `ScrollView` com `keyboardShouldPersistTaps="handled"`. Conteúdo: seletor de tema no topo, monograma `TV`, `Tavvi`, `Console da plataforma`, subtítulo, e-mail, senha e `Entrar`. Validar e-mail localmente; preservar os campos em falha; desabilitar submissão duplicada; erro aparece em alerta dentro do card e é anunciado por acessibilidade.

- [ ] **Step 2: Criar uma superfície de blur com fallback acessível**

`AdaptiveBlurSurface` observa `AccessibilityInfo.isReduceTransparencyEnabled()`. Se verdadeiro, renderiza `surface3` opaco. Caso contrário usa `BlurView tint="systemThinMaterial"` com `intensity={80}`, `overflow: 'hidden'` e raio 16; o material do sistema acompanha claro/escuro. Não animar intensidade.

- [ ] **Step 3: Reproduzir a geometria do dock**

```ts
export const dockMetrics = {
  side: 12,
  bottom: 12,
  height: 68,
  outerRadius: 16,
  sideButton: 44,
  sideRadius: 12,
  centerButton: 58,
  centerRadius: 18,
  centerLift: 14,
} as const
```

Dock absoluto com `left/right: 12`, `bottom: insets.bottom + 12`, três colunas iguais. Ícones: `UserRound`, `Home`, `Menu` do Lucide; tamanho 21/23. Conta à esquerda, Convites no centro, Menu à direita.

- [ ] **Step 4: Implementar os dois overlays e seus estados**

Estado único: `type MobilePanel = 'none' | 'account' | 'menu'`. Conta abre popover de 224dp acima do canto esquerdo, com e-mail, opções Sistema/Claro/Escuro e Sair. Menu abre painel entre `left/right: 12` e acima do dock, com somente Convites e Restaurantes. Menu usa scrim `rgba(0,0,0,0.45)`; Conta usa camada transparente para fechar por toque externo.

- [ ] **Step 5: Aplicar motion apenas onde comunica estado**

Finalidade: feedback e consistência espacial; frequência de troca de rota não recebe slide. Painel usa `translateY + opacity` por 220ms na entrada e 160ms na saída, easing `[0.16,1,0.3,1]`; popover usa `scale 0.96→1`, `translateY 6→0` e opacity. Reduced motion mantém somente fade de 120–150ms. Presses usam escala 0.97 por 120ms; linhas de menu usam mudança de fundo, não escala.

- [ ] **Step 6: Fechar overlays corretamente**

`usePathname()` fecha painel ao mudar de rota. `BackHandler` retorna `true` e fecha primeiro o overlay no Android. Abrir move foco de acessibilidade ao primeiro controle; fechar restaura foco quando suportado. Um overlay aberto usa `accessibilityViewIsModal` e oculta o conteúdo de fundo das tecnologias assistivas.

- [ ] **Step 7: Conectar navegação e haptics**

Centro sempre executa `router.replace('/')`; em Restaurantes ele fica neutro. Menu destaca o pathname atual. Abrir overlay, mudar tema e confirmar logout disparam um único `Haptics.selectionAsync()` ou impacto leve, sem depender do haptic como feedback exclusivo.

---

### Task 8: Entregar a gestão de convites

**Files:**
- Create: `src/features/invitations/queries.ts`
- Create: `src/features/invitations/invitation-card.tsx`
- Create: `src/features/invitations/create-invitation-sheet.tsx`
- Create: `src/features/invitations/invitations-screen.tsx`
- Modify: `src/app/(app)/index.tsx`

**Interfaces:**
- Consumes: endpoints de convites, Query Client, Clipboard e BottomSheet de `@expo/ui`.
- Produces: lista, pull-to-refresh, criação, cópia e revogação.

- [ ] **Step 1: Definir query keys e status derivado**

```ts
export const invitationKeys = { all: ['mobile', 'invites'] as const }
export type InviteState = 'pending' | 'redeemed' | 'revoked' | 'expired'
export function getInviteState(invite: MobileInvite, now: number): InviteState {
  if (invite.redeemedAt) return 'redeemed'
  if (invite.revokedAt) return 'revoked'
  if (Date.parse(invite.expiresAt) <= now) return 'expired'
  return 'pending'
}
```

Atualizar `now` a cada minuto e ao retornar ao foreground para um convite vencer sem nova requisição.

- [ ] **Step 2: Criar hooks sem retry de mutação**

`useInvitations()` chama GET. `useRevokeInvitation()` chama POST e invalida somente `invitationKeys.all` após sucesso. `useCreateInvitation(onCreated)` chama POST, entrega `CreatedInvite` ao callback local, retorna ao Mutation Cache apenas `{ id }` e usa `gcTime: 0`; o link nunca vira query data nem permanece em mutation data.

- [ ] **Step 3: Montar a lista com quatro estados**

Usar `FlatList`, `contentInsetAdjustmentBehavior="automatic"`, `RefreshControl`, padding inferior `insets.bottom + 12 + 68 + 24` e `keyExtractor={item => item.id}`. Cabeçalho: `Plataforma`, `Convites`, descrição e `Novo convite`. Skeleton imita o card; vazio oferece `Novo convite`; erro inicial oferece `Tentar novamente`; erro de refresh mantém cards e mostra aviso não bloqueante.

- [ ] **Step 4: Renderizar cards e confirmação de revogação**

Card mostra e-mail ou `Qualquer e-mail`, badge textual, `Válido até {data}` e Revogar somente em `pending`. Mapas:

```ts
const inviteLabels = {
  pending: ['Pendente', 'primary'],
  redeemed: ['Resgatado', 'success'],
  revoked: ['Revogado', 'muted'],
  expired: ['Vencido', 'warning'],
} as const
```

Revogar abre AlertDialog curto, preserva o card enquanto aguarda, desabilita dupla ação e só atualiza depois da resposta.

- [ ] **Step 5: Implementar o composer com `@expo/ui` BottomSheet**

O `Host` já está na raiz. Usar:

```tsx
<BottomSheet
  isPresented={open}
  onDismiss={handleDismiss}
  showDragIndicator
  snapPoints={['half', 'full']}
  containerColor={colors.surface2}
>
  <CreateInvitationContent />
</BottomSheet>
```

Formulário: e-mail opcional, validade inteira 1–30 com padrão 7, explicação do prazo e `Gerar link`. Em erro, manter o rascunho. Em sucesso, substituir o formulário por `Convite criado`, aviso de exibição única, link `selectable`, Copiar e `Já copiei o link`.

- [ ] **Step 6: Impedir descarte silencioso do link**

Guardar `{ id, link, copied }` apenas em `useState` do sheet. `Clipboard.setStringAsync(link)` marca `copied=true` somente após resolver. Se dismiss/back ocorrer com `copied=false`, fechar visualmente o sheet e abrir confirmação `Descartar link?`; `Voltar ao link` reabre, `Descartar` zera o estado. Fechar após `Já copiei o link` zera imediatamente. Nunca chamar `console.log` com a resposta.

---

### Task 9: Entregar a lista somente leitura de restaurantes

**Files:**
- Create: `src/features/restaurants/queries.ts`
- Create: `src/features/restaurants/restaurant-card.tsx`
- Create: `src/features/restaurants/restaurants-screen.tsx`
- Modify: `src/app/(app)/restaurantes.tsx`

**Interfaces:**
- Consumes: `GET /api/mobile/v1/restaurants` e primitives visuais.
- Produces: lista read-only com estado, refresh e status acessível.

- [ ] **Step 1: Definir query e situação apresentada**

```ts
export const restaurantKeys = { all: ['mobile', 'restaurants'] as const }
export function getRestaurantPresentation(item: MobileRestaurant) {
  if (item.deletedAt) return { label: 'Removido', tone: 'muted' as const }
  if (item.status === 'active') return { label: 'Ativo', tone: 'success' as const }
  if (item.status === 'suspended') return { label: 'Suspenso', tone: 'warning' as const }
  return { label: 'Rascunho', tone: 'muted' as const }
}
```

- [ ] **Step 2: Montar os quatro estados da lista**

Usar a mesma estrutura de `FlatList` e safe-area dos convites. Cabeçalho: `Plataforma`, `Restaurantes`, `Acompanhe os estabelecimentos, endereços públicos e situação de publicação.` Vazio: `Restaurantes aparecem aqui quando alguém resgata um convite.`, sem botão.

- [ ] **Step 3: Garantir que o card não sugere navegação**

`RestaurantCard` é um `View`, nunca `Pressable` ou `Link`. Mostrar nome, `/${slug}`, segmento ou `Tipo não informado`, e badge. Não renderizar chevron, `onPress`, ripple, escala ou menu de contexto.

- [ ] **Step 4: Verificar comportamento com conteúdo longo**

Nome e segmento podem ocupar duas linhas; slug pode truncar no meio visualmente, mas deve ser `selectable` em tela. Com fonte ampliada, badge e texto refluem sem altura fixa.

---

### Task 10: Acabamento, assets, documentação e verificação manual integral

**Files:**
- Modify: `assets/images/icon.png`
- Modify: `assets/images/android-icon-foreground.png`
- Modify: `assets/images/android-icon-background.png`
- Modify: `assets/images/android-icon-monochrome.png`
- Modify: `assets/images/splash-icon.png`
- Delete: `assets/images/tutorial-web.png`
- Delete: `assets/images/react-logo.png`
- Delete: `assets/images/react-logo@2x.png`
- Delete: `assets/images/react-logo@3x.png`
- Delete: `assets/images/expo-logo.png`
- Delete: `assets/images/expo-badge.png`
- Delete: `assets/images/expo-badge-white.png`
- Delete: `assets/images/tabIcons/home.png`
- Delete: `assets/images/tabIcons/home@2x.png`
- Delete: `assets/images/tabIcons/home@3x.png`
- Delete: `assets/images/tabIcons/explore.png`
- Delete: `assets/images/tabIcons/explore@2x.png`
- Delete: `assets/images/tabIcons/explore@3x.png`
- Modify: `README.md`
- Create: `docs/deployment/eas-hosting.md`
- Remove: componentes e imagens do starter comprovadamente sem importadores

**Interfaces:**
- Consumes: app funcional das Tasks 1–9.
- Produces: identidade Tavvi completa, instruções operacionais e evidência manual dentro das restrições do projeto.

- [ ] **Step 1: Substituir a identidade Expo por Tavvi**

Criar assets com monograma `TV`, sem texto pequeno: fundo claro `#FBFAF8`, marca `#00786F`; variante monocromática branca/transparente para Android. Preservar as dimensões dos cinco arquivos de destino e as áreas seguras do adaptive icon. Splash usa marca central simples, sem animação longa. Remover exatamente as imagens de demonstração e tab icons listadas nesta tarefa depois de confirmar que `rg` não encontra importadores.

- [ ] **Step 2: Documentar desenvolvimento e separação de ambientes**

README deve explicar: copiar `.env.example`, usar IP LAN para aparelho físico, iniciar com `npx expo start`, escanear no Expo Go, e que as rotas locais compartilham o servidor do Expo. Não registrar credenciais reais.

- [ ] **Step 3: Documentar EAS Hosting sem implantar**

`docs/deployment/eas-hosting.md` lista as três variáveis server-only, as três públicas, a necessidade de URL absoluta em `EXPO_PUBLIC_API_URL`, o destino EAS Hosting/Cloudflare Workers e o fato de que `eas deploy` permanece proibido até autorização específica para export/deploy.

- [ ] **Step 4: Inspecionar fronteiras de segurança**

Usar buscas somente leitura para confirmar:

```powershell
rg -n "SUPABASE_ANON_KEY|PAINEL_PUBLIC_URL|src/server" src --glob '!src/server/**' --glob '!src/app/api/**'
rg -n "token_hash|service_role|console\.(log|debug).*token|Math\.random" src
rg -n "Pressable|Link|onPress|chevron" src/features/restaurants
```

Esperado: nenhuma variável server-only ou import server-only no cliente; nenhuma service role; nenhum token em log; nenhum card de restaurante interativo.

- [ ] **Step 5: Iniciar o desenvolvimento e observar Metro/API**

Executar `npx expo start --clear`. Verificar ausência de erros de resolução, carregar Android e iOS via Expo Go quando disponíveis e observar logs sem segredos. Não executar build, lint, typecheck ou testes.

- [ ] **Step 6: Exercitar autenticação manual**

Cobrir: credencial inválida; admin válido; usuário válido sem papel; encerramento; fechamento/reabertura; token expirado; permissão removida; perda e retorno de rede. Resultado esperado: sessão local preservada offline, refresh único em 401 e mensagem segura ao sair.

- [ ] **Step 7: Exercitar convites em ambiente explicitamente autorizado**

Cobrir: lista vazia/preenchida; e-mail vazio/válido/inválido; validade 1/7/30 e fora do intervalo; toque duplicado; cópia; tentativa de fechar sem cópia; criação sem retry; revogação; revogação repetida; convite resgatado/vencido; pull-to-refresh. Confirmar no banco apenas quando o ambiente tiver sido indicado pelo usuário.

- [ ] **Step 8: Exercitar restaurantes e estados visuais**

Cobrir: vazio, conteúdo, erro inicial, erro de refresh com conteúdo, ativo/rascunho/suspenso/removido, nome longo, segmento ausente e slug longo. Confirmar que nenhum card navega.

- [ ] **Step 9: Fazer feel-check do dock em dispositivo**

Checar safe areas pequenas e amplas, Android Back, toque fora, mudança de rota, Conta/Menu mutuamente exclusivos, foco de acessibilidade, teclado, fonte ampliada, reduced motion e Reduce Transparency. Interromper e inverter a abertura dos painéis rapidamente para detectar saltos; confirmar um único haptic por ação.

- [ ] **Step 10: Registrar limitações da verificação**

Na entrega, declarar quais plataformas/aparelhos foram realmente exercitados, quais fluxos dependeram de credenciais/ambiente e que deploy não foi executado. Não afirmar aprovação de build, typecheck, lint ou testes, pois esses comandos são proibidos.

---

## Sequência de aceite

1. Metro resolve os aliases e abre o app sem o erro original.
2. Login invalida credenciais erradas, recusa não-admin e persiste admin válido.
3. API revalida Bearer token e `platform_admin` em todas as rotas.
4. Convites listam, criam, copiam e revogam sem expor hash ou reter o link.
5. Restaurantes aparecem sem qualquer affordance de navegação.
6. Dock e overlays reproduzem geometria, estados, safe areas e Android Back da referência.
7. Sistema/Claro/Escuro, Inter, status bar, blur/fallback e reduced motion permanecem coerentes.
8. Nenhum dado administrativo é persistido fora da sessão segura.
9. Nenhum comando proibido nem deploy foi executado.
