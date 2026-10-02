'use client'

import { RiCrosshair2Line } from 'react-icons/ri'

// O ponto que não pode sair do quadro no feed vertical. Controlado: só vale
// ao salvar o item, como todo o resto do formulário.
export function FocalPicker({
  previewUrl,
  focalX,
  focalY,
  disabled,
  onChange,
}: {
  previewUrl: string
  focalX: number
  focalY: number
  disabled: boolean
  onChange: (x: number, y: number) => void
}) {
  function mark(event: React.MouseEvent<HTMLButtonElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width))
    const y = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height))
    // Três casas: o suficiente para o olho, e o "mudou?" não oscila por ruído.
    onChange(Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000)
  }

  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 rounded-xl border border-border bg-popover p-3 sm:grid-cols-[104px_minmax(0,1fr)]">
      <button
        type="button"
        onClick={mark}
        disabled={disabled}
        aria-label="Marcar o ponto de enquadramento"
        className="relative block aspect-[9/16] w-full overflow-hidden rounded-lg border border-border bg-muted outline-none transition-opacity disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt=""
          className="h-full w-full object-cover"
          style={{ objectPosition: `${focalX * 100}% ${focalY * 100}%` }}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-white drop-shadow-[0_0_3px_rgba(0,0,0,0.9)]"
          style={{ left: `${focalX * 100}%`, top: `${focalY * 100}%` }}
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
        <p className="mt-2 text-[0.6875rem] font-medium text-muted-foreground">O ajuste vale ao salvar o item.</p>
      </div>
    </div>
  )
}
