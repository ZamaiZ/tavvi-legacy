# Tavvi Login Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o login atual por uma tela Tavvi premium e responsiva, com hero recortado por geometria SVG real, assets oficiais, temas claro/escuro/sistema e preparação honesta para biometria.

**Architecture:** `LoginScreen` fica responsável somente por composição, tema, safe areas e integração com `useAuth`. O hero, fundo, formulário, campos e biometria permanecem em componentes privados de `src/features/auth/`; `react-native-svg` desenha o recorte e os glows sem máscara adicional. O fluxo de autenticação e o contrato de backend permanecem inalterados.

**Tech Stack:** Expo SDK 57, React Native 0.86, Expo Router, `react-native-svg`, `expo-image`, `expo-local-authentication`, `expo-haptics`, `react-native-safe-area-context`, Lucide React Native.

**Spec:** `docs/superpowers/specs/2026-09-23-tavvi-login-redesign-design.md`

## Global Constraints

- Aplicativo Expo SDK 57 com iOS e Android como plataformas-alvo; web não é critério de aceite.
- Usar `npx expo install` porque não existe `bun.lock` e o repositório usa `pnpm-lock.yaml`.
- Não executar `git`, `build`, `lint`, `typecheck` ou `test` em nenhuma etapa.
- Não criar nem editar `ios/` ou `android/`; a permissão nativa entra por config plugin em `app.json`.
- Não salvar senha nem tratar uma confirmação biométrica isolada como sessão autenticada.
- Manter `AuthContext`, endpoint `/api/mobile/v1/session` e redirects atuais sem alteração.
- Manter Inter como tipografia da aplicação.
- O recorte do hero deve ser parte do próprio `Path`; nenhuma view pode cobrir o canto com a cor do fundo.
- `FormField` e `AppButton` globais permanecem inalterados; a aparência especial fica privada do login.
- Todos os controles por ícone têm rótulo acessível e alvo mínimo de 44 pt no iOS ou 48 dp no Android.
- A validação desta entrega é manual pelo servidor de desenvolvimento; o plano não cria suíte de testes.

## Review Focus

- Teclado aberto em telefone de 375 dp: campos e CTA continuam alcançáveis por rolagem.
- Dynamic Type grande: cabeçalhos reorganizam e não empurram a ação principal para fora da área rolável.
- Tema claro: o verde-lima, as bordas e o foco mantêm contraste e o recorte não apresenta emenda.
- Biometria ausente, não cadastrada ou com erro de consulta: botão fica desabilitado e anuncia o motivo sem quebrar o login por senha.
- Erro de login, acesso removido e submissão duplicada: campos são preservados, erro é anunciado e só uma requisição fica pendente.

---

## File Map

### Create

- `assets/images/brand/tavvi-brandmark.png` — brandmark raster otimizado para uso decorativo.
- `assets/images/brand/tavvi-lockup-horizontal.png` — lockup oficial otimizado para o hero.
- `assets/images/brand/tavvi-wordmark.png` — wordmark oficial otimizado para o rodapé.
- `src/features/auth/login-theme.ts` — paletas e tipo visual privados do login.
- `src/features/auth/login-backdrop.tsx` — fundo e halo não interativos.
- `src/features/auth/login-hero.tsx` — shape SVG, marca, cópia e seletor de tema.
- `src/features/auth/biometric-button.tsx` — consulta de capacidade e botão biométrico.
- `src/features/auth/login-field.tsx` — campo privado com label, ícone e revelação de senha.
- `src/features/auth/login-form.tsx` — validação, alertas, submissão e ações.

### Modify

- `package.json` — dependência compatível `expo-local-authentication`.
- `pnpm-lock.yaml` — resolução gravada pelo `expo install`.
- `app.json:26` — config plugin e texto de permissão do Face ID.
- `src/theme/tokens.ts:1` — escala fixa da nova marca.
- `src/components/primitives/theme-toggle.tsx:14` — tamanho e estilo opcionais sem quebrar usos existentes.
- `src/features/auth/login-screen.tsx:1` — composição responsiva final.

### Explicitly unchanged

- `src/features/auth/auth-context.tsx`
- `src/components/primitives/form-field.tsx`
- `src/components/primitives/app-button.tsx`
- Rotas em `src/app/(auth)/`
- APIs em `src/app/api/mobile/v1/`

---

### Task 1: Preparar assets e tokens oficiais da marca

**Files:**

- Create: `assets/images/brand/tavvi-brandmark.png`
- Create: `assets/images/brand/tavvi-lockup-horizontal.png`
- Create: `assets/images/brand/tavvi-wordmark.png`
- Modify: `src/theme/tokens.ts:1-27`

**Interfaces:**

- Consumes: PNGs fonte em `C:\Users\Eduardo Zamai\Downloads\Branding Tavvi`.
- Produces: `brand` exportado por `@/theme` e três assets locais referenciáveis por `require()`.

- [ ] **Step 1: Confirmar fontes e transparência antes de gerar derivados**

Run:

