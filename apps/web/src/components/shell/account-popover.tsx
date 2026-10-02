'use client'

import { useRef, useState } from 'react'
import { LuLogOut, LuMonitorSmartphone } from 'react-icons/lu'
import { PwaInstallAction } from '@/components/pwa/pwa-install-action'
import { SpinnerRing } from '@/components/ui/spinner'
import { PwaNotificationsAction } from '@/components/pwa/pwa-notifications-action'
import { PanelConfirm } from '@/features/workspace/components/panel-confirm'
import { AccountNameAction } from './account-name-action'
import { accountInitial, signOutEverywhereCopy, ThemeSegment, useAccountDialogKeys, useSignOut, useSignOutEverywhere } from './account-panel'

// Popover de conta da sidebar (Tavvi Web.dc.html): fixo acima do botão de
// conta, sem escurecer a tela. Clicar fora ou Esc fecha. "Sair de todos os
// aparelhos" só existe no console (desvio do handoff, decidido em 2026-10-01)
// e confirma com o alerta compacto do README §6.5, na escala do popover.
export function AccountPopover({ email, name, description, signOutEverywhere = false, onClose }: {
  email: string | null
  name: string | null
  description: string | null
  /** Só no console: também desliga a digital do app em todos os celulares. */
  signOutEverywhere?: boolean
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [confirmAll, setConfirmAll] = useState(false)
  const { pending, signOut } = useSignOut()
  const everywhere = useSignOutEverywhere(() => setConfirmAll(false))
  const busy = pending || everywhere.pending
  useAccountDialogKeys(ref, onClose)

  return (
    <>
      {/* Com a confirmação aberta, o clique fora é dela: sem o catcher, um
          clique no alerta não fecha o popover por baixo. */}
      {confirmAll ? null : <div className="tv-popover-catcher" aria-hidden="true" onMouseDown={onClose} />}
      {/* Com a confirmação aberta, o popover desce para baixo do fundo dela
          e fica inerte: sem isso ele ficaria claro e clicável por cima. */}
      <div ref={ref} role="dialog" aria-label="Conta" className={confirmAll ? 'tv-account-popover is-under-confirm' : 'tv-account-popover'} inert={confirmAll}>
        <div className="tv-account-head">
          <span className="tv-account-avatar" aria-hidden="true">{accountInitial(email)}</span>
          <span className="tv-account-user">
            <strong>{email ?? 'Conta'}</strong>
            <small>{description ?? 'Administrador da plataforma'}</small>
          </span>
        </div>
        <AccountNameAction variant="popover" name={name} disabled={busy} />
        <div className="tv-account-section">
          <span className="tv-account-label">Tema</span>
          <ThemeSegment className="tv-theme-segment" />
        </div>
        <PwaInstallAction variant="popover" />
        <PwaNotificationsAction variant="popover" />
        <hr className="tv-account-divider" />
        <button type="button" disabled={busy} className="tv-signout-button" onClick={signOut}>
          {pending ? <SpinnerRing decorative /> : <LuLogOut aria-hidden="true" />}
          <span>{pending ? 'Saindo…' : 'Sair'}</span>
        </button>
        {signOutEverywhere ? (
          <button type="button" disabled={busy} className="tv-signout-button" onClick={() => setConfirmAll(true)}>
            <LuMonitorSmartphone aria-hidden="true" />
            <span>Sair de todos os aparelhos</span>
          </button>
        ) : null}
      </div>
      {signOutEverywhere ? (
        <PanelConfirm
          open={confirmAll}
          onOpenChange={setConfirmAll}
          icon={<LuMonitorSmartphone />}
          title={signOutEverywhereCopy.title}
          description={signOutEverywhereCopy.description}
          confirmLabel={signOutEverywhereCopy.confirmLabel}
          pendingLabel={signOutEverywhereCopy.pendingLabel}
          destructive
          pending={everywhere.pending}
          onConfirm={everywhere.signOutEverywhere}
        />
      ) : null}
    </>
  )
}
