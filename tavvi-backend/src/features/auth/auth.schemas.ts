import { z } from 'zod'

export const signInSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(1024),
})

export const refreshSchema = z.object({
  refreshToken: z.string().min(1).max(4096),
})

const deviceProof = {
  deviceId: z.string().uuid(),
  deviceSecret: z.string().regex(/^[a-f0-9]{64}$/),
}

export const deviceContractRegistrationSchema = z.object({
  ...deviceProof,
  refreshToken: z.string().min(1).max(4096),
})

export const deviceContractLoginSchema = z.object(deviceProof)

export type SignInInput = z.infer<typeof signInSchema>
export type RefreshInput = z.infer<typeof refreshSchema>
export type DeviceContractRegistrationInput = z.infer<typeof deviceContractRegistrationSchema>
export type DeviceContractLoginInput = z.infer<typeof deviceContractLoginSchema>
