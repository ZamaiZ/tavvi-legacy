import { brand, palettes, type ResolvedTheme } from '@/theme'

export const loginPalettes = {
  light: {
    screen: palettes.light.background,
    surface: palettes.light.surface,
    field: palettes.light.field,
    text: palettes.light.foreground,
    muted: palettes.light.muted,
    subtle: palettes.light.subtle,
    border: palettes.light.line2,
    focus: palettes.light.goldText,
    error: palettes.light.dangerText,
    errorSurface: palettes.light.dangerSurface,
  },
  dark: {
    screen: palettes.dark.background,
    surface: palettes.dark.surface,
    field: palettes.dark.field,
    text: palettes.dark.foreground,
    muted: palettes.dark.muted,
    subtle: palettes.dark.subtle,
    border: palettes.dark.line2,
    focus: palettes.dark.goldText,
    error: palettes.dark.dangerText,
    errorSurface: palettes.dark.dangerSurface,
  },
} as const

export type LoginPalette = {
  screen: string
  surface: string
  field: string
  text: string
  muted: string
  subtle: string
  border: string
  focus: string
  error: string
  errorSurface: string
  button: string
  buttonText: string
  heroStart: string
  heroEnd: string
  heroText: string
  heroMuted: string
  accent: string
  accentOn: string
  accentSoft: string
  accentTextDark: string
  accentPill: string
  accentPillOn: string
}

export function getLoginPalette(theme: ResolvedTheme): LoginPalette {
  const accent = theme === 'dark' ? palettes.dark.gold : palettes.light.gold
  const accentText = theme === 'dark' ? palettes.dark.goldText : palettes.light.goldText
  return {
    ...loginPalettes[theme],
    button: theme === 'dark' ? palettes.dark.button : palettes.light.button,
    buttonText: theme === 'dark' ? palettes.dark.buttonText : palettes.light.buttonText,
    heroStart: brand.hero,
    heroEnd: '#11100E',
    heroText: brand.onDark,
    heroMuted: brand.mutedOnDark,
    accent,
    accentOn: theme === 'dark' ? '#15120C' : '#17150F',
    accentSoft: theme === 'dark' ? palettes.dark.goldSoft : palettes.light.goldSoft,
    accentTextDark: accentText,
    accentPill: theme === 'dark' ? palettes.dark.goldSoft : 'rgba(255,255,255,0.22)',
    accentPillOn: theme === 'dark' ? palettes.dark.goldText : '#17120A',
  }
}
