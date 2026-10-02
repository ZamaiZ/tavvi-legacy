import type { OwnerMenuItemDTO } from '@/domain/menu'
import { publicMediaUrl } from '@/lib/media-url'
import { formatCents, priceSummary } from '@/lib/money'

type ItemMedia = OwnerMenuItemDTO['media'][number]

// A primeira mídia por POSIÇÃO: é ela que abre o prato no feed.
export function firstMedia(item: Pick<OwnerMenuItemDTO, 'media'>): ItemMedia | null {
  return [...item.media].sort((a, b) => a.position - b.position)[0] ?? null
}

export function mediaPreviewUrl(media: ItemMedia): string | null {
  if (media.kind === 'image') return publicMediaUrl('image', media.storagePath)
  return media.posterPath ? publicMediaUrl('image', media.posterPath) : null
}

export function focalPosition(media: Pick<ItemMedia, 'focalX' | 'focalY'>): string {
  return `${media.focalX * 100}% ${media.focalY * 100}%`
}

export function priceLabel(item: Pick<OwnerMenuItemDTO, 'variants' | 'basePriceCents'>): string {
  const { cents, from } = priceSummary(item)
  return `${from ? 'A partir de ' : ''}${formatCents(cents)}`
}

export function variantCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'variação' : 'variações'}`
}

function count(value: number, one: string, many: string) {
  return `${value} ${value === 1 ? one : many}`
}

export function mediaSummary(item: Pick<OwnerMenuItemDTO, 'media' | 'variants'>): string {
  const photos = item.media.filter((media) => media.kind === 'image').length
  const videos = item.media.length - photos
  return [
    count(photos, 'foto', 'fotos'),
    count(videos, 'vídeo', 'vídeos'),
    count(item.variants.length, 'variação', 'variações'),
  ].join(' · ')
}
