export function contrastRatio(foreground: string, background: string): number
export function suggestOnAccent(hex: string): { color: string; contrastRatio: number }
export function resolveTextAccent(accent: string, surface: string): string
