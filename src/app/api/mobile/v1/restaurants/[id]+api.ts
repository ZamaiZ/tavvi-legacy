import { requirePlatformAdmin } from '@/server/auth'
import { handleRouteError, ok } from '@/server/http'
import { getRestaurant } from '@/server/restaurants'

export async function GET(request: Request, { id }: { id: string }): Promise<Response> {
  try { return ok(await getRestaurant(await requirePlatformAdmin(request), id)) } catch (error) { return handleRouteError(error) }
}
