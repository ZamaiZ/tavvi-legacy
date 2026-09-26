export type PlatformAppearanceSource = { brandAccent: string; onAccentOverride: string | null }
export type AccentPalette = {
  accent: string; 'accent-pressed': string; 'accent-on': string; 'accent-text-light': string; 'accent-text-dark': string
  'accent-soft': string; 'accent-glow': string; 'accent-cta-glow': string; 'accent-hero-glow': string
  'accent-focus': string; 'accent-ring': string; 'accent-pill': string; 'accent-pill-on': string; 'accent-surface': string
}
export type PlatformPalette = { light: AccentPalette; dark: AccentPalette }
export function normalizeHex(value: unknown): string | null
export function hexToRgb(hex: string): number[] | null
export function rgbToHex(rgb: number[]): string
export function toOklch(hex: string): { L: number; C: number; h: number } | null
export function fromOklch(color: { L: number; C: number; h: number }): string
export function mixHex(foreground: string, background: string, amount: number): string
export function rgba(hex: string, alpha: number): string
export function relativeLuminance(hex: string): number
export function contrastRatio(foreground: string, background: string): number
export function suggestOnAccent(hex: string): { color: string; contrastRatio: number }
export function resolveTextAccent(accent: string, surface: string): string
export const DEFAULT_APPEARANCE: Readonly<PlatformAppearanceSource>
export const PALETTE_SCHEMA_VERSION: 1
export function derivePlatformPalette(source: PlatformAppearanceSource): PlatformPalette