```powershell
Add-Type -AssemblyName System.Drawing
Get-ChildItem -LiteralPath 'C:\Users\Eduardo Zamai\Downloads\Branding Tavvi' -File | ForEach-Object {
  $image = [System.Drawing.Bitmap]::new($_.FullName)
  [pscustomobject]@{
    Name = $_.Name
    Width = $image.Width
    Height = $image.Height
    PixelFormat = $image.PixelFormat
    CornerAlpha = $image.GetPixel(0, 0).A
  }
  $image.Dispose()
} | Format-Table -AutoSize
```

Expected: `brandmark-white.png` 1254 × 1254, `lockup-horizontal.png` 3350 × 1310 e `wordmark-white.png` 1252 × 454, todos com `Format32bppArgb` e alpha zero no canto.

- [ ] **Step 2: Gerar cópias proporcionais para o bundle móvel**

Create the directory, then run exactly:

```powershell
New-Item -ItemType Directory -Force -Path 'assets\images\brand'
ffmpeg -y -i 'C:\Users\Eduardo Zamai\Downloads\Branding Tavvi\brandmark-white.png' -vf 'scale=900:900:flags=lanczos' -frames:v 1 'assets\images\brand\tavvi-brandmark.png'
ffmpeg -y -i 'C:\Users\Eduardo Zamai\Downloads\Branding Tavvi\lockup-horizontal.png' -vf 'scale=480:-1:flags=lanczos' -frames:v 1 'assets\images\brand\tavvi-lockup-horizontal.png'
ffmpeg -y -i 'C:\Users\Eduardo Zamai\Downloads\Branding Tavvi\wordmark-white.png' -vf 'scale=420:-1:flags=lanczos' -frames:v 1 'assets\images\brand\tavvi-wordmark.png'
```

Expected: arquivos PNG transparentes, sem alteração de proporção e menores que os originais.

- [ ] **Step 3: Adicionar a escala fixa de marca aos tokens existentes**

Append before `palettes` in `src/theme/tokens.ts`:

```ts
export const brand = {
  lime: '#B2F52F',
  limePressed: '#BEF94A',
  limeSoft: 'rgba(178,245,47,0.12)',
  limeGlow: 'rgba(178,245,47,0.42)',
  ink: '#0A0C09',
  hero: '#121510',
  heroRaised: '#181B15',
  onDark: '#F4F6F0',
  mutedOnDark: '#A9AEA3',
  subtleOnDark: '#7D8278',
  lineOnDark: 'rgba(244,246,240,0.10)',
} as const
```

Do not replace the existing semantic `palettes`; this task introduces brand primitives without recoloring unrelated screens.

- [ ] **Step 4: Verificar os derivados gerados**

Run:

```powershell
Add-Type -AssemblyName System.Drawing
Get-ChildItem -LiteralPath 'assets\images\brand' -File | ForEach-Object {
  $image = [System.Drawing.Bitmap]::new($_.FullName)
  [pscustomobject]@{
    Name = $_.Name
    Width = $image.Width
    Height = $image.Height
    Alpha = $image.GetPixel(0, 0).A
    Bytes = $_.Length
  }
  $image.Dispose()
} | Format-Table -AutoSize
```

Expected: 900 × 900, 480 × 188 e 420 × 152; todos com alpha zero no canto e tamanho menor que o correspondente fonte.

---

### Task 2: Configurar e encapsular a disponibilidade biométrica

**Files:**

- Modify: `package.json:5-46`
- Modify: `pnpm-lock.yaml`
- Modify: `app.json:26-55`
- Create: `src/features/auth/biometric-button.tsx`

**Interfaces:**

- Consumes: `expo-local-authentication`, Expo Haptics e quatro cores fornecidas pelo formulário.
- Produces: `useBiometricAvailability(): BiometricAvailability` e `BiometricButton`.

- [ ] **Step 1: Instalar a versão compatível com Expo SDK 57**

Run:

```powershell
npx expo install expo-local-authentication
```

Expected: `expo-local-authentication` aparece em `dependencies` e o `pnpm-lock.yaml` é atualizado pelo instalador do Expo.

- [ ] **Step 2: Configurar a permissão nativa de Face ID via CNG**

Add this entry to the existing `expo.plugins` array in `app.json`:

```json
[
  "expo-local-authentication",
  {
    "faceIDPermission": "Permitir que a Tavvi use o Face ID para proteger o acesso ao console administrativo."
  }
]
```

Keep the existing Expo Router, SecureStore, Font and Splash Screen plugin entries unchanged.

- [ ] **Step 3: Implementar o modelo de disponibilidade**

Create `src/features/auth/biometric-button.tsx` with these public types and state transitions:

