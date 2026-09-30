'use client'

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { LuX } from 'react-icons/lu'

// Drawer de detalhe do desktop (Tavvi Web.dc.html): fixo a 10 px das bordas,
// sem escurecer a página. Clicar fora ou Esc fecha; o foco volta para quem
// abriu. Com uma confirmação ou o diálogo de convite por cima, o Esc é deles.
export function DetailDrawer({ label, width, onClose, children }: {
  label: string
  width: 380 | 400
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    ref.current?.focus()
    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !document.querySelector('.tv-confirm-scrim, .tv-invite-sheet')) onCloseRef.current()
    }
    document.addEventListener('keydown', keydown)
    return () => {
      document.removeEventListener('keydown', keydown)
      previous?.focus()
    }
  }, [])

  return <>
    <div className="tv-drawer-catcher" aria-hidden="true" onMouseDown={onClose} />
    <aside ref={ref} role="dialog" aria-label={label} tabIndex={-1} className="tv-detail-drawer" style={{ '--tv-drawer-width': `${width}px` } as CSSProperties}>
      <header className="tv-drawer-head">
        <span>{label}</span>
        <button type="button" className="tv-drawer-close" aria-label="Fechar" onClick={onClose}><LuX aria-hidden="true" /></button>
      </header>
      <div className="tv-drawer-body">{children}</div>
    </aside>
  </>
}
