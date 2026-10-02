import 'server-only'
import { requestServiceCallSchema, type ServiceCallRequest } from '@/domain/service-call'
import { env } from '@/server/env'
import { rateLimitIdentity } from '@/server/security/client-ip'
import { enforceRateLimit, RateLimitedError } from '@/server/security/rate-limit'
import { createUserClient } from './_client'
import { UserFacingError } from './auth'

export async function requestServiceCall(input: unknown): Promise<ServiceCallRequest> {
  const { token } = requestServiceCallSchema.parse(input)
  let allowCreate = true
  try {
    await enforceRateLimit('service-call:start', `${await rateLimitIdentity()}:${token}`)
  } catch (error) {
    if (error instanceof RateLimitedError) {
      // Still ask the RPC: it can return an existing pending call without
      // generating another notification. The flag blocks only new inserts.
      allowCreate = false
    } else {
      throw error
    }
  }

  const supabase = await createUserClient('site')
  const { data, error } = await supabase.rpc('request_service_call', {
    p_key: env.APP_SERVER_KEY,
    p_token: token,
    p_allow_create: allowCreate,
  })
  if (error) {
    if (error.message === 'service_call_unavailable') {
      throw new UserFacingError('Esta plaquinha não está disponível para chamados.')
    }
    if (error.message === 'service_call_limited') {
      throw new UserFacingError('Esta mesa já realizou vários chamados recentemente. Tente novamente mais tarde.')
    }
    if (error.message === 'service_call_ip_limited') {
      throw new UserFacingError('Muitas tentativas nesta mesa. Aguarde um minuto e tente novamente.')
    }
    console.error('[chamados] solicitação recusada', error.code, error.message)
    throw new UserFacingError('Não foi possível chamar a equipe agora. Tente novamente.')
  }
  const row = data?.[0]
  if (!row?.call_id || typeof row.table_number !== 'number' || row.status !== 'pending') {
    console.error('[chamados] RPC sem resultado válido')
    throw new UserFacingError('Não foi possível chamar a equipe agora. Tente novamente.')
  }
  return { callId: row.call_id, tableNumber: row.table_number, status: 'pending', created: row.created }
}