```tsx
import * as LocalAuthentication from 'expo-local-authentication'
import { useEffect, useState } from 'react'

export type BiometricKind = 'face' | 'fingerprint' | 'biometric'

export type BiometricAvailability =
  | { state: 'checking' }
  | { state: 'available'; kind: BiometricKind; label: string }
  | { state: 'unavailable'; reason: string }

export function useBiometricAvailability(): BiometricAvailability {
  const [availability, setAvailability] = useState<BiometricAvailability>({ state: 'checking' })

  useEffect(() => {
    let active = true

    async function inspect() {
      if (process.env.EXPO_OS === 'web') {
        if (active) setAvailability({ state: 'unavailable', reason: 'Biometria disponível apenas no aplicativo móvel.' })
        return
      }

      try {
        const [hardware, enrolled, types] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
          LocalAuthentication.supportedAuthenticationTypesAsync(),
        ])

        if (!active) return
        if (!hardware) {
          setAvailability({ state: 'unavailable', reason: 'Este aparelho não possui biometria compatível.' })
          return
        }
        if (!enrolled) {
          setAvailability({ state: 'unavailable', reason: 'Cadastre uma biometria nas configurações do aparelho.' })
          return
        }

        const hasFace = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
        const hasFingerprint = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
        if (hasFace) {
          setAvailability({ state: 'available', kind: 'face', label: process.env.EXPO_OS === 'ios' ? 'Face ID' : 'Reconhecimento facial' })
        } else if (hasFingerprint) {
          setAvailability({ state: 'available', kind: 'fingerprint', label: process.env.EXPO_OS === 'ios' ? 'Touch ID' : 'Impressão digital' })
        } else {
          setAvailability({ state: 'available', kind: 'biometric', label: 'Biometria' })
        }
      } catch {
        if (active) setAvailability({ state: 'unavailable', reason: 'Não foi possível verificar a biometria neste aparelho.' })
      }
    }

    void inspect()
    return () => { active = false }
  }, [])

  return availability
}
```

- [ ] **Step 4: Implementar o botão sem prometer autenticação**

In the same file, export this interface and behavior:

```tsx
import { Fingerprint, ScanFace } from 'lucide-react-native'
import { Alert, Pressable, StyleSheet } from 'react-native'
import * as Haptics from 'expo-haptics'

export type BiometricButtonColors = {
  field: string
  border: string
  text: string
  muted: string
}

export function BiometricButton({ colors }: { colors: BiometricButtonColors }) {
  const availability = useBiometricAvailability()
  const available = availability.state === 'available'
  const label = available ? availability.label : 'Biometria indisponível'
  const Icon = available && availability.kind === 'fingerprint' ? Fingerprint : ScanFace

  function explain() {
    if (!available) return
    void Haptics.selectionAsync()
    Alert.alert(
      availability.label,
      'Entre com e-mail e senha neste primeiro acesso. A ativação do desbloqueio biométrico será disponibilizada em uma etapa própria.',
    )
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={available ? `Sobre acesso com ${label}` : label}
      accessibilityHint={available ? 'Explica como a biometria será ativada' : availability.state === 'unavailable' ? availability.reason : 'Verificando disponibilidade'}
      accessibilityState={{ disabled: !available, busy: availability.state === 'checking' }}
      disabled={!available}
      onPress={explain}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.field, borderColor: colors.border, opacity: available ? (pressed ? 0.72 : 1) : 0.42 },
      ]}
    >
      <Icon accessible={false} size={22} strokeWidth={1.7} color={available ? colors.text : colors.muted} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    width: 58,
    height: 58,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 20,
    borderCurve: 'continuous',
  },
})
```

- [ ] **Step 5: Fazer inspeção estática da integração**

Run:

```powershell
rg -n "expo-local-authentication|faceIDPermission|useBiometricAvailability|authenticateAsync|setItemAsync.*password" package.json app.json src
```

Expected: dependência, plugin e hook aparecem; `authenticateAsync` e qualquer persistência de senha não aparecem nesta etapa.

---

### Task 3: Criar paleta privada e backdrop responsivo

**Files:**

- Create: `src/features/auth/login-theme.ts`
- Create: `src/features/auth/login-backdrop.tsx`

**Interfaces:**

- Consumes: `brand` e `ResolvedTheme` de `@/theme`.
- Produces: `LoginPalette`, `getLoginPalette(theme)` e `LoginBackdrop`.

- [ ] **Step 1: Definir as duas paletas sem alterar outras telas**

Create `src/features/auth/login-theme.ts`:

```ts
import { brand, type ResolvedTheme } from '@/theme'

export const loginPalettes = {
  light: {
    screen: '#EEF0E8',
    surface: '#FFFFFF',
    field: '#F5F7F1',
    text: '#11150F',
    muted: '#62675E',
    subtle: '#7B8176',
    border: 'rgba(10,12,9,0.12)',
    focus: '#557D00',
    focusRing: 'rgba(85,125,0,0.16)',
    error: '#B42318',
    errorSurface: '#FEE4E2',
    heroStart: brand.hero,
    heroEnd: '#0E120C',
    heroText: brand.onDark,
    heroMuted: brand.mutedOnDark,
    glow: 'rgba(178,245,47,0.16)',
  },
  dark: {
    screen: brand.ink,
    surface: '#11130F',
    field: brand.heroRaised,
    text: brand.onDark,
    muted: brand.mutedOnDark,
    subtle: brand.subtleOnDark,
    border: brand.lineOnDark,
    focus: brand.lime,
    focusRing: 'rgba(178,245,47,0.14)',
    error: '#FF8A84',
    errorSurface: '#3A1715',
    heroStart: brand.hero,
    heroEnd: '#0E120C',
    heroText: brand.onDark,
    heroMuted: brand.mutedOnDark,
    glow: 'rgba(178,245,47,0.10)',
  },
} as const

export type LoginPalette = (typeof loginPalettes)[ResolvedTheme]

export function getLoginPalette(theme: ResolvedTheme): LoginPalette {
  return loginPalettes[theme]
}
```

