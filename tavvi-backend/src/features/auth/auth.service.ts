import type { Session } from '@supabase/supabase-js'
import type { MobileSession, MobileUser, SessionInfo } from '../../contracts/mobile-api.js'
import type { ServerEnv } from '../../config/env.js'
import { getServerEnv } from '../../config/env.js'
import { HttpError } from '../../http/errors.js'
import { enforceRateLimit } from '../../http/security.js'
import type { AdminContext } from '../../http/request-context.js'
import { createAnonymousSupabaseClient, createUserSupabaseClient } from '../../integrations/supabase/client.js'
import type { RefreshInput, SignInInput } from './auth.schemas.js'

function toMobileSession(session: Session, user: MobileUser): MobileSession {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at ?? Math.floor(Date.now() / 1000) + session.expires_in,
    expiresIn: session.expires_in,
    tokenType: 'bearer',
    user,
  }
}

async function revokeRemoteSession(accessToken: string, env: ServerEnv) {
  try {
    await fetch(new URL('/auth/v1/logout?scope=local', env.supabaseUrl), {
      method: 'POST',
      headers: { apikey: env.supabaseAnonKey, Authorization: `Bearer ${accessToken}` },
    })
  } catch {
    // The caller is already rejecting or clearing the local session.
  }
}

async function requireAdminIdentity(accessToken: string) {
  const userClient = createUserSupabaseClient(accessToken)
  const admin = await userClient.rpc('is_platform_admin')
  if (admin.error) throw new HttpError(500, 'AUTHORIZATION_CHECK_FAILED', 'Não foi possível verificar sua permissão.')
  return admin.data === true
}

export async function signIn(input: SignInInput, ip: string | null): Promise<MobileSession> {
  const anonymous = createAnonymousSupabaseClient()
  await enforceRateLimit(anonymous, 'auth:login', ip ?? 'local-shared')

  const result = await anonymous.auth.signInWithPassword(input)
  if (result.error || !result.data.session || !result.data.user.email) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos.')
  }

  let allowed: boolean
  try {
    allowed = await requireAdminIdentity(result.data.session.access_token)
  } catch (error) {
    await revokeRemoteSession(result.data.session.access_token, getServerEnv())
    throw error
  }
  if (!allowed) {
    await revokeRemoteSession(result.data.session.access_token, getServerEnv())
    throw new HttpError(403, 'FORBIDDEN', 'Esta conta não administra a plataforma.')
  }

  return toMobileSession(result.data.session, { id: result.data.user.id, email: result.data.user.email })
}

export async function refreshSession(input: RefreshInput): Promise<MobileSession> {
  const anonymous = createAnonymousSupabaseClient()
  const refreshed = await anonymous.auth.refreshSession({ refresh_token: input.refreshToken })
  if (refreshed.error || !refreshed.data.session || !refreshed.data.user.email) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Sua sessão expirou. Entre novamente.')
  }

  let allowed: boolean
  try {
    allowed = await requireAdminIdentity(refreshed.data.session.access_token)
  } catch (error) {
    await revokeRemoteSession(refreshed.data.session.access_token, getServerEnv())
    throw error
  }
  if (!allowed) {
    await revokeRemoteSession(refreshed.data.session.access_token, getServerEnv())
    throw new HttpError(403, 'FORBIDDEN', 'Esta conta não administra a plataforma.')
  }

  return toMobileSession(refreshed.data.session, { id: refreshed.data.user.id, email: refreshed.data.user.email })
}

export function getSession(context: AdminContext): SessionInfo {
  return { user: context.user }
}

export async function signOut(context: AdminContext) {
  await revokeRemoteSession(context.accessToken, getServerEnv())
  return { signedOut: true as const }
}
