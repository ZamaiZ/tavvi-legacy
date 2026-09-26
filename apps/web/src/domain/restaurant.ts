import { z } from 'zod'
import { plainTextSchema, slugSchema, uuidSchema } from './common'
import { inviteTokenSchema } from './invite'
import { themeSchema } from './theme'

export const restaurantStatusSchema = z.enum(['draft', 'active', 'suspended'])
export type RestaurantStatus = z.infer<typeof restaurantStatusSchema>

// Não existe mais criação de restaurante pela plataforma. O restaurante nasce
// dentro de `redeem_platform_invite`, e a política de INSERT em `restaurants`
// continua fechada para todo mundo: ninguém ganha o direito de criar, ganha o
// direito de resgatar um convite.

export const updateRestaurantProfileSchema = z.object({
  restaurantId: uuidSchema,
  name: plainTextSchema(120, 2),
  description: plainTextSchema(500).optional(),
  contact: z
    .object({
      phone: plainTextSchema(30).optional(),
      whatsapp: plainTextSchema(30).optional(),
      instagram: plainTextSchema(60).optional(),
      address: plainTextSchema(200).optional(),
    })
    .default({}),
})
export type UpdateRestaurantProfileInput = z.infer<
  typeof updateRestaurantProfileSchema
>

export const setRestaurantStatusSchema = z.object({
  restaurantId: uuidSchema,
  status: restaurantStatusSchema,
})

// O dono não escolhe entre três situações: ele escolhe entre estar no ar e
// não estar. `suspended` não aparece aqui porque suspender nunca foi dele —
// e o gatilho no banco recusa mesmo que a aplicação tentasse.
export const setPublishedSchema = z.object({
  restaurantId: uuidSchema,
  published: z.boolean(),
})

// DTOs: o que sai da DAL. Nunca a linha crua do banco.
export type RestaurantPublicDTO = {
  slug: string
  name: string
  description: string | null
  logoPath: string | null
  coverPath: string | null
  contact: Record<string, string>
}

export type RestaurantAdminDTO = {
  id: string
  slug: string
  name: string
  status: RestaurantStatus
  segment: string | null
  createdAt: string
  deletedAt: string | null
}

export type RestaurantMemberDTO = {
  id: string
  slug: string
  name: string
  description: string | null
  status: RestaurantStatus
  logoPath: string | null
  coverPath: string | null
  contact: Record<string, string>
  segment: string | null
  // `unknown` de propósito: quem sabe a forma da coluna é o `themeSchema`,
  // não este DTO. Tipar aqui seria mentir sobre dado ainda não validado.
  theme: unknown
}

export const updateSlugSchema = z.object({
  restaurantId: uuidSchema,
  slug: slugSchema,
})

// O que o assistente envia ao confirmar o nome. Repare que não há
// `restaurantId`: o restaurante não existe ainda, e é este envio que o cria,
// junto com o resgate do convite, numa transação só.
export const createFromInviteSchema = z.object({
  token: inviteTokenSchema,
  name: plainTextSchema(120, 2),
  slug: slugSchema,
})

export const updateIdentitySchema = z.object({
  restaurantId: uuidSchema,
  segment: plainTextSchema(60, 2).nullish(),
  theme: themeSchema,
})

export type RestaurantDetailDTO = {
  id: string
  slug: string
  name: string
  description: string | null
  status: RestaurantStatus
  contact: Record<string, string>
  createdAt: string
  updatedAt: string
  segment: string | null
  deletedAt: string | null
}