- [ ] **Step 2: Desenhar o fundo sem blur ou imagem raster**

Create `src/features/auth/login-backdrop.tsx`:

```tsx
import { StyleSheet, View } from 'react-native'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'
import type { LoginPalette } from './login-theme'

export function LoginBackdrop({ palette }: { palette: LoginPalette }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" accessible={false}>
        <Defs>
          <RadialGradient id="loginGlow" cx="25%" cy="4%" rx="70%" ry="45%">
            <Stop offset="0" stopColor={palette.glow} />
            <Stop offset="1" stopColor={palette.screen} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="390" height="844" fill={palette.screen} />
        <Rect width="390" height="844" fill="url(#loginGlow)" />
      </Svg>
    </View>
  )
}
```

- [ ] **Step 3: Conferir isolamento da nova paleta**

Run:

```powershell
rg -n "loginPalettes|getLoginPalette|#B2F52F|#0A0C09" src\features\auth src\theme
```

Expected: os novos valores aparecem somente nos arquivos de tema; componentes visuais consomem `palette` ou `brand` em vez de repetir hexadecimais.

---

### Task 4: Construir o hero com recorte SVG real

**Files:**

- Create: `src/features/auth/login-hero.tsx`
- Modify: `src/components/primitives/theme-toggle.tsx:14-48`

**Interfaces:**

- Consumes: `LoginPalette`, `ThemePreference`, `ThemeToggle`, `brand` e três assets oficiais.
- Produces: `LoginHero({ width, palette, preference, onThemeChange })`.

- [ ] **Step 1: Tornar `ThemeToggle` dimensionável sem mudar o default**

Apply this exact structural diff in `theme-toggle.tsx`; all omitted lines remain byte-for-byte unchanged:

```diff
-import { Pressable, StyleSheet } from 'react-native'
+import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'

+type ThemeToggleProps = {
+  value: ThemePreference
+  onChange(next: ThemePreference): void
+  size?: number
+  style?: StyleProp<ViewStyle>
+}

-export function ThemeToggle({ value, onChange }: { value: ThemePreference; onChange(next: ThemePreference): void }) {
+export function ThemeToggle({ value, onChange, size = 44, style }: ThemeToggleProps) {
```

Replace the existing `Pressable` style callback with:

```tsx
style={({ pressed }) => [
  styles.button,
  { width: size, height: size, backgroundColor: colors.muted, borderColor: colors.border },
  style,
  pressed && { opacity: 0.75 },
]}
```

Replace the style declaration with:

```tsx
button: {
  borderWidth: 1,
  borderRadius: radii.full,
  alignItems: 'center',
  justifyContent: 'center',
  alignSelf: 'center',
},
```

The default remains 44 × 44 for all existing callers.

- [ ] **Step 2: Implementar a geometria do hero**

At the top of `src/features/auth/login-hero.tsx`, define:

```tsx
type LoginHeroProps = {
  width: number
  palette: LoginPalette
  preference: ThemePreference
  onThemeChange(next: ThemePreference): void | Promise<void>
}

const HERO_HEIGHT = 264
const OUTER_RADIUS = 28
const NOTCH_WIDTH = 76
const NOTCH_HEIGHT = 72

function createHeroPath(width: number) {
  const r = OUTER_RADIUS
  const notchX = width - NOTCH_WIDTH
  return [
    `M ${r} 0`,
    `H ${notchX - 22}`,
    `C ${notchX - 10} 0 ${notchX} 10 ${notchX} 22`,
    `V ${NOTCH_HEIGHT - 22}`,
    `C ${notchX} ${NOTCH_HEIGHT - 10} ${notchX + 10} ${NOTCH_HEIGHT} ${notchX + 22} ${NOTCH_HEIGHT}`,
    `H ${width - r}`,
    `C ${width - 12} ${NOTCH_HEIGHT} ${width} ${NOTCH_HEIGHT + 12} ${width} ${NOTCH_HEIGHT + r}`,
    `V ${HERO_HEIGHT - r}`,
    `C ${width} ${HERO_HEIGHT - 12} ${width - 12} ${HERO_HEIGHT} ${width - r} ${HERO_HEIGHT}`,
    `H ${r}`,
    `C 12 ${HERO_HEIGHT} 0 ${HERO_HEIGHT - 12} 0 ${HERO_HEIGHT - r}`,
    `V ${r}`,
    `C 0 12 12 0 ${r} 0`,
    'Z',
  ].join(' ')
}
```

The path stops before the theme control, turns inward, and resumes the card below it. Do not add any rectangle matching the screen background.

- [ ] **Step 3: Desenhar shape, gradiente, glow e borda pelo mesmo path**

Use this SVG structure inside `LoginHero`:

