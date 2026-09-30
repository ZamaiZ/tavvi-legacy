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
    background: '#F5F3EE', surface: '#FFFFFF', field: '#F8F6F2', foreground: '#17150F', muted: '#6A655B', subtle: '#8F8A80',
    line: 'rgba(22,20,15,0.08)', line2: 'rgba(22,20,15,0.14)', scrim: 'rgba(22,20,15,0.26)', shadow: '0 1px 2px rgba(22,20,15,0.04)',
    bar: 'rgba(250,249,246,0.86)', gold: '#B38B4D', goldText: '#86622C', goldSoft: '#F3EBDD',
    goldInk: '#17150F',
    button: '#17150F', buttonText: '#FFFFFF',
    successText: '#3C7A4E', successSurface: '#E4EFE5', warningText: '#94660F', warningSurface: '#F5EAD2',
    neutralText: '#6A655B', neutralSurface: 'rgba(22,20,15,0.055)', dangerText: '#B2372C', dangerSurface: '#F7E3DF',
  },
  dark: {
    background: '#0D0C0A', surface: '#1A1916', field: '#211F1C', foreground: '#F2EEE6', muted: '#A6A094', subtle: '#7C766B',
    line: 'rgba(255,248,235,0.08)', line2: 'rgba(255,248,235,0.14)', scrim: 'rgba(0,0,0,0.55)', shadow: '0 24px 56px -12px rgba(0,0,0,0.7)',
    bar: 'rgba(20,19,17,0.86)', gold: '#D0AC6E', goldText: '#D6B67C', goldSoft: 'rgba(208,172,110,0.12)',
    goldInk: '#15120C',
    button: '#D0AC6E', buttonText: '#15120C',
    successText: '#86C595', successSurface: 'rgba(134,197,149,0.12)', warningText: '#E0B465', warningSurface: 'rgba(224,180,101,0.12)',
    neutralText: '#A6A094', neutralSurface: 'rgba(255,248,235,0.07)', dangerText: '#EE8C80', dangerSurface: 'rgba(238,140,128,0.12)',
  },
} as const

export const spacing = { x1: 4, x2: 8, x3: 12, x4: 16, x5: 20, x6: 24, x8: 32, x12: 48 } as const
export const layout = { screenHorizontal: 16, listBlockGap: 22, listRowGap: 8, contentTop: 10, contentBottom: 24 } as const
export const radii = {
  chip: 999, tileSm: 8, tile: 10, button: 999, control: 10, search: 11, field: 13, cta: 999, card: 14,
  panel: 16, overlay: 18, dialog: 16, hero: 20, sheet: 14, full: 999,
} as const
export const motion = { fast: 150, panelIn: 220, panelOut: 160, easeOut: [0.2, 0.8, 0.2, 1] as const } as const
export type AppColors = (typeof palettes)[keyof typeof palettes]
