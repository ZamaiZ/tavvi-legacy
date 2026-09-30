'use client'

import type { ReactNode } from 'react'
import { AlertDialog } from '@base-ui/react/alert-dialog'
import { useTerritoryContainer } from './use-territory-container'

// Confirmação destrutiva da Equipe, no padrão do README §6.5: 320 px, ícone
// em círculo, dois botões iguais. Controlada por quem chama, para a ação
// mostrar o progresso e só fechar quando o servidor responder.
export function TeamConfirmDialog({
  open,
  onOpenChange,
  icon,
  title,
  description,
  confirmLabel,
  pending = false,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  icon: ReactNode
  title: string
  description: string
  confirmLabel: string
  pending?: boolean
  onConfirm: () => void
}) {
  const container = useTerritoryContainer()

  return (
    <AlertDialog.Root
      open={open}
      // Com a ação em andamento, Esc não fecha: fechar esconderia o
      // resultado, e a pessoa não saberia se removeu ou não.
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next)
      }}
    >
      <AlertDialog.Portal container={container}>
        <AlertDialog.Backdrop className="tv-team-scrim is-confirm" />
        <AlertDialog.Popup className="tv-team-confirm">
          <span className="tv-team-confirm-icon" aria-hidden="true">
            {icon}
          </span>
          <AlertDialog.Title>{title}</AlertDialog.Title>
          <AlertDialog.Description>{description}</AlertDialog.Description>
          <div className="tv-team-confirm-actions">
            <AlertDialog.Close
              className="tv-team-confirm-cancel"
              disabled={pending}
            >
              Cancelar
            </AlertDialog.Close>
            <button
              type="button"
              className="tv-team-confirm-action"
              disabled={pending}
              aria-busy={pending}
              onClick={onConfirm}
            >
              {pending ? (
                <>
                  <span className="tv-spinner" aria-hidden="true" />
                  <span className="sr-only">{confirmLabel}</span>
                </>
              ) : (
                confirmLabel
              )}
            </button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
