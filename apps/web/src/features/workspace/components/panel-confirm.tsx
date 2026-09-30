'use client'

import type { ReactNode } from 'react'
import { AlertDialog } from '@base-ui/react/alert-dialog'
import { useTerritoryContainer } from './use-territory-container'

// Confirmação do painel (README §6.5): 320 px, ícone em círculo e dois botões
// iguais. O Base UI cuida do foco, do Esc e do clique fora.
export function PanelConfirm({
  open,
  onOpenChange,
  icon,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancelar',
  destructive = false,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  icon: ReactNode
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
}) {
  // No território, o alerta herda os tokens do celular (fundo e tons
  // escuros) e fica acima dos sheets, que também são portados ali.
  const container = useTerritoryContainer()
  return (
    <AlertDialog.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <AlertDialog.Portal container={container}>
        <AlertDialog.Backdrop className="tv-pconfirm-scrim" />
        <AlertDialog.Popup className={`tv-pconfirm${destructive ? ' is-destructive' : ''}`}>
          <span className="tv-pconfirm-icon" aria-hidden="true">{icon}</span>
          <AlertDialog.Title className="tv-pconfirm-title">{title}</AlertDialog.Title>
          <AlertDialog.Description className="tv-pconfirm-text">{description}</AlertDialog.Description>
          <div className="tv-pconfirm-actions">
            <AlertDialog.Close className="tv-pconfirm-cancel">{cancelLabel}</AlertDialog.Close>
            <button
              type="button"
              className="tv-pconfirm-confirm"
              onClick={() => {
                onOpenChange(false)
                onConfirm()
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
