import type { ThemePresetId } from '@/domain/theme'
import { fitContrast, hexToOklch, oklchToHex } from '@/lib/color'
import { isBaseInRange, PRESETS } from '@/lib/theme/presets'
import { CONTRAST_MINIMUMS } from '@/lib/theme/resolve'

export function getBaseOptions(presetId: ThemePresetId): string[] {
  const preset = PRESETS[presetId]
  const { l, c } = preset.baseRange
  const hue = hexToOklch(preset.light.base).h
  const options = new Set<string>([preset.light.base])

  for (let lightness = l[0]; lightness <= l[1] + 0.0001; lightness += 0.035) {
    for (let chroma = c[0]; chroma <= c[1] + 0.0001; chroma += 0.012) {
      const color = oklchToHex({ l: lightness, c: chroma, h: hue })
      if (isBaseInRange(presetId, color)) options.add(color)
    }
  }

  return [...options]
}

export function getAccentOptions(presetId: ThemePresetId, base: string, accent: string): string[] {
  const preset = PRESETS[presetId]
  const source = hexToOklch(preset.light.accent)
  const candidates = new Set<string>()

  for (const hueDelta of [-30, -20, -10, 0, 10, 20, 30]) {
    for (const lightDelta of [-0.08, 0, 0.08]) {
      const color = oklchToHex({
        l: Math.max(0.2, Math.min(0.88, source.l + lightDelta)),
        c: source.c,
        h: (source.h + hueDelta + 360) % 360,
      })
      if (fitContrast(color, base, CONTRAST_MINIMUMS.accent) && fitContrast(color, preset.dark.base, CONTRAST_MINIMUMS.accent)) {
        candidates.add(color)
      }
    }
  }

  if (fitContrast(accent, base, CONTRAST_MINIMUMS.accent) && fitContrast(accent, preset.dark.base, CONTRAST_MINIMUMS.accent)) {
    candidates.add(accent)
  }

  return [...candidates]
}
