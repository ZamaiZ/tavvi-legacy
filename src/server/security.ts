import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from './database.types'
import type { AdminContext } from './auth'
import { HttpError } from './http'

export function trustedClientIp(request: Request) { return request.headers.get('cf-connecting-ip')?.trim() || null }
export async function enforceRateLimit(supabase: SupabaseClient<Database>, bucket: 'auth:login' | 'mutation', identifier: string) {
  const limit = bucket === 'auth:login' ? 10 : 60
  const result = await supabase.rpc('check_rate_limit', { p_bucket: bucket, p_identifier: identifier, p_max: limit, p_window_seconds: 60 })
  if (result.error) throw new HttpError(500, 'RATE_LIMIT_CHECK_FAILED', 'Não foi possível concluir esta operação.')
  if (result.data !== true) throw new HttpError(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde um minuto e tente novamente.')
}
export async function recordAudit(context: AdminContext, input: { action: string; subjectType: string; subjectId?: string; metadata?: Record<string, string | number | boolean | null> }) {
  const result = await context.supabase.rpc('record_audit', { p_action: input.action, p_ip: context.trustedIp ?? undefined, p_metadata: input.metadata as Json | undefined, p_subject_id: input.subjectId, p_subject_type: input.subjectType })
  if (result.error) throw new HttpError(500, 'AUDIT_FAILED', 'Não foi possível concluir esta operação.')
}
