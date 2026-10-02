'use client'

import { useEffect, useRef } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { LuChevronLeft, LuChevronRight, LuX } from 'react-icons/lu'
import type { FeedbackPhotoDTO } from '@/domain/feedback'
import { useTerritoryContainer } from '@/features/workspace/components/use-territory-container'

// Tela cheia: a faixa rola na horizontal com scroll-snap NATIVO. Deslizar é
// o gesto do próprio navegador, sem JavaScript de toque (regra do painel no
// celular); as setas e o teclado só pulam de foto.
export function PhotoViewer({
  photos,
  index,
  onClose,
}: {
  photos: FeedbackPhotoDTO[]
  index: number
  onClose: () => void
}) {
  const container = useTerritoryContainer()
  const stripRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const target = stripRef.current?.children[index] as HTMLElement | undefined
    target?.scrollIntoView({ block: 'nearest', inline: 'start' })
  }, [index])

  function step(delta: number) {
    const strip = stripRef.current
    if (!strip) return
    const current = Math.round(strip.scrollLeft / strip.clientWidth)
    const next = Math.min(photos.length - 1, Math.max(0, current + delta))
    const target = strip.children[next] as HTMLElement | undefined
    target?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })
  }

  return (
    <Dialog.Root open onOpenChange={(next) => { if (!next) onClose() }}>
      <Dialog.Portal container={container}>
        <Dialog.Backdrop className="tv-fb-viewer-scrim" />
        <Dialog.Popup
          className="tv-fb-viewer"
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight') step(1)
            if (event.key === 'ArrowLeft') step(-1)
          }}
        >
          <Dialog.Title className="sr-only">Fotos do feedback</Dialog.Title>
          <Dialog.Close className="tv-fb-viewer-close" aria-label="Fechar">
            <LuX aria-hidden="true" />
          </Dialog.Close>
          <div ref={stripRef} className="tv-fb-viewer-strip">
            {photos.map((photo, position) => (
              <figure key={photo.id} className="tv-fb-viewer-slide">
                {photo.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo.url} alt={`Foto ${position + 1} de ${photos.length}`} />
                ) : (
                  <figcaption>Foto indisponível</figcaption>
                )}
              </figure>
            ))}
          </div>
          {photos.length > 1 ? (
            <>
              <button type="button" className="tv-fb-viewer-nav is-prev" aria-label="Foto anterior" onClick={() => step(-1)}>
                <LuChevronLeft aria-hidden="true" />
              </button>
              <button type="button" className="tv-fb-viewer-nav is-next" aria-label="Próxima foto" onClick={() => step(1)}>
                <LuChevronRight aria-hidden="true" />
              </button>
            </>
          ) : null}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
