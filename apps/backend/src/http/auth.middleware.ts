import type { Request, RequestHandler } from 'express'
import { HttpError } from './errors.js'
import type { AdminContext } from './request-context.js'
import { createAnonymousSupabaseClient, createUserSupabaseClient } from '../integrations/supabase/client.js'

async function resolveUserContext(request: Request): Promise<AdminContext> {
  const match = request.header('authorization')?.match(/^Bearer\s+(\S+)$/i)
  if (!match) throw new HttpError(401, 'UNAUTHORIZED', 'Entre novamente para continuar.')

  const accessToken = match[1]
  const anonymous = createAnonymousSupabaseClient()
  const { data, error } = await anonymous.auth.getUser(accessToken)
  if (error || !data.user?.email) throw new HttpError(401, 'UNAUTHORIZED', 'Entre novamente para continuar.')

  return {
    accessToken,
    user: { id: data.user.id, email: data.user.email },
    supabase: createUserSupabaseClient(accessToken),
    trustedIp: request.ip || null,
  }
}

export const requireAuthenticatedUser: RequestHandler = async (request, _response, next) => {
  try {
    request.adminContext = await resolveUserContext(request)
    next()
  } catch (error) {
    next(error)
  }
}

export const requirePlatformAdmin: RequestHandler = async (request, _response, next) => {
  try {
    const context = await resolveUserContext(request)
    const admin = await context.supabase.rpc('is_platform_admin')
    if (admin.error) throw new HttpError(500, 'AUTHORIZATION_CHECK_FAILED', 'Não foi possível verificar sua permissão.')
    if (admin.data !== true) throw new HttpError(403, 'FORBIDDEN', 'Esta conta não administra a plataforma.')
    request.adminContext = context
    next()
  } catch (error) {
    next(error)
  }
}
