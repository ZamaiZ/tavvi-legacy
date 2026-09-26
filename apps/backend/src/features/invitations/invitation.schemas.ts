import { z } from 'zod'
import { createInvitationInputSchema } from '@tavvi/api-contracts'

export const createInviteSchema = createInvitationInputSchema
export const inviteIdSchema = z.string().uuid()
