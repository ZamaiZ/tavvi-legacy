'use client'

import { RiArrowDownSLine, RiArrowUpSLine } from 'react-icons/ri'
import { Button } from '@/components/ui/button'

export function ReorderButtons({
  label,
  isFirst,
  isLast,
  disabled,
  onUp,
  onDown,
}: {
  label: string
  isFirst: boolean
  isLast: boolean
  disabled?: boolean
  onUp: () => void
  onDown: () => void
}) {
  return (
    <div
      className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-border/70 bg-muted/20 p-0.5"
      role="group"
      aria-label={`Ordenar ${label}`}
    >
      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-sm disabled:opacity-25"
        disabled={disabled || isFirst}
        onClick={onUp}
        aria-label={`Mover ${label} para cima`}
      >
        <RiArrowUpSLine className="size-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-sm disabled:opacity-25"
        disabled={disabled || isLast}
        onClick={onDown}
        aria-label={`Mover ${label} para baixo`}
      >
        <RiArrowDownSLine className="size-4" />
      </Button>
    </div>
  )
}

