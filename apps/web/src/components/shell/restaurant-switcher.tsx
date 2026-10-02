'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { LuCheck, LuStore } from 'react-icons/lu'
import { LinkPendingHint } from '@/components/ui/link-pending'
import type { RestaurantSwitchEntry } from './console-config'
import { RestaurantMark } from './restaurant-mark'

// Popover "Seus restaurantes" do bloco da marca, no mesmo estilo do popover
// de conta: fixo, sem escurecer a tela. Esc e clique fora fecham; as setas
// andam entre as linhas.
export function RestaurantSwitcher({
  restaurants,
  currentId,
  onClose,
}: {
  restaurants: RestaurantSwitchEntry[]
  currentId: string
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = ref.current
    root?.querySelector<HTMLElement>('[aria-current="true"]')?.focus()
    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
      const items = Array.from(root?.querySelectorAll<HTMLElement>('a') ?? [])
      if (items.length === 0) return
      event.preventDefault()
      const index = items.indexOf(document.activeElement as HTMLElement)
      const step = event.key === 'ArrowDown' ? 1 : -1
      items[(index + step + items.length) % items.length]?.focus()
    }
    document.addEventListener('keydown', keydown)
    return () => document.removeEventListener('keydown', keydown)
  }, [onClose])

  return (
    <>
      <div className="tv-popover-catcher" aria-hidden="true" onMouseDown={onClose} />
      <div ref={ref} role="dialog" aria-label="Seus restaurantes" className="tv-switch-popover">
        <span className="tv-switch-label">Seus restaurantes</span>
        {restaurants.map((entry) => (
          <Link
            key={entry.id}
            href={`/restaurantes/${entry.id}`}
            aria-current={entry.id === currentId ? 'true' : undefined}
            className="tv-switch-row"
            // O popover fica aberto mostrando o spinner até a casca do outro
            // restaurante montar; ela o substitui (a casca é por restaurante).
            onClick={entry.id === currentId ? onClose : undefined}
          >
            <RestaurantMark entry={entry} className="tv-switch-mark" />
            <span className="tv-switch-copy"><strong>{entry.name}</strong><small>{entry.roleLabel}</small></span>
            {entry.id === currentId ? <LuCheck aria-hidden="true" /> : null}
            {entry.id === currentId ? null : <LinkPendingHint className="tv-switch-pending" />}
          </Link>
        ))}
        <hr className="tv-switch-divider" />
        <Link href="/restaurantes" className="tv-switch-all" onClick={onClose}>
          <LuStore aria-hidden="true" />Ver todos os restaurantes
        </Link>
      </div>
    </>
  )
}
