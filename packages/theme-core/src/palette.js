import { fromOklch, mixHex, rgba, toOklch } from './color.js'
import { resolveTextAccent, suggestOnAccent } from './contrast.js'

export const DEFAULT_APPEARANCE = Object.freeze({ brandAccent: '#2563EB', onAccentOverride: null })
export const PALETTE_SCHEMA_VERSION = 1

function derivePressed(accent) {
  const color = toOklch(accent)
  if (!color) return '#1D4ED8'
  const delta = color.L > 0.62 ? -0.09 : 0.07
  return fromOklch({ ...color, L: Math.max(0.18, Math.min(0.9, color.L + delta)) })
}

function deriveTheme(accent, onAccent, surface, darkSurface) {
  const pill = mixHex(accent, darkSurface, 0.2)
  return {
    accent,
    'accent-pressed': derivePressed(accent),
    'accent-on': onAccent,
    'accent-text-light': resolveTextAccent(accent, '#FFFFFF'),
    'accent-text-dark': resolveTextAccent(accent, '#11130F'),
    'accent-soft': rgba(accent, 0.12),
    'accent-glow': rgba(accent, 0.26),
    'accent-cta-glow': rgba(accent, 0.38),
    'accent-hero-glow': rgba(accent, 0.18),
    'accent-focus': resolveTextAccent(accent, surface),
    'accent-ring': rgba(accent, 0.3),
    'accent-pill': pill,
    'accent-pill-on': suggestOnAccent(pill).color,
    'accent-surface': rgba(accent, 0.12),
  }
}

export function derivePlatformPalette(source) {
  const accent = source?.brandAccent?.toUpperCase()
  const resolved = suggestOnAccent(accent)
  const onAccent = source?.onAccentOverride?.toUpperCase() ?? resolved.color
  return {
    light: deriveTheme(accent, onAccent, '#FFFFFF', '#EEF0E8'),
    dark: deriveTheme(accent, onAccent, '#11130F', '#0A0C09'),
  }
}

export { suggestOnAccent }
