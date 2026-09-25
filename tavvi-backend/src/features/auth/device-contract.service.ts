import { createHash } from 'node:crypto'
import type { Session } from '@supabase/supabase-js'
import type { MobileSession, MobileUser } from '../../contracts/mobile-api.js'
import { getServerEnv } from '../../config/env.js'
import { HttpError } from '../../http/errors.js'
import { enforceRateLimit } from '../../http/security.js'
import type { AdminContext } from '../../http/request-context.js'
import { createAnonymousSupabaseClient, createUserSupabaseClient } from '../../integrations/supabase/client.js'
import { decryptDeviceRefreshToken, encryptDeviceRefreshToken } from './device-contract-crypto.js'
import type { DeviceContractLoginInput, DeviceContractRegistrationInput } from './auth.schemas.js'

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

function hashHex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function bytea(value: string): string {
  return `\\x${value}`
}

async function enforceDeviceRateLimit(bucket: 'auth:device' | 'auth:device-unlink', input: DeviceContractLoginInput, ip: string | null) {
  const client = createAnonymousSupabaseClient()
  const proofHash = hashHex(`${input.deviceId}:${input.deviceSecret}`)
  await enforceRateLimit(client, bucket, `ip:${ip ?? 'local-shared'}`)
  await enforceRateLimit(client, bucket, `proof:${proofHash}`)
}

async function requireAdmin(accessToken: string) {
  const result = await createUserSupabaseClient(accessToken).rpc('is_platform_admin')
  if (result.error) throw new HttpError(500, 'AUTHORIZATION_CHECK_FAILED', 'Não foi possível verificar sua permissão.')
  return result.data === true
}

function throwForAuthRefreshFailure(error: { name?: string; status?: number } | null, fallbackMessage: string): never {
  if (error?.name === 'AuthRetryableFetchError' || error?.status === 429 || (error?.status ?? 0) >= 500) {
    throw new HttpError(503, 'AUTH_PROVIDER_UNAVAILABLE', 'O serviço de autenticação está temporariamente indisponível. Tente novamente.')
  }
  throw new HttpError(401, 'INVALID_DEVICE_CONTRACT', fallbackMessage)
}

async function revokeRemoteSession(accessToken: string) {
  const env = getServerEnv()
  try {
    await fetch(new URL('/auth/v1/logout?scope=local', env.supabaseUrl), {
      method: 'POST',
      headers: { apikey: env.supabaseAnonKey, Authorization: `Bearer ${accessToken}` },
    })
  } catch {
    // Preserve the original authorization or persistence error.
  }
}

export async function replaceDeviceRefreshToken(oldRefreshToken: string, newSession: MobileSession): Promise<void> {
  const encrypted = encryptDeviceRefreshToken(newSession.refreshToken)
  const client = createAnonymousSupabaseClient()
  const replaced = await client.rpc('replace_mobile_device_refresh', {
    p_old_refresh_token_hash: bytea(hashHex(oldRefreshToken)),
    p_new_refresh_token_hash: bytea(hashHex(newSession.refreshToken)),
    p_refresh_token_ciphertext: encrypted.ciphertext,
    p_refresh_token_nonce: encrypted.nonce,
    p_refresh_token_tag: encrypted.tag,
  })
  if (replaced.error) throw new HttpError(500, 'DEVICE_CONTRACT_SYNC_FAILED', 'Não foi possível atualizar o acesso biométrico deste aparelho.')
}

export async function registerDeviceContract(context: AdminContext, input: DeviceContractRegistrationInput): Promise<MobileSession> {
  const anonymous = createAnonymousSupabaseClient()
  const refreshed = await anonymous.auth.refreshSession({ refresh_token: input.refreshToken })
  if (refreshed.error) throwForAuthRefreshFailure(refreshed.error, 'Sua sessão expirou. Entre novamente.')
  if (!refreshed.data.session || !refreshed.data.user.email) {
    if (refreshed.data.session) await revokeRemoteSession(refreshed.data.session.access_token)
    throw new HttpError(401, 'UNAUTHORIZED', 'Sua sessão expirou. Entre novamente.')
  }

  const session = refreshed.data.session
  if (refreshed.data.user.id !== context.user.id) {
    await revokeRemoteSession(session.access_token)
    throw new HttpError(401, 'UNAUTHORIZED', 'Não foi possível ativar a biometria nesta sessão.')
  }
  let allowed: boolean
  try {
    allowed = await requireAdmin(session.access_token)
  } catch (error) {
    await revokeRemoteSession(session.access_token)
    throw error
  }
  if (!allowed) {
    await revokeRemoteSession(session.access_token)
    throw new HttpError(403, 'FORBIDDEN', 'Esta conta não administra a plataforma.')
  }

  const mobileSession = toMobileSession(session, { id: refreshed.data.user.id, email: refreshed.data.user.email })
  const encrypted = encryptDeviceRefreshToken(mobileSession.refreshToken)
  const registered = await createUserSupabaseClient(mobileSession.accessToken).rpc('register_mobile_device_contract', {
    p_device_id: input.deviceId,
    p_device_secret_hash: bytea(hashHex(input.deviceSecret)),
    p_refresh_token_hash: bytea(hashHex(mobileSession.refreshToken)),
    p_refresh_token_ciphertext: encrypted.ciphertext,
    p_refresh_token_nonce: encrypted.nonce,
    p_refresh_token_tag: encrypted.tag,
  })
  if (registered.error) {
    await revokeRemoteSession(mobileSession.accessToken)
    throw new HttpError(500, 'DEVICE_CONTRACT_REGISTRATION_FAILED', 'Não foi possível ativar a biometria neste aparelho.')
  }
  return mobileSession
}

