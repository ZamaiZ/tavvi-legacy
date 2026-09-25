import { z } from 'zod'
import type { MobileRestaurant, MobileRestaurantDetail } from '../../contracts/mobile-api.js'
import type { AdminContext } from '../../http/request-context.js'
import { HttpError } from '../../http/errors.js'

const restaurantIdSchema = z.string().uuid()

export async function listRestaurants(context: AdminContext): Promise<MobileRestaurant[]> {
  const result = await context.supabase
    .from('restaurants')
    .select('id,name,slug,segment,status,deleted_at')
    .order('created_at', { ascending: false })
  if (result.error) throw new HttpError(500, 'RESTAURANTS_READ_FAILED', 'Não foi possível carregar os restaurantes.')
  return result.data.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    segment: row.segment,
    status: row.status,
    deletedAt: row.deleted_at,
  }))
}

export async function getRestaurant(context: AdminContext, rawId: string): Promise<MobileRestaurantDetail> {
  const id = restaurantIdSchema.parse(rawId)
  const result = await context.supabase
    .from('restaurants')
    .select('id,name,slug,segment,status,deleted_at,created_at,updated_at')
    .eq('id', id)
    .maybeSingle()
  if (result.error) throw new HttpError(500, 'RESTAURANT_READ_FAILED', 'Não foi possível consultar o restaurante.')
  if (!result.data) throw new HttpError(404, 'RESTAURANT_NOT_FOUND', 'Restaurante não encontrado.')

  const members = await context.supabase.rpc('list_restaurant_members', { p_restaurant_id: id })
  if (members.error) throw new HttpError(500, 'RESTAURANT_MEMBERS_READ_FAILED', 'Não foi possível consultar os responsáveis.')

  return {
    id: result.data.id,
    name: result.data.name,
    slug: result.data.slug,
    segment: result.data.segment,
    status: result.data.status,
    deletedAt: result.data.deleted_at,
    createdAt: result.data.created_at,
    updatedAt: result.data.updated_at,
    members: members.data.map((member) => ({
      id: member.membership_id,
      name: member.display_name || member.email.split('@')[0],
      email: member.email,
      role: member.member_role,
    })),
  }
}
