import { createHash } from 'node:crypto'
import type { AuthError, User } from '@supabase/supabase-js'
import type { AuthSession, DeviceContractRegistered, DeviceContractStatus } from '@tavvi/api-contracts'
import { HttpError } from '../../http/errors.js'
import { enforceRateLimit } from '../../http/security.js'
import type { AdminContext } from '../../http/request-context.js'
import { createAdminSupabaseClient } from '../../integrations/supabase/admin.js'
import { createAnonymousSupabaseClient } from '../../integrations/supabase/client.js'
import type { DeviceContractLoginInput, DeviceContractRegistrationInput } from './auth.schemas.js'
import { isPlatformAdmin, revokeRemoteSession, toAuthSession } from './session-helpers.js'

const UNAVAILABLE_MESSAGE = 'O serviço de autenticação está temporariamente indisponível. Tente novamente.'

// Uma mensagem por motivo de revogação (spec, seção 5). O aparelho só chega
// aqui provando o segredo, então dizer o motivo não entrega nada a ninguém.
const revokedMessages: Record<string, string> = {
  user_disabled: 'A digital foi desativada neste aparelho. Entre com e-mail e senha para ativar de novo.',
  password_changed: 'A senha da conta mudou e a digital foi desligada. Entre com a nova senha para ativar de novo.',
  signed_out_everywhere: 'Você saiu de todos os aparelhos e a digital foi desligada. Entre com e-mail e senha para ativar de novo.',
  upgraded: 'A digital foi atualizada e precisa ser ativada de novo. Entre com e-mail e senha.',
  admin_removed: 'Esta conta não administra mais a plataforma.',
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
  try {
    await enforceRateLimit(client, bucket, `ip:${ip ?? 'local-shared'}`)
    await enforceRateLimit(client, bucket, `proof:${proofHash}`)
  } catch (error) {
    if (error instanceof HttpError && error.code === 'RATE_LIMITED') {
      throw new HttpError(429, 'RATE_LIMITED', 'Muitas tentativas com a digital. Aguarde um minuto e tente de novo.')
    }
    throw error
  }
}

function deviceNotRegistered() {
  return new HttpError(401, 'DEVICE_NOT_REGISTERED', 'Este aparelho não tem digital ativa. Entre com e-mail e senha para ativar.')
}

function deviceRevoked(reason: string | null) {
  const message = reason ? revokedMessages[reason] : undefined
  if (!message) console.error('[auth] device contract revoked with unknown reason', { reason })
  return new HttpError(401, 'DEVICE_REVOKED', message ?? 'A digital deste aparelho foi desligada. Entre com e-mail e senha para ativar de novo.')
}

function accountNotFound() {
  return new HttpError(401, 'ACCOUNT_NOT_FOUND', 'Esta conta não existe mais.')
}

function userBanned() {
  return new HttpError(403, 'USER_BANNED', 'Esta conta está bloqueada.')
}

// 429 tem mensagem própria; o resto (rede, 5xx, código desconhecido) vai para
// o log com o passo e o código, e a pessoa vê que o serviço está fora.
function authProviderFailure(step: string, error: AuthError): HttpError {
  if (error.status === 429) return new HttpError(429, 'RATE_LIMITED', 'Muitas tentativas com a digital. Aguarde um minuto e tente de novo.')
  console.error('[auth] device login failed', { step, code: error.code, status: error.status, name: error.name })
  return new HttpError(503, 'AUTH_PROVIDER_UNAVAILABLE', UNAVAILABLE_MESSAGE)
}

function isBanned(user: User): boolean {
  return Boolean(user.banned_until && Date.parse(user.banned_until) > Date.now())
}

export async function registerDeviceContract(context: AdminContext, input: DeviceContractRegistrationInput): Promise<DeviceContractRegistered> {
  const registered = await context.supabase.rpc('register_mobile_device_contract', {
    p_device_id: input.deviceId,
    p_device_secret_hash: bytea(hashHex(input.deviceSecret)),
  })
  if (registered.error) {
    console.error('[auth] device contract registration failed', { code: registered.error.code })
    throw new HttpError(500, 'DEVICE_CONTRACT_REGISTRATION_FAILED', 'Não foi possível ativar a digital neste aparelho. Tente novamente.')
  }
  return { registered: true }
}

export async function getDeviceContractStatus(context: AdminContext, deviceId: string): Promise<DeviceContractStatus> {
  const result = await context.supabase.rpc('is_my_device_contract_active', { p_device_id: deviceId })
  if (result.error) {
    console.error('[auth] device contract status failed', { code: result.error.code })
    throw new HttpError(500, 'DEVICE_STATUS_FAILED', 'Não foi possível consultar a digital deste aparelho.')
  }
  return { active: result.data === true }
}

