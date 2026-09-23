import { requirePlatformAdmin } from '@/server/auth'
import { handleRouteError, ok } from '@/server/http'
import { createInvitation, listInvitations } from '@/server/invitations'
export async function GET(request: Request): Promise<Response> { try { return ok(await listInvitations(await requirePlatformAdmin(request))) } catch (error) { return handleRouteError(error) } }
export async function POST(request: Request): Promise<Response> { try { const context = await requirePlatformAdmin(request); return ok(await createInvitation(context, await request.json()), 201) } catch (error) { return handleRouteError(error) } }
