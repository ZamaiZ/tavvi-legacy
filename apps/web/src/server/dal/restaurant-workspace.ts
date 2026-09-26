import 'server-only'

import { cache } from 'react'
import type { MemberRole } from '@/domain/invite'
import type { RestaurantMemberDTO } from '@/domain/restaurant'
import { myRole } from './auth'
import { getRestaurantForMember } from './restaurant-read'

export type RestaurantWorkspace = {
  restaurant: RestaurantMemberDTO
  role: MemberRole | null
  canEdit: boolean
}

export const getRestaurantWorkspace = cache(
  async (restaurantId: string): Promise<RestaurantWorkspace | null> => {
    const [restaurant, role] = await Promise.all([
      getRestaurantForMember(restaurantId),
      myRole(restaurantId),
    ])

    if (!restaurant) return null

    return {
      restaurant,
      role,
      canEdit: role === 'admin',
    }
  },
)
