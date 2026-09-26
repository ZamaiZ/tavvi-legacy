import { z } from 'zod'

export const restaurantStatusSchema = z.enum(['draft', 'active', 'suspended'])
export const restaurantRoleSchema = z.enum(['admin', 'cashier', 'attendant', 'waiter'])

export const restaurantSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  segment: z.string().nullable(),
  status: restaurantStatusSchema,
  deletedAt: z.string().nullable(),
})

export const restaurantDetailSchema = restaurantSummarySchema.extend({
  createdAt: z.string(),
  updatedAt: z.string(),
  members: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string().email(),
    role: restaurantRoleSchema,
  })),
})

export type RestaurantStatus = z.infer<typeof restaurantStatusSchema>
export type RestaurantSummary = z.infer<typeof restaurantSummarySchema>
export type RestaurantDetail = z.infer<typeof restaurantDetailSchema>