export async function signInWithDeviceContract(input: DeviceContractLoginInput, ip: string | null): Promise<MobileSession> {
  await enforceDeviceRateLimit('auth:device', input, ip)
  const secretHash = hashHex(input.deviceSecret)
  const lookup = await createAnonymousSupabaseClient().rpc('get_mobile_device_contract', {
    p_device_id: input.deviceId,
    p_device_secret_hash: bytea(secretHash),
  })
  if (lookup.error) throw new HttpError(500, 'DEVICE_LOGIN_FAILED', 'Não foi possível concluir esta operação.')
  const contract = lookup.data[0]
  if (!contract) throw new HttpError(401, 'INVALID_DEVICE_CONTRACT', 'Não foi possível entrar com a biometria. Entre com e-mail e senha.')

  let refreshToken: string
  try {
    refreshToken = decryptDeviceRefreshToken({
      version: 1,
      ciphertext: contract.refresh_token_ciphertext,
      nonce: contract.refresh_token_nonce,
      tag: contract.refresh_token_tag,
    })
  } catch {
    throw new HttpError(401, 'INVALID_DEVICE_CONTRACT', 'Não foi possível entrar com a biometria. Entre com e-mail e senha.')
  }

  const refreshed = await createAnonymousSupabaseClient().auth.refreshSession({ refresh_token: refreshToken })
  if (refreshed.error) throwForAuthRefreshFailure(refreshed.error, 'Não foi possível entrar com a biometria. Entre com e-mail e senha.')
  if (!refreshed.data.session || !refreshed.data.user.email || refreshed.data.user.id !== contract.user_id) {
    if (refreshed.data.session) await revokeRemoteSession(refreshed.data.session.access_token)
    throw new HttpError(401, 'INVALID_DEVICE_CONTRACT', 'Não foi possível entrar com a biometria. Entre com e-mail e senha.')
  }
  let allowed: boolean
  try {
    allowed = await requireAdmin(refreshed.data.session.access_token)
  } catch (error) {
    await revokeRemoteSession(refreshed.data.session.access_token)
    throw error
  }
  if (!allowed) {
    await revokeRemoteSession(refreshed.data.session.access_token)
    throw new HttpError(403, 'FORBIDDEN', 'Esta conta não administra mais a plataforma.')
  }

  const mobileSession = toMobileSession(refreshed.data.session, { id: refreshed.data.user.id, email: refreshed.data.user.email })
  const encrypted = encryptDeviceRefreshToken(mobileSession.refreshToken)
  const replaced = await createAnonymousSupabaseClient().rpc('replace_mobile_device_refresh', {
    p_old_refresh_token_hash: bytea(contract.refresh_token_hash),
    p_new_refresh_token_hash: bytea(hashHex(mobileSession.refreshToken)),
    p_refresh_token_ciphertext: encrypted.ciphertext,
    p_refresh_token_nonce: encrypted.nonce,
    p_refresh_token_tag: encrypted.tag,
  })
  if (replaced.error) {
    await revokeRemoteSession(mobileSession.accessToken)
    throw new HttpError(503, 'DEVICE_CONTRACT_SYNC_FAILED', 'Não foi possível concluir esta operação. Tente novamente ou entre com e-mail e senha.')
  }
  if (replaced.data !== true) {
    await revokeRemoteSession(mobileSession.accessToken)
    throw new HttpError(401, 'INVALID_DEVICE_CONTRACT', 'Não foi possível entrar com a biometria. Entre com e-mail e senha.')
  }
  return mobileSession
}

export async function revokeDeviceContract(input: DeviceContractLoginInput, ip: string | null): Promise<{ revoked: true }> {
  await enforceDeviceRateLimit('auth:device-unlink', input, ip)
  const revoked = await createAnonymousSupabaseClient().rpc('revoke_mobile_device_contract', {
    p_device_id: input.deviceId,
    p_device_secret_hash: bytea(hashHex(input.deviceSecret)),
  })
  if (revoked.error) throw new HttpError(500, 'DEVICE_REVOCATION_FAILED', 'Não foi possível desativar a biometria neste aparelho.')
  if (revoked.data !== true) throw new HttpError(401, 'INVALID_DEVICE_CONTRACT', 'Não foi possível confirmar este aparelho.')
  return { revoked: true }
}
