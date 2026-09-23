import { z } from 'zod'
import type { MobileSession, SessionInfo } from '@/contracts/mobile-api'
import { requirePlatformAdmin } from '@/server/auth'
import { handleRouteError, HttpError, ok } from '@/server/http'
import { enforceRateLimit, trustedClientIp } from '@/server/security'
import { createAnonymousServerClient, createUserServerClient } from '@/server/supabase'

const loginSchema = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(1024) })
export async function POST(request: Request): Promise<Response> {
  try {
    const input = loginSchema.parse(await request.json())
    const anonymous = createAnonymousServerClient()
    await enforceRateLimit(anonymous, 'auth:login', trustedClientIp(request) ?? 'local-shared')
    const result = await anonymous.auth.signInWithPassword(input)
    if (result.error || !result.data.session || !result.data.user.email) throw new HttpError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos.')
    const userClient = createUserServerClient(result.data.session.access_token)
    const admin = await userClient.rpc('is_platform_admin')
    if (admin.error) throw new HttpError(500, 'AUTHORIZATION_CHECK_FAILED', 'Não foi possível verificar sua permissão.')
    if (admin.data !== true) throw new HttpError(403, 'FORBIDDEN', 'Esta conta não administra a plataforma.')
    const session: MobileSession = { accessToken: result.data.session.access_token, refreshToken: result.data.session.refresh_token, expiresAt: result.data.session.expires_at ?? Math.floor(Date.now() / 1000) + result.data.session.expires_in, expiresIn: result.data.session.expires_in, tokenType: 'bearer', user: { id: result.data.user.id, email: result.data.user.email } }
    return ok(session)
  } catch (error) { return handleRouteError(error) }
}
export async function GET(request: Request): Promise<Response> {
  try { const context = await requirePlatformAdmin(request); const data: SessionInfo = { user: context.user }; return ok(data) }
  catch (error) { return handleRouteError(error) }
}
