import type { ApiFailure, ApiSuccess } from '@/contracts/mobile-api'
import { publicEnv, supabase } from './supabase'

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) { super(message); this.name = 'ApiError' }
}
export type SessionInvalidationReason = 'expired' | 'forbidden'
let invalidator: ((reason: SessionInvalidationReason) => Promise<void>) | null = null
let refreshPromise: ReturnType<typeof supabase.auth.refreshSession> | null = null

export function registerSessionInvalidator(handler: (reason: SessionInvalidationReason) => Promise<void>) {
  invalidator = handler
  return () => { if (invalidator === handler) invalidator = null }
}

async function parse<T>(response: Response): Promise<T> {
  let envelope: ApiSuccess<T> | ApiFailure
  try { envelope = await response.json() as ApiSuccess<T> | ApiFailure } catch { throw new ApiError('Resposta inválida do servidor.', response.status, 'INVALID_RESPONSE') }
  if (!response.ok || 'error' in envelope) {
    const error = 'error' in envelope ? envelope.error : { code: 'REQUEST_FAILED', message: 'Não foi possível concluir esta operação.' }
    throw new ApiError(error.message, response.status, error.code)
  }
  return envelope.data
}

async function request<T>(path: string, init: RequestInit = {}, token?: string) {
  if (!publicEnv.apiUrl) throw new ApiError('Configure EXPO_PUBLIC_API_URL para conectar o aplicativo.', 0, 'CONFIGURATION_ERROR')
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  try { return await parse<T>(await fetch(`${publicEnv.apiUrl}${path}`, { ...init, headers })) }
  catch (error) { if (error instanceof ApiError) throw error; throw new ApiError('Sem conexão com o servidor.', 0, 'NETWORK_ERROR') }
}

export function publicApiRequest<T>(path: string, init?: RequestInit) { return request<T>(path, init) }

export async function apiRequest<T>(path: string, init?: RequestInit) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) { await invalidator?.('expired'); throw new ApiError('Sua sessão expirou.', 401, 'UNAUTHORIZED') }
  try { return await request<T>(path, init, token) }
  catch (error) {
    if (!(error instanceof ApiError)) throw error
    if (error.status === 403) { await invalidator?.('forbidden'); throw error }
    if (error.status !== 401) throw error
    refreshPromise ??= supabase.auth.refreshSession().finally(() => { refreshPromise = null })
    const refreshed = await refreshPromise
    if (refreshed.error || !refreshed.data.session) { await invalidator?.('expired'); throw error }
    try { return await request<T>(path, init, refreshed.data.session.access_token) }
    catch (retryError) { if (retryError instanceof ApiError && retryError.status === 401) await invalidator?.('expired'); throw retryError }
  }
}