export async function signInWithDeviceContract(input: DeviceContractLoginInput, ip: string | null): Promise<AuthSession> {
  await enforceDeviceRateLimit('auth:device', input, ip)
  const admin = createAdminSupabaseClient()
  const secretHash = bytea(hashHex(input.deviceSecret))

  const lookup = await admin.rpc('get_mobile_device_contract', { p_device_id: input.deviceId, p_device_secret_hash: secretHash })
  if (lookup.error) {
    console.error('[auth] device contract lookup failed', { code: lookup.error.code })
    throw new HttpError(500, 'DEVICE_LOGIN_FAILED', 'Não foi possível consultar a digital deste aparelho. Tente novamente.')
  }
  const contract = lookup.data[0]
  if (!contract) throw deviceNotRegistered()
  if (contract.revoked_at) throw deviceRevoked(contract.revoked_reason)

  const found = await admin.auth.admin.getUserById(contract.user_id)
  if (found.error) {
    if (found.error.status === 404 || found.error.code === 'user_not_found') throw accountNotFound()
    throw authProviderFailure('get_user', found.error)
  }
  const user = found.data.user
  if (isBanned(user)) throw userBanned()
  if (!user.email) {
    console.error('[auth] device login for user without email', { userId: user.id })
    throw new HttpError(500, 'DEVICE_LOGIN_FAILED', 'Esta conta não tem e-mail cadastrado, então a digital não consegue abrir a sessão.')
  }

  // Sessão nova a cada uso: generateLink só devolve o token (não manda e-mail)
  // e verifyOtp troca o token por uma sessão. A verificação usa outra
  // instância, com o IP do celular; esta continua service_role para as RPCs.
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email: user.email })
  if (link.error) throw authProviderFailure('generate_link', link.error)
  const { hashed_token: tokenHash, verification_type: verificationType } = link.data.properties
  if (verificationType !== 'magiclink' && verificationType !== 'signup') {
    console.error('[auth] device login got an unexpected link type', { verificationType })
    throw new HttpError(503, 'AUTH_PROVIDER_UNAVAILABLE', UNAVAILABLE_MESSAGE)
  }
  const verified = await createAdminSupabaseClient({ forwardedFor: ip }).auth.verifyOtp({ token_hash: tokenHash, type: verificationType })
  if (verified.error) {
    if (verified.error.code === 'user_banned') throw userBanned()
    throw authProviderFailure('verify_otp', verified.error)
  }
  const session = verified.data.session
  if (!session || verified.data.user?.id !== contract.user_id) {
    if (session) await revokeRemoteSession(session.access_token, 'local')
    console.error('[auth] device login returned an unexpected session', { hasSession: Boolean(session) })
    throw new HttpError(503, 'AUTH_PROVIDER_UNAVAILABLE', UNAVAILABLE_MESSAGE)
  }

  let allowed: boolean
  try {
    allowed = await isPlatformAdmin(session.access_token)
  } catch (error) {
    await revokeRemoteSession(session.access_token, 'local')
    throw error
  }
  if (!allowed) {
    await revokeRemoteSession(session.access_token, 'local')
    const revoked = await admin.rpc('revoke_mobile_device_contract', { p_device_id: input.deviceId, p_device_secret_hash: secretHash, p_reason: 'admin_removed' })
    if (revoked.error) console.error('[auth] device contract admin revocation failed', { code: revoked.error.code })
    throw new HttpError(403, 'ADMIN_ACCESS_REMOVED', 'Esta conta não administra mais a plataforma.')
  }

  return toAuthSession(session, { id: user.id, email: user.email })
}

export async function revokeDeviceContract(input: DeviceContractLoginInput, ip: string | null): Promise<{ revoked: true }> {
  await enforceDeviceRateLimit('auth:device-unlink', input, ip)
  const revoked = await createAdminSupabaseClient().rpc('revoke_mobile_device_contract', {
    p_device_id: input.deviceId,
    p_device_secret_hash: bytea(hashHex(input.deviceSecret)),
    p_reason: 'user_disabled',
  })
  if (revoked.error) {
    console.error('[auth] device contract revocation failed', { code: revoked.error.code })
    throw new HttpError(500, 'DEVICE_REVOCATION_FAILED', 'Não foi possível desativar a digital neste aparelho. Tente novamente.')
  }
  if (revoked.data !== true) throw deviceNotRegistered()
  return { revoked: true }
}
