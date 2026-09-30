'use client'

import { LuChevronDown, LuChevronLeft, LuChevronRight, LuChevronUp } from 'react-icons/lu'

// Setas de ordem: só aparecem com "Ordenar" ligado. 26×26, borda line2.
export function ReorderButtons({
  label,
  isFirst,
  isLast,
  disabled = false,
  onUp,
  onDown,
  orientation = 'vertical',
}: {
  label: string
  isFirst: boolean
  isLast: boolean
  disabled?: boolean
  onUp: () => void
  onDown: () => void
  orientation?: 'vertical' | 'horizontal'
}) {
  const vertical = orientation === 'vertical'
  const Before = vertical ? LuChevronUp : LuChevronLeft
  const After = vertical ? LuChevronDown : LuChevronRight
  return (
    <div className="tv-reorder" role="group" aria-label={`Ordenar ${label}`}>
      <button type="button" className="tv-parrow" disabled={disabled || isFirst} onClick={onUp} aria-label={`Mover ${label} para ${vertical ? 'cima' : 'a esquerda'}`}>
        <Before aria-hidden="true" />
      </button>
      <button type="button" className="tv-parrow" disabled={disabled || isLast} onClick={onDown} aria-label={`Mover ${label} para ${vertical ? 'baixo' : 'a direita'}`}>
        <After aria-hidden="true" />
      </button>
    </div>
  )
}