```tsx
<Svg width={width} height={HERO_HEIGHT} viewBox={`0 0 ${width} ${HERO_HEIGHT}`} style={StyleSheet.absoluteFill} accessible={false}>
  <Defs>
    <LinearGradient id="heroFill" x1="0" y1="0" x2="1" y2="1">
      <Stop offset="0" stopColor={palette.heroStart} />
      <Stop offset="1" stopColor={palette.heroEnd} />
    </LinearGradient>
    <RadialGradient id="heroGlow" cx="84%" cy="82%" rx="48%" ry="64%">
      <Stop offset="0" stopColor={brand.lime} stopOpacity={0.22} />
      <Stop offset="1" stopColor={brand.lime} stopOpacity={0} />
    </RadialGradient>
    <ClipPath id="heroClip"><Path d={path} /></ClipPath>
  </Defs>
  <G clipPath="url(#heroClip)">
    <Path d={path} fill="url(#heroFill)" />
    <Rect width={width} height={HERO_HEIGHT} fill="url(#heroGlow)" />
  </G>
  <Path d={path} fill="none" stroke={palette.border} strokeWidth={1} />
</Svg>
```

Import `Svg`, `Defs`, `LinearGradient`, `RadialGradient`, `Stop`, `ClipPath`, `G`, `Path`, `Rect` and `Image as SvgImage` from `react-native-svg`. Define the brandmark source at module scope:

```tsx
const brandmark = require('../../../assets/images/brand/tavvi-brandmark.png')
```

Insert the brandmark inside the clipped `<G>`, after the glow rect:

```tsx
<SvgImage
  href={brandmark}
  x={width - 172}
  y={66}
  width={252}
  height={252}
  opacity={0.28}
  preserveAspectRatio="xMidYMid meet"
/>
```

Because the image belongs to the same `ClipPath`, no raster content can leak through the notch or beyond the hero border.

- [ ] **Step 4: Compor os assets e textos sem invadir o recorte**

Use `expo-image` for the lockup and keep the already clipped brandmark inside the SVG:

```tsx
const lockup = require('../../../assets/images/brand/tavvi-lockup-horizontal.png')

<Image source={lockup} contentFit="contain" accessibilityLabel="Tavvi" style={{ width: 78, height: 31 }} />
```

Place the badge below the lockup and the title block near the bottom-left with this exact content:

```tsx
<View style={styles.content}>
  <View style={styles.topContent}>
    <Image source={lockup} contentFit="contain" accessibilityLabel="Tavvi" style={styles.lockup} />
    <View style={[styles.badge, { backgroundColor: brand.limeSoft }]}>
      <View style={[styles.badgeDot, { backgroundColor: brand.lime, boxShadow: `0 0 0 3px ${brand.limeSoft}` }]} />
      <AppText variant="caption" style={{ color: brand.lime, fontSize: 11 }}>Console · Acesso de administrador</AppText>
    </View>
  </View>
  <View style={[styles.copy, { maxWidth: width - 142 }]}>
    <AppText variant="display" maxFontSizeMultiplier={1.35} style={[styles.title, { color: palette.heroText }]}>Bem-vindo de volta<AppText variant="display" style={{ color: brand.lime }}>.</AppText></AppText>
    <AppText variant="meta" maxFontSizeMultiplier={1.5} style={{ color: palette.heroMuted }}>Restaurantes, cardápios, mesas e pedidos em um só lugar.</AppText>
  </View>
</View>
```

Add these styles:

```tsx
const styles = StyleSheet.create({
  root: { position: 'relative', height: HERO_HEIGHT },
  content: { height: HERO_HEIGHT, padding: 22, justifyContent: 'space-between' },
  topContent: { alignItems: 'flex-start', gap: 16 },
  lockup: { width: 78, height: 31 },
  badge: { minHeight: 26, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, borderRadius: 13 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  copy: { gap: 10 },
  title: { fontSize: 31, lineHeight: 32, fontWeight: '700', letterSpacing: -1.1 },
})
```

The nested title dot remains part of the same accessibility phrase. The capped multiplier applies only to the constrained brand hero; the form remains fully scalable.

- [ ] **Step 5: Encaixar o controle no espaço vazio real**

Render:

```tsx
<ThemeToggle
  value={preference}
  onChange={(next) => { void onThemeChange(next) }}
  size={54}
  style={{ position: 'absolute', top: 0, right: 0, borderRadius: 19, borderCurve: 'continuous' }}
/>
```

Open the component immediately before the SVG block from Step 3:

```tsx
export function LoginHero({ width, palette, preference, onThemeChange }: LoginHeroProps) {
  const path = createHeroPath(width)
  return (
    <View style={[styles.root, { width }]}>
```

Close it immediately after the `ThemeToggle` block:

```tsx
    </View>
  )
}
```

The file order is SVG, content and toggle. The button occupies the area absent from the shape and no element covers the hero border.

- [ ] **Step 6: Inspecionar o requisito estrutural do recorte**

Run:

```powershell
rg -n "createHeroPath|ClipPath|Path d=|backgroundColor: palette.screen|position: 'absolute'.*right: 0" src\features\auth\login-hero.tsx
```

Expected: path e clip aparecem; não existe view absoluta com `palette.screen` tapando o canto.

---

### Task 5: Implementar os campos e o formulário premium

**Files:**

- Create: `src/features/auth/login-field.tsx`
- Create: `src/features/auth/login-form.tsx`

**Interfaces:**

