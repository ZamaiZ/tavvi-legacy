import { LuFilm, LuImagePlus } from 'react-icons/lu'
import type { OwnerMenuItemDTO } from '@/domain/menu'
import { firstMedia, focalPosition, mediaPreviewUrl } from '../lib/item-display'

// Miniatura 44 px da Lista. Sem mídia: tracejada com image-plus. Vídeo sem
// capa: ícone de filme. O recorte segue o ponto focal, como no feed.
export function ItemThumb({ item }: { item: OwnerMenuItemDTO }) {
  const media = firstMedia(item)
  const url = media ? mediaPreviewUrl(media) : null
  if (media && url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" width={44} height={44} loading="lazy" className="tv-item-thumb" style={{ objectPosition: focalPosition(media) }} />
  }
  return (
    <span className={`tv-item-thumb ${media ? 'is-video' : 'is-empty'}`} aria-hidden="true">
      {media ? <LuFilm /> : <LuImagePlus />}
    </span>
  )
}
