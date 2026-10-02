'use client'

import { LuMail, LuMailOpen, LuPanelRightOpen, LuTrash2 } from 'react-icons/lu'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu'
import type { FeedbackDTO } from '@/domain/feedback'
import { fullDateTime, relativeTime } from '@/lib/relative-time'

// O cartão é o botão que abre o detalhe; o clique direito (desktop) só
// acrescenta os atalhos (spec de componentes §4.3).
export function FeedbackCard({
  feedback,
  onOpen,
  onToggleRead,
  onDelete,
  onImageError,
}: {
  feedback: FeedbackDTO
  onOpen: () => void
  onToggleRead: () => void
  onDelete: () => void
  onImageError: () => void
}) {
  const unread = !feedback.readAt
  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={<button type="button" className={`tv-fb-card${unread ? ' is-unread' : ''}`} onClick={onOpen} />}
      >
        <span className="tv-fb-card-head">
          {unread ? <span className="tv-fb-dot" aria-hidden="true" /> : null}
          <time dateTime={feedback.publishedAt} title={fullDateTime(feedback.publishedAt)} suppressHydrationWarning>
            {relativeTime(feedback.publishedAt)}
          </time>
          {unread ? <span className="sr-only">Não lido.</span> : null}
        </span>
        <span className="tv-fb-card-text">{feedback.body}</span>
        {feedback.photos.length > 0 ? (
          <span className="tv-fb-card-photos">
            {feedback.photos.map((photo) =>
              photo.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={photo.id} src={photo.url} alt="" loading="lazy" onError={onImageError} />
              ) : (
                <span key={photo.id} className="tv-fb-photo-missing" />
              ),
            )}
          </span>
        ) : null}
      </ContextMenuTrigger>
      <ContextMenuContent aria-label="Ações do feedback">
        <ContextMenuItem onClick={onOpen}>
          <LuPanelRightOpen aria-hidden="true" /><span>Abrir</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={onToggleRead}>
          {unread ? <LuMailOpen aria-hidden="true" /> : <LuMail aria-hidden="true" />}
          <span>{unread ? 'Marcar como lido' : 'Marcar como não lido'}</span>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={onDelete}>
          <LuTrash2 aria-hidden="true" /><span>Excluir</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