- Consumes: `LoginPalette`, `AuthContextValue['signIn']`, mensagem/status do auth e `BiometricButton`.
- Produces: `LoginField` e `LoginForm` com submissão idempotente durante loading.

- [ ] **Step 1: Criar o campo privado do login**

Create `login-field.tsx` with this complete component:

```tsx
import { useState, type ComponentType } from 'react'
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native'
import { Eye, EyeOff } from 'lucide-react-native'
import { AppText } from '@/components/primitives/app-text'
import { typeStyles } from '@/theme'
import type { LoginPalette } from './login-theme'

type LoginFieldProps = TextInputProps & {
  label: string
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number; accessible?: boolean }>
  palette: LoginPalette
  error?: string | null
}

export function LoginField({
  label,
  icon: Icon,
  palette,
  error,
  secureTextEntry,
  onFocus,
  onBlur,
  style,
  ...props
}: LoginFieldProps) {
  const [focused, setFocused] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const isPassword = Boolean(secureTextEntry)
  const borderColor = error ? palette.error : focused ? palette.focus : palette.border

  return (
    <View style={styles.wrapper}>
      <AppText variant="caption" style={[styles.label, { color: palette.text }]}>{label}</AppText>
      <View
        style={[
          styles.field,
          {
            paddingRight: isPassword ? 8 : 16,
            backgroundColor: palette.field,
            borderColor,
            boxShadow: focused ? `0 0 0 4px ${palette.focusRing}` : undefined,
          },
        ]}
      >
        <Icon accessible={false} size={18} strokeWidth={1.7} color={focused ? palette.focus : palette.subtle} />
        <TextInput
          {...props}
          secureTextEntry={isPassword && !revealed}
          accessibilityLabel={props.accessibilityLabel ?? label}
          placeholderTextColor={palette.subtle}
          onFocus={(event) => { setFocused(true); onFocus?.(event) }}
          onBlur={(event) => { setFocused(false); onBlur?.(event) }}
          style={[styles.input, typeStyles.body, { color: palette.text }, style]}
        />
        {isPassword ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Ocultar senha' : 'Mostrar senha'}
            accessibilityState={{ selected: revealed }}
            hitSlop={4}
            onPress={() => setRevealed((current) => !current)}
            style={({ pressed }) => [styles.reveal, pressed && { opacity: 0.6 }]}
          >
            {revealed
              ? <EyeOff accessible={false} size={18} strokeWidth={1.7} color={palette.subtle} />
              : <Eye accessible={false} size={18} strokeWidth={1.7} color={palette.subtle} />}
          </Pressable>
        ) : null}
      </View>
      {error ? <AppText variant="caption" style={{ color: palette.error }} accessibilityRole="alert">{error}</AppText> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: { gap: 8 },
  label: { paddingLeft: 4, fontWeight: '600' },
  field: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 16,
    borderWidth: 1,
    borderRadius: 18,
    borderCurve: 'continuous',
  },
  input: { flex: 1, minWidth: 0, paddingVertical: 12 },
  reveal: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderCurve: 'continuous' },
})
```

- [ ] **Step 2: Definir a interface do formulário**

Start `login-form.tsx` with these imports, props and states:

```tsx
import { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native'
import { ArrowRight, Lock, Mail } from 'lucide-react-native'
import { useReducedMotion } from 'react-native-reanimated'
import { AppText } from '@/components/primitives/app-text'
import { brand } from '@/theme'
import type { AuthContextValue } from './auth-context'
import { BiometricButton } from './biometric-button'
import { LoginField } from './login-field'
import type { LoginPalette } from './login-theme'

type LoginFormProps = {
  palette: LoginPalette
  signIn: AuthContextValue['signIn']
  authMessage: string | null
  forbidden: boolean
  onReturnToForm(): void
}

export function LoginForm({ palette, signIn, authMessage, forbidden, onReturnToForm }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const reducedMotion = useReducedMotion()
  const alert = formError ?? authMessage
  const blocked = !email || !password || submitting
```

- [ ] **Step 3: Preservar o fluxo seguro existente**

Implement submission exactly once while pending:

```tsx
async function submit() {
  if (submitting) return
  const normalizedEmail = email.trim()
  const validEmail = /^\S+@\S+\.\S+$/.test(normalizedEmail)
  setEmailError(validEmail ? null : 'Informe um e-mail válido.')
  if (!validEmail || !password) return

  setFormError(null)
  setSubmitting(true)
  try {
    await signIn({ email: normalizedEmail, password })
  } catch (error) {
    setFormError(error instanceof Error && error.message ? error.message : 'Não foi possível entrar. Tente novamente.')
  } finally {
    setSubmitting(false)
  }
}
```

Do not clear either field in the `catch` branch.

- [ ] **Step 4: Montar cabeçalho, alertas e campos**

Open the component return with the surface, alert and approved labels:

