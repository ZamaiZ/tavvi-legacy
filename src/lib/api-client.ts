import type { ApiFailure, ApiSuccess, MobileSession } from '@/contracts/mobile-api'
import { sessionStore } from './session-store'

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export type SessionInvalidationReason = 'expired' | 'forbidden'
let invalidator: ((reason: SessionInvalidationReason) => Promise<void>) | null = null
let refreshPromise: { refreshToken: string; promise: Promise<MobileSession> } | null = null

const apiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '')
export const publicEnvReady = Boolean(apiUrl)

export function registerSessionInvalidator(handler: (reason: SessionInvalidationReason) => Promise<void>) {
  invalidator = handler
  return () => { if (invalidator === handler) invalidator = null }
}

async function invalidateSession(reason: SessionInvalidationReason, expectedRefreshToken?: string) {
  if (expectedRefreshToken) {
    if (!await sessionStore.clearIfRefreshToken(expectedRefreshToken)) return
  } else await sessionStore.clear()
  await invalidator?.(reason)
}

async function parse<T>(response: Response): Promise<T> {
  let envelope: ApiSuccess<T> | ApiFailure
  try {
    envelope = await response.json() as ApiSuccess<T> | ApiFailure
  } catch {
    throw new ApiError('Resposta inválida do servidor.', response.status, 'INVALID_RESPONSE')
  }
  if (!response.ok || 'error' in envelope) {
    const error = 'error' in envelope
      ? envelope.error
      : { code: 'REQUEST_FAILED', message: 'Não foi possível concluir esta operação.' }
    throw new ApiError(error.message, response.status, error.code)
  }
  return envelope.data
}

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  if (!apiUrl) throw new ApiError('Configure EXPO_PUBLIC_API_URL para conectar o aplicativo.', 0, 'CONFIGURATION_ERROR')
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  try {
    return await parse<T>(await fetch(`${apiUrl}${path}`, { ...init, headers }))
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError('Sem conexão com o servidor.', 0, 'NETWORK_ERROR')
  }
}

export function publicApiRequest<T>(path: string, init?: RequestInit) {
  return request<T>(path, init)
}

async function refreshSession(refreshToken: string) {
  const before = await sessionStore.get()
  if (before?.refreshToken !== refreshToken) {
    throw new ApiError('A sessão foi substituída.', 0, 'SESSION_SUPERSEDED')
  }
  const session = await publicApiRequest<MobileSession>('/api/mobile/v1/session/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  })
  const stored = await sessionStore.replaceIfRefreshToken(refreshToken, session)
  if (!stored) {
    throw new ApiError('A sessão foi substituída.', 0, 'SESSION_SUPERSEDED')
  }
  return session
}

function sharedRefresh(refreshToken: string) {
  if (refreshPromise?.refreshToken === refreshToken) return refreshPromise.promise
  const promise = refreshSession(refreshToken)
  const entry = { refreshToken, promise }
  refreshPromise = entry
  void promise.then(
    () => { if (refreshPromise === entry) refreshPromise = null },
    () => { if (refreshPromise === entry) refreshPromise = null },
  )
  return promise
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const session = await sessionStore.get()
  if (!session) {
    await invalidateSession('expired')
    throw new ApiError('Sua sessão expirou. Entre novamente.', 401, 'UNAUTHORIZED')
  }

  try {
    return await request<T>(path, init, session.accessToken)
  } catch (error) {
    if (!(error instanceof ApiError)) throw error
    if (error.status === 403) {
      await invalidateSession('forbidden', session.refreshToken)
      throw error
    }
    if (error.status !== 401) throw error

    let refreshed: MobileSession
    try {
      const current = await sessionStore.get()
      refreshed = current && (current.refreshToken !== session.refreshToken || current.accessToken !== session.accessToken)
        ? current
        : await sharedRefresh(session.refreshToken)
    } catch (refreshError) {
      if (refreshError instanceof ApiError && refreshError.status === 403) {
        await invalidateSession('forbidden', session.refreshToken)
      } else if (refreshError instanceof ApiError && refreshError.status === 401) {
        await invalidateSession('expired', session.refreshToken)
      }
      throw refreshError
    }

    try {
      return await request<T>(path, init, refreshed.accessToken)
    } catch (retryError) {
      if (retryError instanceof ApiError && retryError.status === 403) await invalidateSession('forbidden', refreshed.refreshToken)
      else if (retryError instanceof ApiError && retryError.status === 401) await invalidateSession('expired', refreshed.refreshToken)
      throw retryError
    }
  }
}
