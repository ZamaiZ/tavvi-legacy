import { z } from 'zod'
import { plainTextSchema, uuidSchema } from './common'

// Base32 sem caracteres ambíguos (sem I, L, O, U), 16 caracteres.
export const tagTokenSchema = z
  .string()
  .regex(/^[0-9A-HJKMNP-TV-Z]{16}$/, { error: 'Plaquinha inválida' })

export const createTagSchema = z.object({
  restaurantId: uuidSchema,
  tableNumber: z.number().int().positive(),
  label: plainTextSchema(40).optional(),
})

export const updateTagSchema = z.object({
  tagId: uuidSchema,
  tableNumber: z.number().int().positive().nullable(),
  isActive: z.boolean(),
})

export type TagDTO = {
  id: string
  publicToken: string
  label: string | null
  tableNumber: number | null
  isActive: boolean
  lastSeenAt: string | null
}

export type ResolvedTagDTO = {
  restaurantSlug: string
  tagLabel: string | null
  tableNumber: number | null
}
