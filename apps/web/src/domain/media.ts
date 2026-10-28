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

// 15 segundos por vídeo. Conferido no navegador ao escolher o arquivo e de
// novo ao prepará-lo: o servidor não lê duração sem transcodificar.
export const MAX_VIDEO_DURATION_MS = 15_000

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
export const focalSchema = z.number().min(0).max(1)

// Autorização de envio de um arquivo de item. `itemId` nulo: o item ainda
// não existe (criação). O servidor reserva o id e o devolve, e as próximas
// autorizações do mesmo salvamento reaproveitam esse id.
export const itemUploadTicketSchema = z.object({
  restaurantId: uuidSchema,
  itemId: uuidSchema.nullable(),
  kind: mediaKindSchema,
  mimeType: z.string().min(1).max(100),
})

// Autorização de todos os arquivos novos de uma criação em massa. Os IDs e
// chaves identificam a mídia no rascunho; caminhos continuam sendo gerados
// exclusivamente pelo servidor.
export const itemBatchUploadTicketsSchema = z.object({
  restaurantId: uuidSchema,
  files: z.array(z.object({
    itemId: uuidSchema,
    mediaKey: uuidSchema,
    kind: mediaKindSchema,
    mimeType: z.string().min(1).max(100),
    posterMimeType: z.string().min(1).max(100).optional(),
  })).min(1).max(300),
}).superRefine((data, ctx) => {
  const seen = new Set<string>()
  const perItem = new Map<string, number>()
  data.files.forEach((file, index) => {
    const key = `${file.itemId}:${file.mediaKey}`
    if (seen.has(key)) {
      ctx.addIssue({ code: 'custom', path: ['files', index, 'mediaKey'], message: 'Mídia repetida no lote.' })
    }
    if (file.kind === 'image' && file.posterMimeType) {
      ctx.addIssue({ code: 'custom', path: ['files', index, 'posterMimeType'], message: 'Fotos não têm capa de vídeo.' })
    }
    const itemCount = (perItem.get(file.itemId) ?? 0) + 1
    if (itemCount > MAX_MEDIA_PER_ITEM) {
      ctx.addIssue({ code: 'custom', path: ['files', index, 'itemId'], message: `Use no máximo ${MAX_MEDIA_PER_ITEM} mídias por item.` })
    }
    perItem.set(file.itemId, itemCount)
    seen.add(key)
  })
})

export const discardItemBatchUploadsSchema = z.object({
  restaurantId: uuidSchema,
  files: z.array(z.object({
    itemId: uuidSchema,
    kind: mediaKindSchema,
    path: z.string().min(1).max(400),
  })).min(1).max(600),
})

export type ItemBatchUploadTicketsInput = z.input<typeof itemBatchUploadTicketsSchema>
export type BatchUploadTicket = {
  itemId: string
  mediaKey: string
  kind: MediaKind
  bucket: string
  path: string
  signedUrl: string
  poster?: { bucket: string; path: string; signedUrl: string }
}

// Arquivos que subiram para um salvamento que não chegou ao banco.
export const discardUploadsSchema = z.object({
  restaurantId: uuidSchema,
  itemId: uuidSchema,
  files: z
    .array(z.object({ kind: mediaKindSchema, path: z.string().min(1).max(400) }))
    .min(1)
    .max(20),
})
