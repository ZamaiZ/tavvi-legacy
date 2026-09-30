'use client'

import { LuImage } from 'react-icons/lu'
import type { OwnerMenuCategoryDTO } from '@/domain/menu'
import { PanelEmptyState } from '@/features/workspace/components/panel-empty-state'
import { firstMedia, focalPosition, mediaPreviewUrl } from '../../lib/item-display'
import { StandaloneItemContextMenu } from '../item-context-menu'

// Sequência (README §7.5, item 12): a ordem do feed público.
export function SequenceMode({ restaurantId, categories, canEdit, onReviewMenu }: { restaurantId: string; categories: OwnerMenuCategoryDTO[]; canEdit: boolean; onReviewMenu: () => void }) {
  const feed = categories
    .filter((category) => category.isVisible)
    .flatMap((category) => category.items.filter((item) => item.isVisible && item.media.length > 0).map((item) => ({ category, item })))

  return (
    <>
      <p className="tv-mode-intro">A ordem em que os pratos aparecem no feed público. Só entram itens visíveis com foto ou vídeo.</p>
      {feed.length === 0 ? (
        <PanelEmptyState
          density="section"
          icon={<LuImage />}
          title="Seu feed ainda está vazio"
          description="Confira a visibilidade das categorias e dos itens ou adicione fotos e vídeos ao cardápio."
          action={<button type="button" className="tv-pbtn is-sm" onClick={onReviewMenu}>Revisar cardápio</button>}
        />
      ) : (
        <section className="tv-seq" aria-label="Ordem do feed público">
          {feed.map(({ category, item }, index) => {
            const media = firstMedia(item)
            const url = media ? mediaPreviewUrl(media) : null
            return (
              <StandaloneItemContextMenu
                key={item.id}
                restaurantId={restaurantId}
                item={item}
                categories={categories}
                disabled={!canEdit}
                render={<article />}
              >
                <div className="tv-seq-media">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {media && url ? <img src={url} alt="" loading="lazy" style={{ objectPosition: focalPosition(media) }} /> : null}
                  <span>{String(index + 1).padStart(2, '0')}</span>
                </div>
                <small>{category.name}</small>
                <strong>{item.name}</strong>
                {!item.isAvailable ? <em>Esgotado</em> : null}
              </StandaloneItemContextMenu>
            )
          })}
        </section>
      )}
    </>
  )
}
