import { requirePlatformAdmin } from '@/server/auth'
import { handleRouteError, ok } from '@/server/http'
import { revokeInvitation } from '@/server/invitations'
export async function POST(request: Request, { id }: { id: string }): Promise<Response> { try { return ok(await revokeInvitation(await requirePlatformAdmin(request), id)) } catch (error) { return handleRouteError(error) } }
