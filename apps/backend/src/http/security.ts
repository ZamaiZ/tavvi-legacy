import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '../integrations/supabase/database.types.js'
import type { AdminContext } from './request-context.js'
import { HttpError } from './errors.js'

// Tentativas por minuto em cada balde.
const RATE_LIMITS = {
  'auth:login': 10,
  'auth:device': 10,
  'auth:device-unlink': 10,
  mutation: 60,
  'notifications:devices': 20,
  'notifications:test': 5,
} as const

export type RateLimitBucket = keyof typeof RATE_LIMITS

export async function enforceRateLimit(
  supabase: SupabaseClient<Database>,
  bucket: RateLimitBucket,
  identifier: string,
) {
  const result = await supabase.rpc('check_rate_limit', {
    p_bucket: bucket,
    p_identifier: identifier,
    p_max: RATE_LIMITS[bucket],
    p_window_seconds: 60,
  })
  if (result.error) throw new HttpError(500, 'RATE_LIMIT_CHECK_FAILED', 'Não foi possível concluir esta operação.')
  if (result.data !== true) throw new HttpError(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde um minuto e tente novamente.')
}

export async function enforceAdminMutationRateLimit(context: AdminContext) {
  await enforceRateLimit(context.supabase, 'mutation', `${context.user.id}:${context.trustedIp ?? 'no-ip'}`)
}

export async function recordAudit(
  context: AdminContext,
  input: { action: string; subjectType: string; subjectId?: string; metadata?: Record<string, string | number | boolean | null> },
) {
  const result = await context.supabase.rpc('record_audit', {
    p_action: input.action,
    p_ip: context.trustedIp ?? undefined,
    p_metadata: input.metadata as Json | undefined,
    p_subject_id: input.subjectId,
    p_subject_type: input.subjectType,
  })
  if (result.error) throw new HttpError(500, 'AUDIT_FAILED', 'Não foi possível concluir esta operação.')
}
