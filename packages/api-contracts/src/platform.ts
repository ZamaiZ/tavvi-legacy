import { z } from 'zod'

export const platformInvitationSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().nullable(),
  expiresAt: z.string(),
  redeemedAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
  createdAt: z.string(),
  createdByEmail: z.string().email(),
  redeemedByEmail: z.string().email().nullable(),
})

export const createInvitationInputSchema = z.object({
  email: z.union([z.string().trim().email().max(254), z.literal('')]).optional(),
  expiresInDays: z.number().int().min(1).max(30),
})

export const createdInvitationSchema = z.object({ id: z.string().uuid(), link: z.string().url() })
export const revokedInvitationSchema = z.object({ id: z.string().uuid(), revokedAt: z.string() })

export type PlatformInvitation = z.infer<typeof platformInvitationSchema>
export type CreateInvitationInput = z.infer<typeof createInvitationInputSchema>
export type CreatedInvitation = z.infer<typeof createdInvitationSchema>
export type RevokedInvitation = z.infer<typeof revokedInvitationSchema>
