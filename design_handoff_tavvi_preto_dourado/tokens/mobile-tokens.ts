// Tavvi · preto e dourado — proposta para apps/mobile/src/theme/tokens.ts e typography.ts.
// Mantém os mesmos nomes de chave de `palettes` para a troca ser mecânica.

export const brand = {
  gold: '#D0AC6E',
  goldDeep: '#B38B4D',
  goldText: '#D6B67C',
  goldSoft: 'rgba(208,172,110,0.13)',
  ink: '#17150F',
  hero: '#0D0C0A',
  heroRaised: '#1A1916',
  heroField: '#232120',
  onDark: '#F2EEE6',
  mutedOnDark: '#A6A094',
  subtleOnDark: '#7C766B',
  lineOnDark: 'rgba(255,248,235,0.10)',
  heroGradient: ['#DDBF8A', '#C9A266', '#B48A4E'] as const,
  heroGradientDark: ['#CFAE72', '#B28A4C', '#8F6B35'] as const,
  heroInk: '#1D170E',
} as const

export const palettes = {
  light: {
    background: '#F2F0EB', surface: '#FFFFFF', field: '#F8F6F2', foreground: '#17150F', muted: '#6A655B', subtle: '#8F8A80',
    line: 'rgba(22,20,15,0.08)', line2: 'rgba(22,20,15,0.14)', scrim: 'rgba(22,20,15,0.28)', shadow: '0 18px 44px -12px rgba(22,20,15,0.22)',
    bar: 'rgba(250,249,246,0.86)',
    accent: '#B38B4D', accentText: '#86622C', accentSurface: '#F3EBDD',
    button: '#17150F', buttonText: '#FFFFFF',
    successText: '#3C7A4E', successSurface: '#E4EFE5',
    warningText: '#94660F', warningSurface: '#F5EAD2',
    neutralText: '#6A655B', neutralSurface: 'rgba(22,20,15,0.055)',
    dangerText: '#B2372C', dangerSurface: '#F7E3DF',
  },
  dark: {
    background: '#0D0C0A', surface: '#1A1916', field: '#211F1C', foreground: '#F2EEE6', muted: '#A6A094', subtle: '#7C766B',
    line: 'rgba(255,248,235,0.08)', line2: 'rgba(255,248,235,0.14)', scrim: 'rgba(0,0,0,0.5)', shadow: '0 24px 56px -12px rgba(0,0,0,0.7)',
    bar: 'rgba(20,19,17,0.86)',
    accent: '#D0AC6E', accentText: '#D6B67C', accentSurface: 'rgba(208,172,110,0.13)',
    button: '#D0AC6E', buttonText: '#15120C',
    successText: '#86C595', successSurface: 'rgba(134,197,149,0.13)',
    warningText: '#E0B465', warningSurface: 'rgba(224,180,101,0.13)',
    neutralText: '#A6A094', neutralSurface: 'rgba(255,248,235,0.07)',
    dangerText: '#EE8C80', dangerSurface: 'rgba(238,140,128,0.13)',
  },
} as const

export const spacing = { x1: 4, x2: 8, x3: 12, x4: 16, x5: 20, x6: 24, x8: 32, x12: 48 } as const
export const layout = { screenHorizontal: 16, groupGap: 22, rowMinHeight: 44, listRowHeight: 62, tabBarHeight: 84 } as const
export const radii = { chip: 999, tile: 10, tileLg: 13, field: 13, group: 14, card: 20, sheet: 14, button: 999, full: 999 } as const
export const sizes = { button: 50, buttonLg: 52, field: 48, chip: 32, switchW: 51, switchH: 31, avatar: 36, tile: 34, tabIcon: 24 } as const
export const motion = { press: 120, fast: 150, panelIn: 220, panelOut: 160, easeOut: [0.2, 0.8, 0.2, 1] as const } as const
export type AppColors = (typeof palettes)[keyof typeof palettes]

// typography.ts — fonte do sistema (SF Pro no iOS). Sem fontFamily = System.
export const typeStyles = {
  largeTitle: { fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -0.8 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.4 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 21, fontWeight: '400' },
  button: { fontSize: 16, lineHeight: 21, fontWeight: '600' },
  rowTitle: { fontSize: 15, lineHeight: 20, fontWeight: '500' },
  callout: { fontSize: 14, lineHeight: 19, fontWeight: '400' },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  groupHeader: { fontSize: 13, lineHeight: 18, fontWeight: '400', textTransform: 'uppercase', letterSpacing: 0.26 },
  badge: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  tab: { fontSize: 10.5, lineHeight: 13, fontWeight: '500' },
} as const

export const tabularNumbers = { fontVariant: ['tabular-nums'] as const }
