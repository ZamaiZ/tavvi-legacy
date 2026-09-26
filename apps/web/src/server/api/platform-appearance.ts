import 'server-only'
import { API_ROUTES, platformAppearanceSchema, platformAppearanceSourceSchema, type PlatformAppearance, type PlatformAppearanceSource } from '@tavvi/api-contracts'
import { DEFAULT_APPEARANCE, PALETTE_SCHEMA_VERSION, derivePlatformPalette } from '@tavvi/theme-core'
import { createUserClient } from '@/server/dal/_client'
import { currentTerritory, requirePlatformAdmin } from '@/server/dal/auth'
import { env } from '@/server/env'

const endpoint = () => new URL(API_ROUTES.platform.appearance, env.API_BASE_URL)

function fallbackAppearance(): PlatformAppearance {
  return { source: DEFAULT_APPEARANCE, schemaVersion: PALETTE_SCHEMA_VERSION, palette: derivePlatformPalette(DEFAULT_APPEARANCE), updatedAt: new Date(0).toISOString() }
}

export async function readPlatformAppearance(): Promise<PlatformAppearance> {
  try {
    const response = await fetch(endpoint(), { cache: 'no-store', signal: AbortSignal.timeout(2500), headers: { Accept: 'application/json' } })
    if (!response.ok) return fallbackAppearance()
    const envelope = await response.json() as { data?: unknown }
    const parsed = platformAppearanceSchema.safeParse(envelope.data)
    return parsed.success && parsed.data.schemaVersion === PALETTE_SCHEMA_VERSION ? parsed.data : fallbackAppearance()
  } catch {
    return fallbackAppearance()
  }
}

export async function savePlatformAppearance(rawInput: unknown): Promise<PlatformAppearance> {
  const input = platformAppearanceSourceSchema.parse(rawInput) as PlatformAppearanceSource
  await requirePlatformAdmin()
  const supabase = await createUserClient(await currentTerritory())
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error || !session?.access_token) throw new Error('Sua sessÃ£o expirou. Entre novamente para continuar.')

  const response = await fetch(endpoint(), {
    method: 'PATCH',
    cache: 'no-store',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(input),
  })
  const envelope = await response.json() as { data?: unknown; error?: { message?: string } }
  if (!response.ok) throw new Error(envelope.error?.message ?? 'NÃ£o foi possÃ­vel salvar a identidade visual.')
  const parsed = platformAppearanceSchema.parse(envelope.data)
  if (parsed.schemaVersion !== PALETTE_SCHEMA_VERSION) throw new Error('Esta versÃ£o da identidade visual nÃ£o Ã© compatÃ­vel.')
  return parsed
}
