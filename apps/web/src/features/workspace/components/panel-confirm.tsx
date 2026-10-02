'use client'

import type { ReactNode } from 'react'
import { AlertDialog } from '@base-ui/react/alert-dialog'
import { SpinnerRing } from '@/components/ui/spinner'
import { useTerritoryContainer } from './use-territory-container'

// Confirmação do painel (README §6.5): 320 px, ícone em círculo e dois botões
// iguais. O Base UI cuida do foco, do Esc e do clique fora.
//
// Dois modos. Sem `pending` (descartar um rascunho, coisa local e
// instantânea), o confirmar fecha na hora. Com `pending` definido, quem chama
// controla: o alerta fica aberto com o progresso, nada o fecha enquanto a
// ação roda, e quem chama fecha ao terminar — como o TeamConfirmDialog.
export function PanelConfirm({
  open,
  onOpenChange,
  icon,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancelar',
  destructive = false,
  pending,
  pendingLabel,
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
  pending?: boolean
  pendingLabel?: string
  onConfirm: () => void
}) {
  // No território, o alerta herda os tokens do celular (fundo e tons
  // escuros) e fica acima dos sheets, que também são portados ali.
  const container = useTerritoryContainer()
  const managed = pending !== undefined
  return (
    <AlertDialog.Root open={open} onOpenChange={(next) => { if (!pending) onOpenChange(next) }}>
      <AlertDialog.Portal container={container}>
        <AlertDialog.Backdrop className="tv-pconfirm-scrim" />
        <AlertDialog.Popup className={`tv-pconfirm${destructive ? ' is-destructive' : ''}`} aria-busy={pending || undefined}>
          <span className="tv-pconfirm-icon" aria-hidden="true">{icon}</span>
          <AlertDialog.Title className="tv-pconfirm-title">{title}</AlertDialog.Title>
          <AlertDialog.Description className="tv-pconfirm-text">{description}</AlertDialog.Description>
          <div className="tv-pconfirm-actions">
            <AlertDialog.Close className="tv-pconfirm-cancel" disabled={pending}>{cancelLabel}</AlertDialog.Close>
            <button
              type="button"
              className="tv-pconfirm-confirm"
              disabled={pending}
              aria-busy={pending || undefined}
              onClick={() => {
                if (!managed) onOpenChange(false)
                onConfirm()
              }}
            >
              {pending ? <SpinnerRing decorative className="tv-pconfirm-spinner" /> : null}
              {pending ? (pendingLabel ?? confirmLabel) : confirmLabel}
            </button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
