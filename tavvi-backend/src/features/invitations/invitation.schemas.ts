import { z } from 'zod'

export const createInviteSchema = z.object({
  email: z.union([z.string().trim().email().max(254), z.literal('')]).optional(),
  expiresInDays: z.number().int().min(1).max(30),
})

export const inviteIdSchema = z.string().uuid()
export type CreateInviteInput = z.infer<typeof createInviteSchema>