```tsx
return (
  <View style={[styles.surface, { backgroundColor: palette.surface, borderColor: palette.border }]}>
    {alert ? (
      <View style={[styles.alert, { backgroundColor: palette.errorSurface }]}>
        <AppText variant="caption" style={{ color: palette.error }} accessibilityRole="alert">{alert}</AppText>
        {forbidden ? (
          <Pressable accessibilityRole="button" onPress={onReturnToForm} style={styles.returnAction}>
            <AppText variant="label" style={{ color: palette.error }}>Voltar ao formulário</AppText>
          </Pressable>
        ) : null}
      </View>
    ) : null}

<View style={styles.formHeading}>
  <AppText variant="title" style={{ color: palette.text }}>Entrar</AppText>
  <AppText variant="caption" style={{ color: palette.subtle }}>Credenciais de administrador</AppText>
</View>

<LoginField
  label="E-mail"
  icon={Mail}
  palette={palette}
  value={email}
  onChangeText={(value) => { setEmail(value); setFormError(null) }}
  placeholder="voce@tavvi.com"
  keyboardType="email-address"
  autoCapitalize="none"
  autoCorrect={false}
  autoComplete="email"
  textContentType="emailAddress"
  returnKeyType="next"
  error={emailError}
/>

<LoginField
  label="Senha"
  icon={Lock}
  palette={palette}
  value={password}
  onChangeText={(value) => { setPassword(value); setFormError(null) }}
  placeholder="Sua senha"
  secureTextEntry
  autoComplete="password"
  textContentType="password"
  returnKeyType="go"
  onSubmitEditing={() => void submit()}
/>
```

Do not render “Esqueci a senha” because no complete recovery destination exists.

- [ ] **Step 5: Criar o CTA com glow e cápsula de seta**

Render a `Pressable` plus `BiometricButton` in the same row:

```tsx
<View style={styles.actions}>
  <Pressable
    accessibilityRole="button"
    accessibilityLabel="Entrar no console"
    accessibilityState={{ disabled: blocked, busy: submitting }}
    disabled={blocked}
    onPress={() => void submit()}
    style={({ pressed }) => [
      styles.submit,
      {
        backgroundColor: brand.lime,
        opacity: blocked ? 0.5 : pressed ? 0.88 : 1,
        boxShadow: blocked ? undefined : `0 10px 28px -10px ${brand.limeGlow}`,
        transform: [{ scale: pressed && !blocked && !reducedMotion ? 0.985 : 1 }],
      },
    ]}
  >
    <AppText variant="label" style={{ color: brand.ink }}>
      {submitting ? 'Entrando…' : 'Entrar no console'}
    </AppText>
    <View style={styles.submitIcon}>
      {submitting ? <ActivityIndicator color={brand.lime} /> : <ArrowRight accessible={false} size={18} color={brand.lime} strokeWidth={2.2} />}
    </View>
  </Pressable>
  <BiometricButton colors={palette} />
</View>
  </View>
)
}
```

The action row closes the surface and the component return after the password field from Step 4.

- [ ] **Step 6: Preservar o retorno do estado forbidden**

The alert block from Step 4 already renders the existing `authMessage` plus a real secondary action when `forbidden` is true:

```tsx
<Pressable accessibilityRole="button" onPress={onReturnToForm}>
  <AppText variant="label" style={{ color: palette.error }}>Voltar ao formulário</AppText>
</Pressable>
```

For ordinary login errors, the same block renders only the message with `accessibilityRole="alert"`.

- [ ] **Step 7: Adicionar os estilos exatos do formulário**

Append to `login-form.tsx`:

```tsx
const styles = StyleSheet.create({
  surface: {
    borderWidth: 1,
    borderRadius: 28,
    borderCurve: 'continuous',
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 18,
    gap: 16,
  },
  formHeading: {
    minHeight: 28,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    columnGap: 12,
    rowGap: 4,
    paddingHorizontal: 4,
  },
  alert: { gap: 8, padding: 12, borderRadius: 14, borderCurve: 'continuous' },
  returnAction: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  submit: {
    minHeight: 58,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 22,
    paddingRight: 7,
    borderRadius: 20,
    borderCurve: 'continuous',
  },
  submitIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    borderCurve: 'continuous',
    backgroundColor: brand.ink,
  },
})
```

- [ ] **Step 8: Fazer inspeção estática do formulário**

Run:

```powershell
rg -n "Esqueci|submitting\) return|accessibilityRole=\"alert\"|autoComplete=\"email\"|autoComplete=\"password\"|Entrar no console|BiometricButton" src\features\auth\login-form.tsx src\features\auth\login-field.tsx
```

Expected: “Esqueci” não aparece; guard de submissão, alertas, autofill, CTA e biometria aparecem.

---

### Task 6: Montar a tela responsiva e verificar manualmente

**Files:**

- Modify: `src/features/auth/login-screen.tsx:1-end`

**Interfaces:**

- Consumes: `useAuth`, `useAppTheme`, `LoginBackdrop`, `LoginHero`, `LoginForm`, `getLoginPalette` e wordmark oficial.
- Produces: rota `/entrar` visualmente completa sem alterar o contrato de autenticação.

- [ ] **Step 1: Substituir a composição atual por um shell responsivo**

Use this component structure in `login-screen.tsx`:

