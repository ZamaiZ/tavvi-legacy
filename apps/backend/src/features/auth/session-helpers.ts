import type { Session } from '@supabase/supabase-js'
import type { AuthSession, UserSummary } from '@tavvi/api-contracts'
import { getServerEnv } from '../../config/env.js'
import { HttpError } from '../../http/errors.js'
import { createUserSupabaseClient } from '../../integrations/supabase/client.js'

export function toAuthSession(session: Session, user: UserSummary): AuthSession {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at ?? Math.floor(Date.now() / 1000) + session.expires_in,
    expiresIn: session.expires_in,
    tokenType: 'bearer',
    user,
  }
}

// Encerra sessões no Supabase Auth com o token do próprio usuário: 'local' só
// esta sessão, 'global' todas as da conta. Devolve se o Supabase confirmou.
export async function revokeRemoteSession(accessToken: string, scope: 'local' | 'global'): Promise<boolean> {
  const env = getServerEnv()
  try {
    const response = await fetch(new URL(`/auth/v1/logout?scope=${scope}`, env.supabaseUrl), {
      method: 'POST',
      headers: { apikey: env.supabaseAnonKey, Authorization: `Bearer ${accessToken}` },
    })
    return response.ok
  } catch {
    return false
  }
}

export async function isPlatformAdmin(accessToken: string): Promise<boolean> {
  const result = await createUserSupabaseClient(accessToken).rpc('is_platform_admin')
  if (result.error) throw new HttpError(500, 'AUTHORIZATION_CHECK_FAILED', 'Não foi possível verificar sua permissão.')
  return result.data === true
}
