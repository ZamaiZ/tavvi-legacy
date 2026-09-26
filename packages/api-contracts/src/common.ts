import { z } from 'zod'

export const apiFailureSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
})

export function apiSuccessSchema<T extends z.ZodType>(data: T) {
  return z.object({ data })
}

export const paginationInputSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().max(512).optional(),
})

export type ApiSuccess<T> = { data: T }
export type ApiFailure = z.infer<typeof apiFailureSchema>
export type PaginationInput = z.infer<typeof paginationInputSchema>
export type Paginated<T> = { items: T[]; nextCursor: string | null }
