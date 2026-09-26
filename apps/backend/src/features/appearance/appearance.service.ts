import { DEFAULT_APPEARANCE, PALETTE_SCHEMA_VERSION, derivePlatformPalette } from '@tavvi/theme-core'
import type { PlatformAppearance } from '@tavvi/api-contracts'
import { HttpError } from '../../http/errors.js'
import { enforceAdminMutationRateLimit } from '../../http/security.js'
import type { AdminContext } from '../../http/request-context.js'
import { createAnonymousSupabaseClient } from '../../integrations/supabase/client.js'
import { appearanceInputSchema, type AppearanceInput } from './appearance.schemas.js'

type AppearanceRow = { brand_accent: string; on_accent_override: string | null; schema_version: number; updated_at: string }

function toAppearance(row: AppearanceRow): PlatformAppearance {
  const source = { brandAccent: row.brand_accent.toUpperCase(), onAccentOverride: row.on_accent_override?.toUpperCase() ?? null }
  return { source, schemaVersion: row.schema_version, palette: derivePlatformPalette(source), updatedAt: row.updated_at }
}

export async function getPlatformAppearance(): Promise<PlatformAppearance> {
  const result = await createAnonymousSupabaseClient()
    .from('platform_appearance')
    .select('brand_accent,on_accent_override,schema_version,updated_at')
    .maybeSingle()
  if (result.error) throw new HttpError(503, 'APPEARANCE_UNAVAILABLE', 'NÃ£o foi possÃ­vel carregar a identidade visual.')
  if (!result.data) {
    return { source: DEFAULT_APPEARANCE, schemaVersion: PALETTE_SCHEMA_VERSION, palette: derivePlatformPalette(DEFAULT_APPEARANCE), updatedAt: new Date(0).toISOString() }
  }
  return toAppearance(result.data)
}

export async function updatePlatformAppearance(context: AdminContext, rawInput: unknown): Promise<PlatformAppearance> {
  const input: AppearanceInput = appearanceInputSchema.parse(rawInput)
  await enforceAdminMutationRateLimit(context)
  const result = await context.supabase.rpc('update_platform_appearance', {
    p_brand_accent: input.brandAccent,
    p_on_accent_override: input.onAccentOverride,
    p_trusted_ip: context.trustedIp,
  })
  if (result.error) {
    if (result.error.code === '42501') throw new HttpError(403, 'FORBIDDEN', 'Esta conta nÃ£o administra a plataforma.')
    if (result.error.code === '22023') throw new HttpError(422, 'VALIDATION_ERROR', 'Revise a cor informada.')
    throw new HttpError(500, 'APPEARANCE_UPDATE_FAILED', 'NÃ£o foi possÃ­vel salvar a identidade visual.')
  }
  const row = result.data[0]
  if (!row) throw new HttpError(500, 'APPEARANCE_UPDATE_FAILED', 'NÃ£o foi possÃ­vel salvar a identidade visual.')
  return toAppearance(row)
}
