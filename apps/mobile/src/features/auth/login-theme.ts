import { brand, type ResolvedTheme } from '@/theme'

export const loginPalettes = {
  light: {
    screen: '#EEF0E8',
    surface: '#FFFFFF',
    field: '#F5F7F1',
    text: '#11150F',
    muted: '#62675E',
    subtle: '#6B7167',
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
