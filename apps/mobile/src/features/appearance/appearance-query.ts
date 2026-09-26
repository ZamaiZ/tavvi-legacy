import { API_ROUTES, platformAppearanceSchema, type PlatformAppearance } from '@tavvi/api-contracts'
import { PALETTE_SCHEMA_VERSION } from '@tavvi/theme-core'
import { publicApiRequest } from '@/lib/api-client'

export const appearanceQueryKey = ['platform-appearance'] as const

export async function fetchPlatformAppearance(): Promise<PlatformAppearance> {
  const raw = await publicApiRequest<unknown>(API_ROUTES.platform.appearance)
  const parsed = platformAppearanceSchema.parse(raw)
  if (parsed.schemaVersion !== PALETTE_SCHEMA_VERSION) throw new Error('A versão da identidade visual não é compatível.')
  return parsed
}
