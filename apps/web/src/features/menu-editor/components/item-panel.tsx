'use client'

import { useRef, useState, type ReactNode } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { LuX } from 'react-icons/lu'

// Painel lateral do item (README §7.5, "Editar item"): 520 px, raio 18, 10 px
// das bordas, com scrim. Abaixo de 640 px vira sheet de baixo, com alça para
// expandir e reduzir.
export function ItemPanel({
  open,
  onOpenChange,
  title,
  subtitle,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  subtitle: string
  children: ReactNode
}) {
  const [expanded, setExpanded] = useState(false)
  const gripY = useRef<number | null>(null)

  return (
    <Dialog.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <Dialog.Portal>
        <Dialog.Backdrop className="tv-ipanel-scrim" />
        <Dialog.Popup className={`tv-ipanel${expanded ? ' is-expanded' : ''}`}>
          <header className="tv-ipanel-head">
            <div
              className="tv-sheet-grip"
              onTouchStart={(event) => { gripY.current = event.touches[0]?.clientY ?? null }}
              onTouchEnd={(event) => {
                const start = gripY.current
                gripY.current = null
                if (start === null) return
                const delta = start - event.changedTouches[0].clientY
                if (delta > 70) setExpanded(true)
                else if (delta < -110) onOpenChange(false)
              }}
            >
              <span aria-hidden="true" />
              <button type="button" onClick={() => setExpanded((value) => !value)}>{expanded ? 'Reduzir' : 'Expandir'}</button>
            </div>
            <div className="tv-ipanel-titles">
              <Dialog.Title className="tv-ipanel-title">{title}</Dialog.Title>
              <Dialog.Description className="tv-ipanel-sub">{subtitle}</Dialog.Description>
            </div>
            <Dialog.Close className="tv-ipanel-close" aria-label="Fechar"><LuX aria-hidden="true" /></Dialog.Close>
          </header>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
