import { comparableText } from '@/domain/common'
import { MAX_VARIANTS_PER_ITEM, type OwnerMenuItemDTO, type SaveItemInput } from '@/domain/menu'

export const MAX_VARIANTS = MAX_VARIANTS_PER_ITEM

export type VariantDraft = {
  key: string
  /** Id no banco. Sem ele, a variação nasce ao salvar. */
  id?: string
  name: string
  priceCents: number | null
  isAvailable: boolean
}

export type MediaPrep =
  | { status: 'queued' }
  | { status: 'preparing'; progress: number }
  | { status: 'ready'; blob: Blob; width?: number; height?: number; durationMs: number | null }
  | { status: 'error'; error: string }

export type MediaDraft = {
  key: string
  source:
    | { type: 'saved'; id: string; kind: 'image' | 'video'; storagePath: string; posterPath: string | null }
    | {
        type: 'new'
        kind: 'image' | 'video'
        fileName: string
        /** Prévia local (a foto, ou o quadro capturado do vídeo). */
        previewUrl: string | null
        prep: MediaPrep
        upload: 'idle' | 'uploading' | 'done'
      }
  focalX: number
  focalY: number
}

// O item inteiro em edição. Nada daqui vai ao servidor antes do "Salvar":
// variações, mídia, ordem e capa vivem só no rascunho.
export type ItemDraft = {
  name: string
  description: string
  categoryId: string
  dietaryTags: string[]
  isVisible: boolean
  isAvailable: boolean
  pricing: 'single' | 'variants'
  basePriceCents: number | null
  /** Ordem = posição no cardápio. */
  variants: VariantDraft[]
  /** Ordem = ordem das telas; a primeira é a capa. */
  media: MediaDraft[]
}

export type DraftErrors = {
  name?: string
  description?: string
  price?: string
  variants?: string
  variantRows?: Record<string, string>
  media?: string
}

export type UploadedMedia = {
  storagePath: string
  posterPath?: string
  width?: number
  height?: number
  durationMs?: number
}

const ANGLE = 'Não são permitidos os caracteres < e >.'

export function draftFromItem(item: OwnerMenuItemDTO): ItemDraft {
  const hasVariants = item.variants.length > 0
  return {
    name: item.name,
    description: item.description ?? '',
    categoryId: item.categoryId,
    dietaryTags: item.dietaryTags,
    isVisible: item.isVisible,
    isAvailable: item.isAvailable,
    pricing: hasVariants ? 'variants' : 'single',
    // Com variações, o preço único não existe para quem edita: voltar para
    // "Preço único" começa com o campo vazio, e não com o valor derivado.
    basePriceCents: hasVariants ? null : item.basePriceCents,
    variants: item.variants.map((variant) => ({
      key: variant.id,
      id: variant.id,
      name: variant.name,
      priceCents: variant.priceCents,
      isAvailable: variant.isAvailable,
    })),
    media: [...item.media]
      .sort((a, b) => a.position - b.position)
      .map((media): MediaDraft => ({
        key: media.id,
        source: { type: 'saved', id: media.id, kind: media.kind, storagePath: media.storagePath, posterPath: media.posterPath },
        focalX: media.focalX,
        focalY: media.focalY,
      })),
  }
}

export function emptyDraft(categoryId: string): ItemDraft {
  return {
    name: '',
    description: '',
    categoryId,
    dietaryTags: [],
    isVisible: true,
    isAvailable: true,
    pricing: 'single',
    basePriceCents: null,
    variants: [],
    media: [],
  }
}

// O que conta como "mudou". Chaves locais e o estado da preparação não
// contam; a mídia conta pela identidade e pela ordem.
export function draftFingerprint(draft: ItemDraft): string {
  return JSON.stringify({
    name: draft.name,
    description: draft.description,
    categoryId: draft.categoryId,
    dietaryTags: draft.dietaryTags,
    isVisible: draft.isVisible,
    isAvailable: draft.isAvailable,
    pricing: draft.pricing,
    basePriceCents: draft.pricing === 'single' ? draft.basePriceCents : null,
    variants:
      draft.pricing === 'variants'
        ? draft.variants.map((variant) => [variant.id ?? null, variant.name, variant.priceCents, variant.isAvailable])
        : [],
    media: draft.media.map((media) => media.source.type === 'saved' ? media.source.id : media.key),
  })
}

