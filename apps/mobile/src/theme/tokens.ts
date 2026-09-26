export const brand = {
  ink: '#0A0C09',
  hero: '#121510',
  heroEnd: '#0E120C',
  heroRaised: '#181B15',
  onDark: '#F4F6F0',
  mutedOnDark: '#A9AEA3',
  subtleOnDark: '#7D8278',
  lineOnDark: 'rgba(244,246,240,0.10)',
} as const

export const palettes = {
  dark: {
    background: '#0A0C09', surface: '#11130F', field: '#181B15', foreground: '#F4F6F0', muted: '#A9AEA3', subtle: '#7D8278',
    line: 'rgba(244,246,240,0.08)', line2: 'rgba(244,246,240,0.14)', scrim: 'rgba(0,0,0,0.55)', shadow: '0 20px 40px -16px rgba(0,0,0,0.7)',
    successText: '#79C77C', successSurface: '#1A2F1B',
    warningText: '#E7AF5C', warningSurface: '#382810', neutralText: '#A9AEA3', neutralSurface: 'rgba(244,246,240,0.07)',
    dangerText: '#FF8A84', dangerSurface: '#3A1715',
  },
  light: {
    background: '#EEF0E8', surface: '#FFFFFF', field: '#F5F7F1', foreground: '#11150F', muted: '#62675E', subtle: '#6B7167',
    line: 'rgba(10,12,9,0.09)', line2: 'rgba(10,12,9,0.16)', scrim: 'rgba(10,12,9,0.32)', shadow: '0 20px 40px -18px rgba(30,40,20,0.28)',
    successText: '#267D30', successSurface: '#DFF6DE',
    warningText: '#A06700', warningSurface: '#FFF0CC', neutralText: '#62675E', neutralSurface: 'rgba(10,12,9,0.06)',
    dangerText: '#B42318', dangerSurface: '#FEE4E2',
  },
} as const

export const spacing = { x1: 4, x2: 8, x3: 12, x4: 16, x5: 20, x6: 24, x8: 32, x12: 48 } as const
export const layout = { screenHorizontal: 18, listBlockGap: 14, listRowGap: 10, contentTop: 10, dockBottom: 22, dockHeight: 64, dockReserve: 110 } as const
export const radii = {
  chip: 12, tileSm: 13, tile: 14, button: 15, control: 16, search: 17, field: 18, cta: 20, card: 22,
  panel: 24, overlay: 26, dialog: 28, hero: 30, sheet: 34, full: 999,
} as const
export const shadows = {
  light: { low: '0 1px 3px rgba(30,40,20,0.08)', raised: palettes.light.shadow },
  dark: { low: '0 1px 3px rgba(0,0,0,0.24)', raised: palettes.dark.shadow },
} as const
export const motion = { press: 120, fast: 150, panelIn: 220, panelOut: 160, easeOut: [0.16, 1, 0.3, 1] as const } as const
export type AppColors = (typeof palettes)[keyof typeof palettes] & {
  accent: string; accentPressed: string; accentOn: string; accentTextLight: string; accentTextDark: string; accentSoft: string; accentGlow: string
  accentCtaGlow: string; accentHeroGlow: string; accentFocus: string; accentRing: string; accentText: string; accentSurface: string
  accentPill: string; accentPillOn: string
}
