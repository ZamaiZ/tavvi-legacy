export function normalizeHex(value: unknown): string | null
export function hexToRgb(hex: string): number[] | null
export function rgbToHex(rgb: number[]): string
export function toOklch(hex: string): { L: number; C: number; h: number } | null
export function fromOklch(color: { L: number; C: number; h: number }): string
export function mixHex(foreground: string, background: string, amount: number): string
export function rgba(hex: string, alpha: number): string
export function relativeLuminance(hex: string): number
