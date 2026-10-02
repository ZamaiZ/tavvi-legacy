'use client'

import { useState } from 'react'
import { LuMail, LuTrash2 } from 'react-icons/lu'
import { MobileSheet, MobileSheetNav } from '@/components/shell/mobile-sheet'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SpinnerRing } from '@/components/ui/spinner'
import type { FeedbackDTO } from '@/domain/feedback'
import { fullDateTime } from '@/lib/relative-time'
import { PhotoViewer } from './photo-viewer'

function FeedbackBody({
  feedback,
  showDate,
  onOpenPhoto,
  onImageError,
}: {
  feedback: FeedbackDTO
  showDate: boolean
  onOpenPhoto: (index: number) => void
  onImageError: () => void
}) {
  return (
    <>
      {showDate ? (
        <time className="tv-fb-detail-date" dateTime={feedback.publishedAt} suppressHydrationWarning>
          {fullDateTime(feedback.publishedAt)}
        </time>
      ) : null}
      <p className="tv-fb-detail-text">{feedback.body}</p>
      {feedback.photos.length > 0 ? (
        <div className="tv-fb-detail-photos">
          {feedback.photos.map((photo, index) => (
            <button
              key={photo.id}
              type="button"
              className="tv-fb-detail-photo"
              aria-label={`Abrir foto ${index + 1} em tela cheia`}
              disabled={!photo.url}
              onClick={() => onOpenPhoto(index)}
            >
              {photo.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo.url} alt={`Foto ${index + 1} do feedback`} onError={onImageError} />
              ) : (
                <span>Foto indisponível</span>
              )}
            </button>
          ))}
        </div>
      ) : null}
    </>
  )
}

// Desktop: Dialog. Celular: MobileSheet. Abrir já marcou como lido (na
// tela); aqui ficam "Marcar como não lido" e "Excluir".
export function FeedbackDetail({
  feedback,
  phone,
  marking,
  onClose,
  onMarkUnread,
  onDelete,
  onImageError,
}: {
  feedback: FeedbackDTO | null
  phone: boolean
  marking: boolean
  onClose: () => void
  onMarkUnread: () => void
  onDelete: () => void
  onImageError: () => void
}) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const open = feedback !== null

  const actions = (
    <div className="tv-fb-detail-actions">
      <button type="button" className="tv-fb-action" disabled={marking} aria-busy={marking || undefined} onClick={onMarkUnread}>
        {marking ? <SpinnerRing decorative /> : <LuMail aria-hidden="true" />}
        {marking ? 'Marcando…' : 'Marcar como não lido'}
      </button>
      <button type="button" className="tv-fb-action is-danger" disabled={marking} onClick={onDelete}>
        <LuTrash2 aria-hidden="true" />
        Excluir
      </button>
    </div>
  )

  return (
    <>
      {phone ? (
        <MobileSheet open={open} onOpenChange={(next) => { if (!next) onClose() }}>
          <MobileSheetNav title="Feedback" cancelLabel="Fechar" />
          {feedback ? (
            <div className="tv-fb-detail is-sheet">
              <FeedbackBody feedback={feedback} showDate onOpenPhoto={setViewerIndex} onImageError={onImageError} />
              {actions}
            </div>
          ) : null}
        </MobileSheet>
      ) : (
        <Dialog open={open} onOpenChange={(next) => { if (!next && !marking) onClose() }} disablePointerDismissal={marking}>
          <DialogContent className="tv-fb-dialog" showCloseButton={!marking}>
            <DialogHeader>
              <DialogTitle>Feedback</DialogTitle>
              {feedback ? <DialogDescription>{fullDateTime(feedback.publishedAt)}</DialogDescription> : null}
            </DialogHeader>
            {feedback ? (
              <div className="tv-fb-detail">
                <FeedbackBody feedback={feedback} showDate={false} onOpenPhoto={setViewerIndex} onImageError={onImageError} />
                {actions}
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      )}
      {feedback && viewerIndex !== null ? (
        <PhotoViewer photos={feedback.photos} index={viewerIndex} onClose={() => setViewerIndex(null)} />
      ) : null}
    </>
  )
}
