import type { AuthError } from '@supabase/supabase-js'
import type { AuthSession, SessionSnapshot, SignedOut } from '@tavvi/api-contracts'
import { HttpError } from '../../http/errors.js'
import { enforceRateLimit } from '../../http/security.js'
import type { AdminContext } from '../../http/request-context.js'
import { createAnonymousSupabaseClient } from '../../integrations/supabase/client.js'
import type { RefreshInput, SignInInput } from './auth.schemas.js'
import { isPlatformAdmin, revokeRemoteSession, toAuthSession } from './session-helpers.js'

// Uma mensagem por código do Supabase Auth. "E-mail ou senha inválidos"
// continua uma só: o Supabase responde `invalid_credentials` tanto para
// e-mail inexistente quanto para senha errada. O resto vai para o log com
// código e status, nunca com e-mail ou senha.
function signInFailure(error: AuthError): HttpError {
  switch (error.code) {
    case 'invalid_credentials':
      return new HttpError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos.')
    case 'email_not_confirmed':
      return new HttpError(403, 'EMAIL_NOT_CONFIRMED', 'Confirme seu e-mail antes de entrar.')
    case 'user_banned':
      return new HttpError(403, 'USER_BANNED', 'Esta conta está bloqueada.')
    case 'over_request_rate_limit':
      return new HttpError(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde um minuto e tente novamente.')
  }
  console.error('[auth] signIn failed', { code: error.code, status: error.status })
  return new HttpError(503, 'AUTH_UNAVAILABLE', 'Não foi possível entrar agora. Tente novamente em instantes.')
}

// Falha passageira do Supabase não é sessão expirada: 503 deixa o app manter
// a sessão e tentar de novo. 401 só quando o Supabase recusa o token.
function refreshFailure(error: AuthError): HttpError {
  if (error.name === 'AuthRetryableFetchError' || error.status === 429 || (error.status ?? 0) >= 500) {
    console.error('[auth] refresh unavailable', { code: error.code, status: error.status, name: error.name })
    return new HttpError(503, 'AUTH_PROVIDER_UNAVAILABLE', 'O serviço de autenticação está temporariamente indisponível. Tente novamente.')
  }
  console.warn('[auth] refresh rejected', { code: error.code, status: error.status })
  return new HttpError(401, 'UNAUTHORIZED', 'Sua sessão expirou. Entre novamente.')
}

export async function signIn(input: SignInInput, ip: string | null): Promise<AuthSession> {
  const anonymous = createAnonymousSupabaseClient()
  await enforceRateLimit(anonymous, 'auth:login', ip ?? 'local-shared')

  const result = await anonymous.auth.signInWithPassword(input)
  if (result.error) throw signInFailure(result.error)
  if (!result.data.session || !result.data.user.email) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos.')
  }

  let allowed: boolean
  try {
    allowed = await isPlatformAdmin(result.data.session.access_token)
  } catch (error) {
    await revokeRemoteSession(result.data.session.access_token, 'local')
    throw error
  }
  if (!allowed) {
    await revokeRemoteSession(result.data.session.access_token, 'local')
    throw new HttpError(403, 'FORBIDDEN', 'Esta conta não administra a plataforma.')
  }

  return toAuthSession(result.data.session, { id: result.data.user.id, email: result.data.user.email })
}

// Não mexe mais na digital: ela não guarda token (spec 2026-10-01).
export async function refreshSession(input: RefreshInput): Promise<AuthSession> {
  const anonymous = createAnonymousSupabaseClient()
  const refreshed = await anonymous.auth.refreshSession({ refresh_token: input.refreshToken })
  if (refreshed.error) throw refreshFailure(refreshed.error)
  if (!refreshed.data.session || !refreshed.data.user?.email) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Sua sessão expirou. Entre novamente.')
  }

  let allowed: boolean
  try {
    allowed = await isPlatformAdmin(refreshed.data.session.access_token)
  } catch (error) {
    await revokeRemoteSession(refreshed.data.session.access_token, 'local')
    throw error
  }
  if (!allowed) {
    await revokeRemoteSession(refreshed.data.session.access_token, 'local')
    throw new HttpError(403, 'FORBIDDEN', 'Esta conta não administra a plataforma.')
  }

  return toAuthSession(refreshed.data.session, { id: refreshed.data.user.id, email: refreshed.data.user.email })
}

export function getSession(context: AdminContext): SessionSnapshot {
  return { user: context.user }
}

// "Sair" do app: encerra só a sessão deste aparelho. A digital continua.
export async function signOut(context: AdminContext): Promise<SignedOut> {
  await revokeRemoteSession(context.accessToken, 'local')
  return { signedOut: true }
}

// "Sair de todos os aparelhos": primeiro desliga as digitais e as inscrições
// de push (precisa da sessão), depois encerra todas as sessões da conta.
export async function signOutEverywhere(context: AdminContext): Promise<SignedOut> {
  const revoked = await context.supabase.rpc('revoke_all_my_devices')
  if (revoked.error) {
    console.error('[auth] revoke_all_my_devices failed', { code: revoked.error.code })
    throw new HttpError(500, 'SIGN_OUT_EVERYWHERE_FAILED', 'Não foi possível desligar a digital dos aparelhos. Nada foi encerrado; tente novamente.')
  }
  if (!await revokeRemoteSession(context.accessToken, 'global')) {
    throw new HttpError(503, 'SIGN_OUT_EVERYWHERE_INCOMPLETE', 'A digital foi desligada em todos os aparelhos, mas não foi possível encerrar as sessões abertas. Tente novamente.')
  }
  return { signedOut: true }
}
