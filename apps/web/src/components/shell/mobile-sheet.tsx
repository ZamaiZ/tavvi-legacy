'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { LuChevronLeft } from 'react-icons/lu'
import { useTerritoryContainer } from '@/features/workspace/components/use-territory-container'

export type MobileSheetAction = {
  label: string
  /** Id do formulário que a ação envia. Sem ele, usa `onClick`. */
  form?: string
  onClick?: () => void
  disabled?: boolean
  pending?: boolean
}

type MobileSheetContextValue = {
  /** Fecha passando pela guarda (descartar mídia, link não copiado). */
  requestClose: () => void
  /** Fecha sem perguntar: depois de salvar ou de confirmar o descarte. */
  forceClose: () => void
  setBack: (back: (() => void) | null) => void
  setGuard: (guard: (() => boolean) | null) => void
}

const MobileSheetContext = createContext<MobileSheetContextValue | null>(null)

export function useMobileSheet() {
  const context = useContext(MobileSheetContext)
  if (!context) throw new Error('useMobileSheet precisa estar dentro de MobileSheet')
  return context
}

// Guarda de fechamento: devolver `false` mantém o sheet aberto (quem chama
// abre a própria confirmação). Vale para Esc, toque fora, alça e "Cancelar".
export function useSheetGuard(guard: () => boolean) {
  const { setGuard } = useMobileSheet()
  const latest = useRef(guard)
  useEffect(() => {
    latest.current = guard
  })
  useEffect(() => {
    setGuard(() => latest.current())
    return () => setGuard(null)
  }, [setGuard])
}

// Sheet do iOS (Tavvi Mobile.dc.html, bloco bEdit): alça, barra
// "Cancelar · título · ação" fixa no topo e o corpo em grupos, que rola por
// baixo dela. O corpo só monta com o sheet aberto, então o estado dele
// recomeça a cada abertura. Numa subtela (MobileSheetNav com `back`), Esc e
// a alça voltam um nível.
export function MobileSheet({
  open,
  onOpenChange,
  detent = 'page',
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  detent?: 'page' | 'content'
  children: ReactNode
}) {
  const container = useTerritoryContainer()
  const backRef = useRef<(() => void) | null>(null)
  const guardRef = useRef<(() => boolean) | null>(null)
  const dragStart = useRef<number | null>(null)

  const forceClose = useCallback(() => onOpenChange(false), [onOpenChange])
  const requestClose = useCallback(() => {
    if (guardRef.current && !guardRef.current()) return
    onOpenChange(false)
  }, [onOpenChange])
  const context = useMemo<MobileSheetContextValue>(() => ({
    requestClose,
    forceClose,
    setBack: (back) => { backRef.current = back },
    setGuard: (guard) => { guardRef.current = guard },
  }), [forceClose, requestClose])

  // O sheet só existe no celular: se a janela crescer, ele fecha.
  useEffect(() => {
    if (!open) return
    const desktop = window.matchMedia('(min-width: 768px)')
    const close = () => { if (desktop.matches) forceClose() }
    desktop.addEventListener('change', close)
    return () => desktop.removeEventListener('change', close)
  }, [open, forceClose])

  function dismissOneLevel() {
    if (backRef.current) backRef.current()
    else requestClose()
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next, details) => {
        if (next) {
          onOpenChange(true)
          return
        }
        if (details.reason === 'escape-key') {
          dismissOneLevel()
          return
        }
        requestClose()
      }}
    >
      <Dialog.Portal container={container}>
        <Dialog.Backdrop className="tv-msheet-scrim" />
        {/* Nenhum campo ganha foco ao abrir: o teclado só sobe quando a
            pessoa toca num campo. */}
        <Dialog.Popup className={`tv-msheet${detent === 'content' ? ' is-content' : ''}`}>
          <div
            className="tv-msheet-grip"
            aria-hidden="true"
            onTouchStart={(event) => { dragStart.current = event.touches[0]?.clientY ?? null }}
            onTouchEnd={(event) => {
              const start = dragStart.current
              dragStart.current = null
              if (start !== null && event.changedTouches[0].clientY - start > 110) dismissOneLevel()
            }}
          >
            <span />
          </div>
          {/* Só o corpo rola; a alça fica fora dele e a barra do título
              (primeiro filho) gruda no topo do corpo. */}
          <div className="tv-msheet-body">
            <MobileSheetContext.Provider value={context}>{children}</MobileSheetContext.Provider>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// Barra do sheet: "Cancelar" (ou "‹ Anterior" numa subtela), o título
// centralizado e a ação em dourado.
export function MobileSheetNav({
  title,
  cancelLabel = 'Cancelar',
  action,
  back,
}: {
  title: string
  cancelLabel?: string
  action?: MobileSheetAction
  back?: { label: string; onBack: () => void }
}) {
  const { requestClose, setBack } = useMobileSheet()
  const onBack = back?.onBack
  useEffect(() => {
    setBack(onBack ?? null)
    return () => setBack(null)
  }, [onBack, setBack])

  return (
    <div className="tv-msheet-nav">
      {back ? (
        <button type="button" className="tv-msheet-back" onClick={back.onBack}>
          <LuChevronLeft aria-hidden="true" />{back.label}
        </button>
      ) : (
        <button type="button" className="tv-msheet-cancel" onClick={requestClose}>{cancelLabel}</button>
      )}
      <Dialog.Title className="tv-msheet-title">{title}</Dialog.Title>
      {action ? (
        <button
          type={action.form ? 'submit' : 'button'}
          form={action.form}
          className="tv-msheet-action"
          disabled={action.disabled || action.pending}
          aria-busy={action.pending || undefined}
          onClick={action.onClick}
        >
          {action.pending ? <span className="tv-spinner" aria-label="Enviando" /> : action.label}
        </button>
      ) : null}
    </div>
  )
}
