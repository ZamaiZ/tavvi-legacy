import { requirePlatformAdmin } from '@/server/auth'
import { handleRouteError, ok } from '@/server/http'
import { listRestaurants } from '@/server/restaurants'
export async function GET(request: Request): Promise<Response> { try { return ok(await listRestaurants(await requirePlatformAdmin(request))) } catch (error) { return handleRouteError(error) } }
