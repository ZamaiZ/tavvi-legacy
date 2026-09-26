import type { PlatformAppearanceSource, PlatformPalette } from './index.js'
export const DEFAULT_APPEARANCE: Readonly<PlatformAppearanceSource>
export const PALETTE_SCHEMA_VERSION: 1
export function derivePlatformPalette(source: PlatformAppearanceSource): PlatformPalette
export function suggestOnAccent(hex: string): { color: string; contrastRatio: number }
