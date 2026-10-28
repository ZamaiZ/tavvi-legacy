import 'server-only'
import {
  publicServiceCallStatusInputSchema,
  publicServiceCallStatusSchema,
  requestServiceCallSchema,
  type PublicServiceCallStatusDTO,
  type ServiceCallRequest,
} from '@/domain/service-call'
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
      // Still ask the RPC: it can return an existing active call without
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
      throw new UserFacingError('Este identificador não está disponível para chamados.')
    }
    if (error.message === 'service_call_limited') {
      throw new UserFacingError('Esta mesa já realizou vários chamados recentemente. Tente novamente mais tarde.')
    }
    if (error.message === 'service_call_ip_limited') {
      throw new UserFacingError('Muitas tentativas nesta mesa. Aguarde um minuto e tente novamente.')
    }
    console.error('[service-calls] public request rejected', error.code, error.message)
    throw new UserFacingError('Não foi possível chamar a equipe agora. Tente novamente.')
  }
  const row = data?.[0]
  if (!row?.call_id || typeof row.table_number !== 'number' || (row.status !== 'pending' && row.status !== 'in_progress')) {
    console.error('[service-calls] public RPC returned an invalid result')
    throw new UserFacingError('Não foi possível chamar a equipe agora. Tente novamente.')
  }
  return { callId: row.call_id, tableNumber: row.table_number, status: row.status, created: row.created }
}

export async function getPublicServiceCallStatus(input: unknown): Promise<PublicServiceCallStatusDTO> {
  const { token } = publicServiceCallStatusInputSchema.parse(input)
  const supabase = await createUserClient('site')
  const { data, error } = await supabase.rpc('get_public_service_call_status', {
    p_key: env.APP_SERVER_KEY,
    p_token: token,
  })
  if (error) {
    if (error.message === 'service_call_unavailable') {
      throw new UserFacingError('Este identificador não está mais disponível para chamados.')
    }
    console.error('[service-calls] public status lookup failed', error.code, error.message)
    throw new UserFacingError('Não foi possível atualizar o estado do chamado agora.')
  }
  const row = data?.[0]
  if (!row) return null
  const parsed = publicServiceCallStatusSchema.safeParse({ callId: row.call_id, status: row.status })
  if (!parsed.success) {
    console.error('[service-calls] public status RPC returned an invalid result')
    throw new UserFacingError('Não foi possível atualizar o estado do chamado agora.')
  }
  return parsed.data
}
