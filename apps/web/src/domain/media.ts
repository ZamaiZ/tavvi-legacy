import { z } from 'zod'
import { plainTextSchema, uuidSchema } from './common'

export const mediaKindSchema = z.enum(['image', 'video'])
export type MediaKind = z.infer<typeof mediaKindSchema>

export const IMAGE_BUCKET = 'menu-images'
export const VIDEO_BUCKET = 'menu-videos'

// Teto por ITEM, não por tipo. O dono não pensa em "quantas imagens e
// quantos vídeos"; pensa em "quantas telas tem meu prato" — que é o que o
// cliente rola no feed. Uma regra, um número, uma mensagem de recusa.
//
// Substitui os dois `maxPerItem` que existiam até a Fase 4 (4 imagens e 1
// vídeo, contados à parte). Seis telas verticais já é bastante antes de
// chegar ao próximo prato.
//
// Itens que já têm mais que isso continuam válidos: o teto é conferido só ao
// inserir, e nada é apagado.
export const MAX_MEDIA_PER_ITEM = 6

export const MEDIA_LIMITS = {
  image: {
    bucket: IMAGE_BUCKET,
    // O teto de peso passa a valer sobre o arquivo JÁ COMPRIMIDO, a partir
    // da Fase 5. Aplicá-lo ao original recusaria foto de celular que
    // comprimiria bem abaixo dele.
    maxBytes: 5_242_880,
    mimes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
  },
  video: {
    bucket: VIDEO_BUCKET,
    // Idem: sobre o comprimido. Um vídeo de 40MB do celular comprime para
    // poucos megabytes, e recusá-lo antes disso desperdiçaria justamente a
    // compressão que a Fase 5 construiu.
    maxBytes: 10_485_760,
    mimes: ['video/mp4', 'video/webm'],
  },
} as const

// A marca do restaurante: logo e capa. Vive no mesmo bucket de imagem do
// cardápio, sob o prefixo `${restaurantId}/brand/`, o que faz a política de
// storage já valer — ela lê o PRIMEIRO segmento do caminho para descobrir o
// inquilino, e esse segmento continua sendo o id do restaurante.
export const brandSlotSchema = z.enum(['logo', 'cover'])
export type BrandSlot = z.infer<typeof brandSlotSchema>

export const BRAND_SLOT_LABELS: Record<BrandSlot, string> = {
  logo: 'Logo',
  cover: 'Foto de capa',
}

export const setBrandImageSchema = z.object({
  restaurantId: uuidSchema,
  slot: brandSlotSchema,
  // Nulo remove a imagem. É a mesma operação vista do outro lado, e separar
  // em duas ações criaria dois caminhos para o mesmo apagamento de arquivo.
  storagePath: z.string().min(1).max(400).nullable(),
})

// O ponto que o dono marcou como "não pode sair do quadro". Vira
// `object-position` na hora de desenhar. 0,5/0,5 é o centro, que é o que o
// `cover` já fazia sozinho.
const focalSchema = z.number().min(0).max(1)

export const setMediaFocalSchema = z.object({
  mediaId: uuidSchema,
  focalX: focalSchema,
  focalY: focalSchema,
})

// Mesmo formato do `reorderSchema` de `@/domain/menu`, que já serve
// categorias e itens. Um formato só de reordenação no projeto inteiro.
//
// O teto de 10 é folga sobre o máximo real, que é 4 imagens + 1 vídeo: itens
// antigos podem ter até 6 imagens, de antes de o teto baixar.
export const reorderMediaSchema = z.object({
  itemId: uuidSchema,
  order: z
    .array(z.object({ id: uuidSchema, position: z.int().min(0).max(10) }))
    .min(1),
})

export const registerMediaSchema = z.object({
  itemId: uuidSchema,
  kind: mediaKindSchema,
  storagePath: z.string().min(1).max(400),
  // Só faz sentido quando kind = 'video'. Anulável porque a captura pode
  // falhar, e falhar em capturar não impede subir o vídeo.
  posterPath: z.string().min(1).max(400).optional(),
  altText: plainTextSchema(160).optional(),
  width: z.int().min(1).max(10_000).optional(),
  height: z.int().min(1).max(10_000).optional(),
  // 15 segundos. Validado no navegador; o servidor não consegue conferir
  // duração sem transcodificar. Limitação registrada na spec.
  durationMs: z.int().min(1).max(15_000).optional(),
  focalX: focalSchema.optional(),
  focalY: focalSchema.optional(),
})
