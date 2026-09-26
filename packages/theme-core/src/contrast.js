import { relativeLuminance, toOklch, fromOklch } from './color.js'

export function contrastRatio(foreground, background) {
  const values = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a)
  return (values[0] + 0.05) / (values[1] + 0.05)
}

export function suggestOnAccent(accentHex) {
  const black = '#000000'
  const white = '#FFFFFF'
  const blackRatio = contrastRatio(black, accentHex)
  const whiteRatio = contrastRatio(white, accentHex)
  const color = blackRatio >= whiteRatio ? black : white
  return { color, contrastRatio: Math.max(blackRatio, whiteRatio) }
}

export function resolveTextAccent(accentHex, surfaceHex) {
  const color = toOklch(accentHex)
  if (!color) return accentHex
  const candidates = Array.from({ length: 101 }, (_, index) => fromOklch({ ...color, L: index / 100 }))
  return candidates.sort((a, b) => {
    const aPass = contrastRatio(a, surfaceHex) >= 4.5
    const bPass = contrastRatio(b, surfaceHex) >= 4.5
    if (aPass !== bPass) return aPass ? -1 : 1
    const aDistance = Math.abs((toOklch(a)?.L ?? 0) - color.L)
    const bDistance = Math.abs((toOklch(b)?.L ?? 0) - color.L)
    return aDistance - bDistance
  })[0]
}
