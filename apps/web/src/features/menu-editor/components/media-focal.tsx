'use client'

import { useState, useTransition } from 'react'
import { RiCrosshair2Line } from 'react-icons/ri'
import { toast } from '@/components/ui/toast'
import type { OwnerMenuItemDTO } from '@/domain/menu'
import { publicMediaUrl } from '@/lib/media-url'
import { setMediaFocalAction } from '@/server/actions/media'

export function MediaFocal({
  media,
}: {
  media: OwnerMenuItemDTO['media'][number]
}) {
  const [point, setPoint] = useState({ x: media.focalX, y: media.focalY })
  const [pending, startTransition] = useTransition()

  const preview =
    media.kind === 'image'
      ? publicMediaUrl('image', media.storagePath)
      : media.posterPath
        ? publicMediaUrl('image', media.posterPath)
        : null

  if (!preview) return null

  function markFocalPoint(event: React.MouseEvent<HTMLButtonElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width))
    const y = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height))
    setPoint({ x, y })

    startTransition(async () => {
      const result = await setMediaFocalAction({
        mediaId: media.id,
        focalX: x,
        focalY: y,
      })
      if (result.ok) {
        toast.add({ title: 'Enquadramento salvo', type: 'success' })
      } else {
        setPoint({ x: media.focalX, y: media.focalY })
        toast.add({ title: result.error, type: 'error' })
      }
    })
  }

  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 rounded-xl border border-border bg-popover p-3 sm:grid-cols-[104px_minmax(0,1fr)]">
      <button
        type="button"
        onClick={markFocalPoint}
        disabled={pending}
        aria-label="Marcar o ponto de enquadramento"
        aria-busy={pending}
        className="relative block aspect-[9/16] w-full overflow-hidden rounded-lg border border-border bg-muted outline-none transition-opacity disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={preview}
          alt=""
          className="h-full w-full object-cover"
          style={{ objectPosition: `${point.x * 100}% ${point.y * 100}%` }}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-white drop-shadow-[0_0_3px_rgba(0,0,0,0.9)]"
          style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
        >
          <RiCrosshair2Line className="size-5" />
        </span>
      </button>

      <div className="min-w-0 self-center">
        <div className="flex items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <RiCrosshair2Line className="size-4" aria-hidden="true" />
          </span>
          <p className="text-sm font-semibold">Enquadramento</p>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Clique na miniatura para indicar o ponto que deve continuar visível no feed vertical.
        </p>
        <p className="mt-2 text-[0.6875rem] font-medium text-muted-foreground" aria-live="polite">
          {pending ? 'Salvando ponto…' : 'O ajuste é salvo automaticamente.'}
        </p>
      </div>
    </div>
  )
}
