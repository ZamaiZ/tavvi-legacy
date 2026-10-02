import { z } from 'zod'
import { slugSchema, timestampSchema, uuidSchema } from './common'
import { MEDIA_LIMITS } from './media'

export const FEEDBACK_MIN_LENGTH = 3
export const FEEDBACK_MAX_LENGTH = 1000
export const FEEDBACK_MAX_PHOTOS = 3
export const FEEDBACK_PHOTO_MAX_SIDE = 1920
export const FEEDBACK_BUCKET = 'feedback-photos'

const feedbackPhotoSchema = z.object({
  mime: z.enum(MEDIA_LIMITS.image.mimes),
  width: z.number().int().min(1).max(FEEDBACK_PHOTO_MAX_SIDE),
  height: z.number().int().min(1).max(FEEDBACK_PHOTO_MAX_SIDE),
})

// Campo-armadilha: invisível para pessoas, preenchido por robôs.
const trapSchema = z.string().max(500).optional()

export const startFeedbackSchema = z.object({
  slug: slugSchema,
  body: z
    .string()
    .trim()
    .min(FEEDBACK_MIN_LENGTH, { error: 'Escreva pelo menos 3 caracteres.' })
    .max(FEEDBACK_MAX_LENGTH, { error: 'O texto passa de 1000 caracteres.' }),
  photos: z.array(feedbackPhotoSchema).max(FEEDBACK_MAX_PHOTOS, { error: 'Cabem 3 fotos por feedback.' }),
  website: trapSchema,
})

export const publishFeedbackSchema = z.object({
  feedbackId: uuidSchema,
  website: trapSchema,
})

export type StartedFeedback = { feedbackId: string; uploads: { position: number; signedUrl: string }[] }

// ---------- painel ----------
export type FeedbackPhotoDTO = { id: string; url: string | null; width: number; height: number; position: number }
export type FeedbackDTO = { id: string; body: string; publishedAt: string; readAt: string | null; photos: FeedbackPhotoDTO[] }
export type FeedbackFilter = 'all' | 'unread'
export type FeedbackCursor = { publishedAt: string; id: string }
export type FeedbackPage = { items: FeedbackDTO[]; nextCursor: FeedbackCursor | null }

export const listFeedbackSchema = z.object({
  restaurantId: uuidSchema,
  filter: z.enum(['all', 'unread']).default('all'),
  cursor: z.object({ publishedAt: timestampSchema, id: uuidSchema }).optional(),
})

export const feedbackRefSchema = z.object({
  restaurantId: uuidSchema,
  feedbackId: uuidSchema,
})

export const markFeedbackReadSchema = feedbackRefSchema.extend({
  read: z.boolean(),
})
