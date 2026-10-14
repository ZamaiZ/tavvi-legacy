import { z } from 'zod'
import {
  comparableText,
  plainTextSchema,
  positionSchema,
  priceCentsSchema,
  uuidSchema,
} from './common'
import { focalSchema, MAX_VIDEO_DURATION_MS, mediaKindSchema } from './media'
import type { RestaurantContact } from './restaurant'
import type { MenuPresentation } from './menu-presentation'

export const MAX_CATEGORIES_PER_BATCH = 20

// Criar várias categorias de uma vez. Nome repetido DENTRO do lote é
// recusado (é erro de digitação, quase sempre); igual a uma categoria que já
// existe não é, para a regra ficar a mesma da edição.
export const createCategoriesSchema = z
  .object({
    restaurantId: uuidSchema,
    categories: z
      .array(
        z.object({
          name: plainTextSchema(80, 2),
          description: plainTextSchema(300).optional(),
        }),
      )
      .min(1, { error: 'Adicione ao menos uma categoria.' })
      .max(MAX_CATEGORIES_PER_BATCH, { error: `Só cabem ${MAX_CATEGORIES_PER_BATCH} categorias por vez.` }),
  })
  .superRefine((data, ctx) => {
    const seen = new Set<string>()
    data.categories.forEach((category, index) => {
      const key = comparableText(category.name)
      if (seen.has(key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['categories', index, 'name'],
          message: `Nome repetido neste lote: '${category.name}'.`,
        })
      }
      seen.add(key)
    })
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

// Os campos do item que as ações rápidas (Planilha, mover, mostrar/ocultar)
// mandam de volta. Criar e editar pelo painel usam o `saveItemSchema`.
const itemFieldsSchema = z.object({
  restaurantId: uuidSchema,
  categoryId: uuidSchema,
  name: plainTextSchema(120, 2),
  description: plainTextSchema(600).optional(),
  basePriceCents: priceCentsSchema,
  dietaryTags: z.array(plainTextSchema(30)).max(10).default([]),
})

// categoryId NÃO é omitido: trocar a categoria de um item é edição comum, e
// omiti-lo aqui tornava isso impossível — o campo nem chegava ao banco.
export const updateItemSchema = itemFieldsSchema
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
    contact: RestaurantContact
    // `unknown` de propósito: a coluna é jsonb livre, e quem sabe a forma
    // dela é o `themeSchema`, não este DTO. Tipar como `ThemeChoice` aqui
    // seria mentir sobre um dado que ainda não foi validado.
    theme: unknown
    menuPresentation: MenuPresentation
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

export const MAX_VARIANTS_PER_ITEM = 30

const variantInputSchema = z.object({
  id: uuidSchema.optional(),
  name: plainTextSchema(60, 1),
  priceCents: priceCentsSchema,
  isAvailable: z.boolean(),
})

const mediaInputSchema = z.discriminatedUnion('source', [
  z.object({ source: z.literal('saved'), id: uuidSchema, focalX: focalSchema, focalY: focalSchema }),
  z.object({
    source: z.literal('new'),
    kind: mediaKindSchema,
    storagePath: z.string().min(1).max(400),
    posterPath: z.string().min(1).max(400).optional(),
    width: z.int().min(1).max(10_000).optional(),
    height: z.int().min(1).max(10_000).optional(),
    durationMs: z.int().min(1).max(MAX_VIDEO_DURATION_MS).optional(),
    focalX: focalSchema,
    focalY: focalSchema,
  }),
])

// Tudo o que o "Salvar"/"Criar" do item grava, numa chamada só
// (`save_menu_item`). A ordem de `variants` e de `media` é a posição.
export const saveItemSchema = z
  .object({
    mode: z.enum(['create', 'update']),
    restaurantId: uuidSchema,
    itemId: uuidSchema,
    categoryId: uuidSchema,
    name: plainTextSchema(120, 2),
    description: plainTextSchema(600).optional(),
    dietaryTags: z.array(plainTextSchema(30)).max(10).default([]),
    isVisible: z.boolean(),
    isAvailable: z.boolean(),
    pricing: z.discriminatedUnion('mode', [
      z.object({ mode: z.literal('single'), basePriceCents: priceCentsSchema }),
      z.object({
        mode: z.literal('variants'),
        variants: z
          .array(variantInputSchema)
          .min(1, { error: 'Adicione ao menos uma variação.' })
          .max(MAX_VARIANTS_PER_ITEM, { error: `Use no máximo ${MAX_VARIANTS_PER_ITEM} variações.` }),
      }),
    ]),
    // 10, e não 6: itens antigos podem ter mais que o teto atual. O teto
    // vale quando algo é acrescentado, e quem confere é a função no banco.
    media: z.array(mediaInputSchema).max(10),
  })
  .superRefine((data, ctx) => {
    if (data.pricing.mode !== 'variants') return
    const seen = new Set<string>()
    data.pricing.variants.forEach((variant, index) => {
      const key = comparableText(variant.name)
      if (seen.has(key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['pricing', 'variants', index, 'name'],
          message: `Variação repetida: '${variant.name}'.`,
        })
      }
      seen.add(key)
    })
  })

export type SaveItemInput = z.input<typeof saveItemSchema>
