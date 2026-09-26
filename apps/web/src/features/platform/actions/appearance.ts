'use server'

import { ZodError } from 'zod'
import { savePlatformAppearance } from '@/server/api/platform-appearance'
import type { PlatformAppearanceSource } from '@tavvi/api-contracts'

export async function updatePlatformAppearanceAction(input: PlatformAppearanceSource) {
  try {
    return { ok: true as const, data: await savePlatformAppearance(input) }
  } catch (error) {
    if (error instanceof ZodError) return { ok: false as const, error: error.issues[0]?.message ?? 'Informe uma cor vÃ¡lida.' }
    return { ok: false as const, error: error instanceof Error ? error.message : 'NÃ£o foi possÃ­vel salvar a identidade visual.' }
  }
}
