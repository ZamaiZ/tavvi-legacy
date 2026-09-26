import { z } from 'zod'
import {
  plainTextSchema,
  positionSchema,
  priceCentsSchema,
  uuidSchema,
} from './common'

export const createCategorySchema = z.object({
  restaurantId: uuidSchema,
  name: plainTextSchema(80, 2),
  description: plainTextSchema(300).optional(),
})

export const updateCategorySchema = z.object({
  categoryId: uuidSchema,
  name: plainTextSchema(80, 2),
  description: plainTextSchema(300).optional(),
  isVisible: z.boolean(),
})

export const reorderSchema = z.object({
  restaurantId: uuidSchema,
  order: z.array(z.object({ id: uuidSchema, position: positionSchema })).min(1),
})

export const createItemSchema = z.object({
  restaurantId: uuidSchema,
  categoryId: uuidSchema,
  name: plainTextSchema(120, 2),
  description: plainTextSchema(600).optional(),
  basePriceCents: priceCentsSchema,
  dietaryTags: z.array(plainTextSchema(30)).max(10).default([]),
})

// categoryId NÃO é omitido: trocar a categoria de um item é edição comum, e
// omiti-lo aqui tornava isso impossível — o campo nem chegava ao banco.
export const updateItemSchema = createItemSchema
  .omit({ restaurantId: true })
  .extend({
    itemId: uuidSchema,
    isVisible: z.boolean(),
    isAvailable: z.boolean(),
  })

export const setItemAvailabilitySchema = z.object({
  itemId: uuidSchema,
  isAvailable: z.boolean(),
})

export const createVariantSchema = z.object({
  itemId: uuidSchema,
  name: plainTextSchema(60, 1),
  priceCents: priceCentsSchema,
})

export const updateVariantSchema = createVariantSchema.extend({
  variantId: uuidSchema,
  isAvailable: z.boolean(),
})

export type MenuMediaDTO = {
  kind: 'image' | 'video'
  storagePath: string
  posterPath: string | null
  altText: string | null
  durationMs: number | null
  /** Ponto que não pode sair do quadro. Vira `object-position` no feed. */
  focalX: number
  focalY: number
  /**
   * Dimensões do arquivo. `null` nas mídias enviadas antes da Fase 5, que é
   * quando a compressão passou a gravá-las.
   *
   * Em inglês, e não `largura`/`altura`: este DTO já usa `storagePath`,
   * `posterPath`, `altText`, `durationMs` e `focalX`. Misturar idioma dentro
   * de um tipo é como se descobre, seis meses depois, que existem dois
   * campos para a mesma coisa.
   */
  width: number | null
  height: number | null
}

export type MenuItemDTO = {
  id: string
  name: string
  description: string | null
  basePriceCents: number
  isAvailable: boolean
  variants: {
    id: string
    name: string
    priceCents: number
    isAvailable: boolean
  }[]
  media: MenuMediaDTO[]
  dietaryTags: string[]
}

export type MenuCategoryDTO = {
  id: string
  name: string
  description: string | null
  items: MenuItemDTO[]
}

export type PublicMenuDTO = {
  restaurant: {
    slug: string
    name: string
    description: string | null
    logoPath: string | null
    coverPath: string | null
    contact: Record<string, string>
    // `unknown` de propósito: a coluna é jsonb livre, e quem sabe a forma
    // dela é o `themeSchema`, não este DTO. Tipar como `ThemeChoice` aqui
    // seria mentir sobre um dado que ainda não foi validado.
    theme: unknown
  }
  categories: MenuCategoryDTO[]
}

// Espelha o PublicMenuDTO, mas expõe as bandeiras de visibilidade e não
// filtra nada: quem edita precisa ver o que o cliente não vê.
export type OwnerMenuItemDTO = {
  id: string
  // Necessário para o seletor de categoria do diálogo de edição saber qual
  // opção já está escolhida.
  categoryId: string
  name: string
  description: string | null
  basePriceCents: number
  isAvailable: boolean
  isVisible: boolean
  position: number
  dietaryTags: string[]
  variants: {
    id: string
    name: string
    priceCents: number
    isAvailable: boolean
  }[]
  media: {
    id: string
    kind: 'image' | 'video'
    storagePath: string
    posterPath: string | null
    altText: string | null
    position: number
    focalX: number
    focalY: number
  }[]
  /**
   * Visível e sem nenhuma mídia. É o que impede a publicação a partir da
   * Fase 4, e o que faz o item sumir do feed.
   */
  missingMedia: boolean
}

export type OwnerMenuCategoryDTO = {
  id: string
  name: string
  description: string | null
  position: number
  isVisible: boolean
  items: OwnerMenuItemDTO[]
}
