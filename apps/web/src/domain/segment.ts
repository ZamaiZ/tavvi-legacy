import { PRESETS } from '@/lib/theme/presets'
import type { ThemePresetId } from '@/domain/theme'

// O tipo de negócio do restaurante. Sessenta tipos não viram sessenta temas —
// viram um atalho de onboarding: escolhido o segmento, o tema típico dele já
// vem sugerido, e o dono confirma num clique ou troca.
//
// A lista é DERIVADA dos presets, e não escrita de novo aqui. É o que impede
// um segmento apontar para um tema que não existe mais depois de um deploy, e
// o que garante que acrescentar um tema já traga os segmentos dele junto.
export type Segment = { label: string; preset: ThemePresetId }

export const SEGMENTS: readonly Segment[] = Object.values(PRESETS).flatMap(
  (preset) => preset.segments.map((label) => ({ label, preset: preset.id })),
)

// Ordenada para a lista de escolha, que é alfabética para quem procura. A
// agrupada por tema fica com o seletor, não com o dado.
export const SORTED_SEGMENTS: readonly Segment[] = [...SEGMENTS].sort(
  (a, b) => a.label.localeCompare(b.label, 'pt-BR'),
)

export function suggestPresetFor(label: string | null): ThemePresetId | null {
  if (!label) return null
  return SEGMENTS.find((segment) => segment.label === label)?.preset ?? null
}
