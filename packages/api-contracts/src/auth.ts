import { z } from 'zod'

export const userSummarySchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
})

export const authSessionSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.number().int().positive(),
  expiresIn: z.number().int().positive(),
  tokenType: z.literal('bearer'),
  user: userSummarySchema,
})

export const sessionSnapshotSchema = z.object({ user: userSummarySchema })
export const loginInputSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(1024),
})
export const signupInputSchema = loginInputSchema
export const refreshInputSchema = z.object({ refreshToken: z.string().min(1).max(4096) })

export const deviceIdSchema = z.string().uuid()

const deviceProofSchema = z.object({
  deviceId: deviceIdSchema,
  deviceSecret: z.string().regex(/^[a-f0-9]{64}$/),
})

export const deviceContractRegistrationSchema = deviceProofSchema
export const deviceContractLoginSchema = deviceProofSchema
export const deviceContractRegisteredSchema = z.object({ registered: z.literal(true) })
export const deviceContractStatusSchema = z.object({ active: z.boolean() })
export const signedOutSchema = z.object({ signedOut: z.literal(true) })

export type UserSummary = z.infer<typeof userSummarySchema>
export type AuthSession = z.infer<typeof authSessionSchema>
export type SessionSnapshot = z.infer<typeof sessionSnapshotSchema>
export type LoginInput = z.infer<typeof loginInputSchema>
export type SignupInput = z.infer<typeof signupInputSchema>
export type RefreshInput = z.infer<typeof refreshInputSchema>
export type DeviceContractRegistrationInput = z.infer<typeof deviceContractRegistrationSchema>
export type DeviceContractLoginInput = z.infer<typeof deviceContractLoginSchema>
export type DeviceContractRegistered = z.infer<typeof deviceContractRegisteredSchema>
export type DeviceContractStatus = z.infer<typeof deviceContractStatusSchema>
export type SignedOut = z.infer<typeof signedOutSchema>
