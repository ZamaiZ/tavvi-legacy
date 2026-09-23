import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { HttpError } from './http'
import { trustedClientIp } from './security'
import { createAnonymousServerClient, createUserServerClient } from './supabase'

export type AdminContext = { accessToken: string; user: { id: string; email: string }; supabase: SupabaseClient<Database>; trustedIp: string | null }
export async function requirePlatformAdmin(request: Request): Promise<AdminContext> {
  const match = request.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)
  if (!match) throw new HttpError(401, 'UNAUTHORIZED', 'Entre novamente para continuar.')
  const accessToken = match[1]
  const anonymous = createAnonymousServerClient()
  const { data, error } = await anonymous.auth.getUser(accessToken)
  if (error || !data.user?.email) throw new HttpError(401, 'UNAUTHORIZED', 'Entre novamente para continuar.')
  const supabase = createUserServerClient(accessToken)
  const admin = await supabase.rpc('is_platform_admin')
  if (admin.error) throw new HttpError(500, 'AUTHORIZATION_CHECK_FAILED', 'Não foi possível verificar sua permissão.')
  if (admin.data !== true) throw new HttpError(403, 'FORBIDDEN', 'Esta conta não administra a plataforma.')
  return { accessToken, user: { id: data.user.id, email: data.user.email }, supabase, trustedIp: trustedClientIp(request) }
}
