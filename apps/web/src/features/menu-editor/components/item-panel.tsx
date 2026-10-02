'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { LuX } from 'react-icons/lu'

type PanelGuard = { busy: boolean; canClose: () => boolean }

const ItemPanelContext = createContext<{ setGuard: (guard: PanelGuard | null) => void } | null>(null)

// O conteúdo do painel diz se pode fechar. `busy`: uma gravação está
// rodando, e nada fecha (X, Esc, scrim, alça). `canClose`: devolve `false`
// para abrir a própria confirmação de descarte.
export function useItemPanelGuard(busy: boolean, canClose: () => boolean) {
  const context = useContext(ItemPanelContext)
  const latest = useRef(canClose)
  useEffect(() => {
    latest.current = canClose
  })
  useEffect(() => {
    context?.setGuard({ busy, canClose: () => latest.current() })
    return () => context?.setGuard(null)
  }, [busy, context])
}

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
  const [guard, setGuard] = useState<PanelGuard | null>(null)
  const gripY = useRef<number | null>(null)
  const context = useMemo(() => ({ setGuard }), [])
  const busy = guard?.busy ?? false

  const requestClose = useCallback(() => {
    if (guard?.busy) return
    if (guard && !guard.canClose()) return
    onOpenChange(false)
  }, [guard, onOpenChange])

  return (
    <Dialog.Root
      open={open}
      disablePointerDismissal={busy}
      onOpenChange={(next) => {
        if (next) onOpenChange(true)
        else requestClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="tv-ipanel-scrim" />
        <Dialog.Popup className={`tv-ipanel${expanded ? ' is-expanded' : ''}`} aria-busy={busy || undefined}>
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
                else if (delta < -110) requestClose()
              }}
            >
              <span aria-hidden="true" />
              <button type="button" onClick={() => setExpanded((value) => !value)}>{expanded ? 'Reduzir' : 'Expandir'}</button>
            </div>
            <div className="tv-ipanel-titles">
              <Dialog.Title className="tv-ipanel-title">{title}</Dialog.Title>
              <Dialog.Description className="tv-ipanel-sub">{subtitle}</Dialog.Description>
            </div>
            <button type="button" className="tv-ipanel-close" aria-label="Fechar" disabled={busy} onClick={requestClose}>
              <LuX aria-hidden="true" />
            </button>
          </header>
          <ItemPanelContext.Provider value={context}>{children}</ItemPanelContext.Provider>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
