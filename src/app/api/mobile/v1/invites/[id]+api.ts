import { requirePlatformAdmin } from '@/server/auth'
import { getInvitation, rotateInvitation } from '@/server/invitations'
import { handleRouteError, ok } from '@/server/http'

export async function GET(request: Request, { id }: { id: string }): Promise<Response> {
  try { return ok(await getInvitation(await requirePlatformAdmin(request), id)) } catch (error) { return handleRouteError(error) }
}

export async function POST(request: Request, { id }: { id: string }): Promise<Response> {
  try { return ok(await rotateInvitation(await requirePlatformAdmin(request), id)) } catch (error) { return handleRouteError(error) }
}
