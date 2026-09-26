import { brand, type AppColors, type ResolvedTheme } from '@/theme'

export const loginPalettes = {
  light: {
    screen: '#EEF0E8',
    surface: '#FFFFFF',
    field: '#F5F7F1',
    text: '#11150F',
    muted: '#62675E',
    subtle: '#6B7167',
    border: 'rgba(10,12,9,0.12)',
    focus: '#1D4ED8',
    focusRing: 'rgba(37,99,235,0.30)',
    error: '#B42318',
    errorSurface: '#FEE4E2',
    heroStart: brand.hero,
    heroEnd: '#0E120C',
    heroText: brand.onDark,
    heroMuted: brand.mutedOnDark,
    glow: 'rgba(37,99,235,0.18)',
  },
  dark: {
    screen: brand.ink,
    surface: '#11130F',
    field: brand.heroRaised,
    text: brand.onDark,
    muted: brand.mutedOnDark,
    subtle: brand.subtleOnDark,
    border: brand.lineOnDark,
    focus: '#8FB1FF',
    focusRing: 'rgba(37,99,235,0.30)',
    error: '#FF8A84',
    errorSurface: '#3A1715',
    heroStart: brand.hero,
    heroEnd: '#0E120C',
    heroText: brand.onDark,
    heroMuted: brand.mutedOnDark,
    glow: 'rgba(37,99,235,0.18)',
  },
} as const

type BaseLoginPalette = (typeof loginPalettes)[ResolvedTheme]
export type LoginPalette = { [Key in keyof BaseLoginPalette]: string } & {
  accent: string; accentOn: string; accentSoft: string; accentGlow: string; accentHeroGlow: string
  accentTextDark: string; accentPill: string; accentPillOn: string
}

export function getLoginPalette(theme: ResolvedTheme, colors: AppColors): LoginPalette {
  return { ...loginPalettes[theme], focus: colors.accentText, focusRing: colors.accentRing, glow: colors.accentHeroGlow, accent: colors.accent, accentOn: colors.accentOn, accentSoft: colors.accentSoft, accentGlow: colors.accentGlow, accentHeroGlow: colors.accentHeroGlow, accentTextDark: colors.accentTextDark, accentPill: colors.accentPill, accentPillOn: colors.accentPillOn }
}
