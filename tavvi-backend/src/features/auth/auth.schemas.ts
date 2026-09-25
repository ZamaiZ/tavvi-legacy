import { z } from 'zod'

export const signInSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(1024),
})

export const refreshSchema = z.object({
  refreshToken: z.string().min(1).max(4096),
})

export type SignInInput = z.infer<typeof signInSchema>
export type RefreshInput = z.infer<typeof refreshSchema>