```tsx
import { Image } from 'expo-image'
import { KeyboardAvoidingView, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppText } from '@/components/primitives/app-text'
import { brand, spacing, useAppTheme } from '@/theme'
import { LoginBackdrop } from './login-backdrop'
import { LoginForm } from './login-form'
import { LoginHero } from './login-hero'
import { getLoginPalette } from './login-theme'
import { useAuth } from './auth-context'

const wordmark = require('../../../assets/images/brand/tavvi-wordmark.png')

export function LoginScreen() {
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const { resolved, preference, setPreference } = useAppTheme()
  const { signIn, message, status, returnToForm } = useAuth()
  const palette = getLoginPalette(resolved)
  const contentWidth = Math.min(Math.max(width - spacing.x6 * 2, 0), 440)
  const year = new Date().getFullYear()

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: palette.screen }]}
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
    >
      <LoginBackdrop palette={palette} />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: Math.max(insets.top + 12, spacing.x6),
            paddingBottom: Math.max(insets.bottom + spacing.x5, spacing.x8),
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.content, { width: contentWidth }]}>
          <LoginHero
            width={contentWidth}
            palette={palette}
            preference={preference}
            onThemeChange={setPreference}
          />
          <LoginForm
            palette={palette}
            signIn={signIn}
            authMessage={message}
            forbidden={status === 'forbidden'}
            onReturnToForm={returnToForm}
          />
          <View style={styles.spacer} />
          <View style={styles.footer}>
            <Image
              source={wordmark}
              contentFit="contain"
              accessible={false}
              tintColor={resolved === 'light' ? brand.ink : undefined}
              style={styles.wordmark}
            />
            <View style={[styles.dot, { backgroundColor: palette.border }]} />
            <AppText variant="caption" style={{ color: palette.subtle }}>Tavvi · {year}</AppText>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
```

- [ ] **Step 2: Definir o ritmo de layout sem altura fixa**

Use these base styles:

```tsx
const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: 'center', paddingHorizontal: spacing.x3 },
  content: { flexGrow: 1, gap: spacing.x4 },
  spacer: { flex: 1, minHeight: spacing.x5 },
  footer: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.x2 },
  wordmark: { width: 44, height: 16, opacity: 0.5 },
  dot: { width: 3, height: 3, borderRadius: 2 },
})
```

No screen, hero or form receives a fixed device height. Only the hero component has a designed internal height of 264 dp.

The light theme applies a monochrome ink tint to the provided white wordmark; the dark theme preserves its original white-and-green rendering. This uses the supplied monochromatic brand treatment rather than drawing the wordmark as text.

- [ ] **Step 3: Iniciar o servidor de desenvolvimento permitido**

Run:

```powershell
npx expo start --clear
```

Expected: Metro starts without module-resolution errors. Do not run any prohibited verification command.

- [ ] **Step 4: Verificar o recorte e a hierarquia no tema escuro**

On a native target, confirm manually:

1. no canto superior direito, the screen background is genuinely visible through the missing shape;
2. no seam or rectangular cover appears around the toggle;
3. the brandmark remains secondary to the heading;
4. the CTA glow is visible but does not wash out the form;
5. the official assets are sharp and keep their proportions.

- [ ] **Step 5: Verificar os três temas**

Cycle `system → light → dark → system` from the hero control. Confirm:

1. preference survives a reload;
2. status bar and native background follow the resolved theme;
3. hero remains brand-dark in both themes;
4. form, fields, borders and body text adapt;
5. focus and disabled states remain distinguishable in light and dark.

- [ ] **Step 6: Verificar teclado e tamanhos extremos**

Exercise a 375 dp phone, a larger phone and landscape/tablet width:

1. focus email, then password;
2. keep the keyboard open and scroll to the CTA;
3. enable the largest practical system text size;
4. confirm heading and form header reflow without overlap;
5. confirm footer remains reachable rather than fixed over the keyboard.

- [ ] **Step 7: Verificar estados de autenticação manualmente**

Exercise:

1. invalid email — inline error beside the field;
2. wrong credentials — values preserved and safe alert announced;
3. repeated quick taps — one pending submission and one spinner;
4. valid admin — existing redirect to `/`;
5. valid user without admin role — forbidden message plus “Voltar ao formulário”.

- [ ] **Step 8: Verificar estados biométricos sem alegar Face ID no Expo Go**

Confirm these observable states where devices are available:

1. web or no hardware — disabled button with accessible reason;
2. hardware without enrollment — disabled button with enrollment reason;
3. enrolled fingerprint/face — correct label and explanatory alert;
4. reduced motion — no unnecessary rotational flourish.

Record in the delivery that iOS Face ID itself was not validated in Expo Go. A later authorized development build is required for that modality.

- [ ] **Step 9: Fazer a inspeção final permitida**

Run only read-only searches:

```powershell
rg -n "TV|Console da plataforma|v4\.2|Console privado|Esqueci a senha" src\features\auth
rg -n "brandmark|lockup|wordmark|createHeroPath|BiometricButton|new Date\(\)\.getFullYear" src\features\auth
```

Expected: copy antiga e monograma provisório não aparecem; assets oficiais, shape, biometria e ano dinâmico aparecem.

- [ ] **Step 10: Entregar limitações verificadas**

The final handoff must state:

- which native platforms/devices were actually opened;
- which auth states required credentials or environment access;
- that Face ID needs a development build;
- that no git, build, lint, typecheck or tests were run;
- that biometric session unlock and password recovery remain outside this approved scope.
