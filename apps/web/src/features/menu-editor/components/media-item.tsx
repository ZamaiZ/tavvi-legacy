'use client'

import { RiDeleteBinLine, RiFilmLine } from 'react-icons/ri'
import { cn } from 'cn'
import { ReorderButtons } from '@/features/menu-editor/components/reorder-buttons'
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from '@/components/ui/attachment'
import { Progress } from '@/components/ui/progress'
import type { MediaStatus } from '@/lib/media/types'
import { formatFileSize } from '@/lib/format'

// O `state` do primitivo mapeia direto do nosso estado. É para isso que ele
// tem esse prop — e é aí que a classe `shimmer`, que a Fase 5 precisou
// definir à mão, finalmente aparece.
const ATTACHMENT_STATE: Record<
  MediaStatus,
  'idle' | 'uploading' | 'processing' | 'error' | 'done'
> = {
  pending: 'idle',
  compressing: 'processing',
  uploading: 'uploading',
  error: 'error',
  ready: 'done',
}

// Uma mídia da lista. Serve GRAVADA e PENDENTE, de propósito: no feed a
// ordem das duas é a mesma ordem de telas, e mostrá-las em listas separadas
// esconderia do dono exatamente o que o cliente vai ver primeiro.
export function MediaItem({
  title,
  description,
  previewUrl,
  kind,
  state,
  progress,
  mediaError,
  first,
  last,
  busy,
  onMoveUp,
  onMoveDown,
  onRemove,
  selected = false,
  onSelect,
}: {
  title: string
  description?: string
  /** `null` num vídeo sem capa: cai no ícone de filme. */
  previewUrl: string | null
  kind: 'image' | 'video'
  state: MediaStatus
  progress: number
  mediaError?: string
  first: boolean
  last: boolean
  busy: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
  selected?: boolean
  onSelect?: () => void
}) {
  return (
    <Attachment
      orientation="vertical"
      size="sm"
      state={ATTACHMENT_STATE[state]}
      className={cn(
        'w-[132px] rounded-xl transition-[border-color,box-shadow] duration-150',
        selected && 'border-primary ring-2 ring-primary/10',
      )}
    >
      {onSelect ? (
        <AttachmentTrigger
          aria-label={`Selecionar ${title} para ajustar o enquadramento`}
          aria-pressed={selected}
          onClick={onSelect}
          className="rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      ) : null}
      <AttachmentMedia variant={previewUrl ? 'image' : 'icon'}>
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="" />
        ) : (
          <RiFilmLine aria-hidden="true" />
        )}
      </AttachmentMedia>

      <AttachmentContent>
        {/* A primeira mídia é a tela que ABRE o prato no feed. Dizer isso é o
            que transforma "ordem" em decisão consciente. */}
        <AttachmentTitle className="text-xs">
          {first ? 'Abre o prato' : title}
        </AttachmentTitle>
        <AttachmentDescription className="text-[0.6875rem]">
          {mediaError ?? description ?? (kind === 'video' ? 'Vídeo' : 'Foto')}
        </AttachmentDescription>

        {state === 'uploading' || state === 'compressing' ? (
          <Progress value={progress} className="mt-2" />
        ) : null}
      </AttachmentContent>

      <AttachmentActions>
        <ReorderButtons
          label={title}
          isFirst={first}
          isLast={last}
          disabled={busy}
          onUp={onMoveUp}
          onDown={onMoveDown}
        />
        <AttachmentAction
          variant="destructive"
          aria-label={`Remover ${title}`}
          disabled={busy}
          onClick={onRemove}
        >
          <RiDeleteBinLine />
        </AttachmentAction>
      </AttachmentActions>
    </Attachment>
  )
}