// As regras do servidor, repetidas aqui para dizer o problema no campo,
// antes de qualquer envio. Quem garante continua sendo o servidor.
export function validateDraft(draft: ItemDraft): DraftErrors {
  const errors: DraftErrors = {}

  const name = draft.name.trim()
  if (name.length < 2) errors.name = 'Mínimo de 2 caracteres.'
  else if (name.length > 120) errors.name = 'Máximo de 120 caracteres.'
  else if (/[<>]/.test(name)) errors.name = ANGLE

  const description = draft.description.trim()
  if (description.length > 600) errors.description = 'Máximo de 600 caracteres.'
  else if (/[<>]/.test(description)) errors.description = ANGLE

  if (draft.pricing === 'single') {
    if (draft.basePriceCents === null) errors.price = 'Informe o preço.'
  } else {
    if (draft.variants.length === 0) errors.variants = 'Adicione ao menos uma variação.'
    else if (draft.variants.length > MAX_VARIANTS) errors.variants = `Use no máximo ${MAX_VARIANTS} variações.`

    const rows: Record<string, string> = {}
    const seen = new Set<string>()
    for (const variant of draft.variants) {
      const variantName = variant.name.trim()
      if (!variantName) rows[variant.key] = 'Informe o nome da variação.'
      else if (variantName.length > 60) rows[variant.key] = 'Máximo de 60 caracteres.'
      else if (/[<>]/.test(variantName)) rows[variant.key] = ANGLE
      else if (variant.priceCents === null) rows[variant.key] = 'Informe o preço da variação.'
      else if (seen.has(comparableText(variantName))) rows[variant.key] = `Variação repetida: '${variantName}'.`
      if (variantName) seen.add(comparableText(variantName))
    }
    if (Object.keys(rows).length > 0) errors.variantRows = rows
  }

  if (draft.media.some((media) => media.source.type === 'new' && media.source.prep.status === 'error')) {
    errors.media = 'Remova as mídias com erro para salvar.'
  }
  return errors
}

export function hasErrors(errors: DraftErrors): boolean {
  return Object.keys(errors).length > 0
}

// A frase do rodapé quando o salvar é recusado: a causa mais provável
// primeiro, e o campo em si mostra o detalhe.
export function firstErrorMessage(errors: DraftErrors): string {
  return (
    errors.name ??
    errors.price ??
    errors.variants ??
    (errors.variantRows ? 'Revise as variações destacadas.' : undefined) ??
    errors.media ??
    errors.description ??
    'Revise os campos destacados.'
  )
}

export function toSavePayload({
  mode,
  restaurantId,
  itemId,
  draft,
  uploaded,
}: {
  mode: 'create' | 'update'
  restaurantId: string
  itemId: string
  draft: ItemDraft
  uploaded: ReadonlyMap<string, UploadedMedia>
}): SaveItemInput {
  return {
    mode,
    restaurantId,
    itemId,
    categoryId: draft.categoryId,
    name: draft.name.trim(),
    description: draft.description.trim() || undefined,
    dietaryTags: draft.dietaryTags,
    isVisible: draft.isVisible,
    isAvailable: draft.isAvailable,
    pricing:
      draft.pricing === 'single'
        ? { mode: 'single', basePriceCents: draft.basePriceCents ?? 0 }
        : {
            mode: 'variants',
            variants: draft.variants.map((variant) => ({
              id: variant.id,
              name: variant.name.trim(),
              priceCents: variant.priceCents ?? 0,
              isAvailable: variant.isAvailable,
            })),
          },
    media: draft.media.map((media) => {
      if (media.source.type === 'saved') {
        return { source: 'saved' as const, id: media.source.id, focalX: media.focalX, focalY: media.focalY }
      }
      const file = uploaded.get(media.key)
      if (!file) throw new Error(`Mídia sem envio: ${media.source.fileName}`)
      return { source: 'new' as const, kind: media.source.kind, ...file, focalX: media.focalX, focalY: media.focalY }
    }),
  }
}
