import type { ThemePresetId } from '@/domain/theme'
import { contrastRatio, fitContrast, hexToOklch, oklchToHex } from '@/lib/color'
import { isBaseInRange, PRESETS } from '@/lib/theme/presets'
import { CONTRAST_MINIMUMS } from '@/lib/theme/resolve'

// Aproxima cada canal sRGB do branco ou do preto na proporção pedida. É a
// mistura do protótipo (README §7.7): cinco tons vizinhos da cor do tema, e
// não uma grade inteira de variações.
function mix(hex: string, toward: 'white' | 'black', amount: number): string {
  const target = toward === 'white' ? 255 : 0
  const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16))
  return `#${channels
    .map((value) => Math.round(value + (target - value) * amount).toString(16).padStart(2, '0'))
    .join('')}`
}

// Leva a cor para dentro da faixa do tema mexendo só no que sobra dela —
// luminosidade e croma —, preservando o matiz. Devolve null quando nem assim
// ela entra, o que o arredondamento do hex às vezes provoca na borda.
function clampToBaseRange(presetId: ThemePresetId, hex: string): string | null {
  if (isBaseInRange(presetId, hex)) return hex
  const { baseRange } = PRESETS[presetId]
  const { l, c, h } = hexToOklch(hex)
  const clamped = oklchToHex({
    l: Math.min(baseRange.l[1], Math.max(baseRange.l[0], l)),
    c: Math.min(baseRange.c[1], Math.max(baseRange.c[0], c)),
    h,
  })
  return isBaseInRange(presetId, clamped) ? clamped : null
}

function unique(colors: (string | null)[]): string[] {
  const seen = new Set<string>()
  return colors.filter((color): color is string => {
    if (!color || seen.has(color.toLowerCase())) return false
    seen.add(color.toLowerCase())
    return true
  })
}

export function getBaseOptions(presetId: ThemePresetId, current: string): string[] {
  const base = PRESETS[presetId].light.base
  // Brasa e Neon têm a face clara escura: os vizinhos próximos clareiam e o
  // distante escurece. Nos outros temas é o contrário.
  const deep = hexToOklch(base).l < 0.5
  const near = deep ? 'white' : 'black'
  const far = deep ? 'black' : 'white'
  const options = unique(
    [base, mix(base, near, 0.03), mix(base, near, 0.06), mix(base, near, 0.09), mix(base, far, 0.4)]
      .map((color) => clampToBaseRange(presetId, color)),
  )

  // Um fundo gravado antes desta lista continua visível e marcado.
  return isBaseInRange(presetId, current) ? unique([...options, current]) : options
}

// A cor de destaque só é oferecida se já for legível, SEM AJUSTE, sobre o
// fundo que o dono está vendo, e se tiver uma versão possível no cardápio
// escuro. Assim nenhuma bolinha leva a um aviso: o que se escolhe é o que vai
// ao ar na face clara, e a escura ajusta só a luminosidade, sozinha.
export function isAccentUsable(presetId: ThemePresetId, accent: string, base: string): boolean {
  return (
    contrastRatio(accent, base) >= CONTRAST_MINIMUMS.accent &&
    fitContrast(accent, PRESETS[presetId].dark.base, CONTRAST_MINIMUMS.accent) !== null
  )
}

export function getAccentOptions(presetId: ThemePresetId, base: string, current: string): string[] {
  const source = PRESETS[presetId].light.accent
  const options = unique(
    [source, mix(source, 'black', 0.15), mix(source, 'black', 0.3), mix(source, 'white', 0.15), mix(source, 'white', 0.28)]
      // Um tom que não alcança o piso sobre este fundo é puxado até ele, e
      // só então entra na lista — nunca entra reprovado.
      .map((color) => fitContrast(color, base, CONTRAST_MINIMUMS.accent))
      .filter((color): color is string => color !== null && isAccentUsable(presetId, color, base)),
  )

  return isAccentUsable(presetId, current, base) ? unique([...options, current]) : options
}
