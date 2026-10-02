'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { SpinnerRing } from '@/components/ui/spinner'

// Confirmação única do console. No desktop é o diálogo de sempre; no celular
// o console-mobile.css o transforma no alerta do iOS. Com `pending`, Cancelar
// e Esc ficam travados: fechar esconderia se a ação deu certo.
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  pendingLabel,
  cancelLabel = 'Cancelar',
  icon,
  iconTone,
  destructive = false,
  pending = false,
  onCancel,
  onConfirm,
}: {
  title: string
  description: string
  confirmLabel: string
  /** Texto do botão durante a ação ("Revogando…"). */
  pendingLabel?: string
  cancelLabel?: string
  icon: ReactNode
  iconTone?: 'danger' | 'accent'
  destructive?: boolean
  pending?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const id = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)
  const onCancelRef = useRef(onCancel)
  const pendingRef = useRef(pending)
  useEffect(() => {
    onCancelRef.current = onCancel
    pendingRef.current = pending
  })
  useEffect(() => {
    cancelRef.current?.focus()
    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !pendingRef.current) onCancelRef.current()
    }
    document.addEventListener('keydown', keydown)
    return () => document.removeEventListener('keydown', keydown)
  }, [])
  const tone = iconTone ?? (destructive ? 'danger' : 'accent')
  return (
    <div className="tv-confirm-scrim">
      <section role="alertdialog" aria-modal="true" aria-busy={pending || undefined} aria-labelledby={`${id}-title`} aria-describedby={`${id}-text`} className={`tv-confirm-dialog${destructive ? ' is-destructive' : ''}`}>
        <span className={`tv-state-icon${tone === 'danger' ? ' is-danger' : ''}`} aria-hidden="true">{icon}</span>
        <h2 id={`${id}-title`}>{title}</h2>
        <p id={`${id}-text`}>{description}</p>
        <div>
          <button ref={cancelRef} type="button" className="tv-secondary-cta" disabled={pending} onClick={onCancel}>{cancelLabel}</button>
          <button type="button" className="tv-tonal-button" disabled={pending} aria-busy={pending || undefined} onClick={onConfirm}>
            {pending ? <SpinnerRing decorative className="tv-confirm-spinner" /> : null}
            {pending ? (pendingLabel ?? confirmLabel) : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}
