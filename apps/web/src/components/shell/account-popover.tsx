'use client'

import { useRef } from 'react'
import { LuLogOut } from 'react-icons/lu'
import { PwaInstallAction } from '@/components/pwa/pwa-install-action'
import { SpinnerRing } from '@/components/ui/spinner'
import { PwaNotificationsAction } from '@/components/pwa/pwa-notifications-action'
import { AccountNameAction } from './account-name-action'
import { accountInitial, ThemeSegment, useAccountDialogKeys, useSignOut } from './account-panel'

// Popover de conta da sidebar (Tavvi Web.dc.html): fixo acima do botão de
// conta, sem escurecer a tela. Clicar fora ou Esc fecha.
export function AccountPopover({ email, name, description, onClose }: {
  email: string | null
  name: string | null
  description: string | null
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { pending, signOut } = useSignOut()
  useAccountDialogKeys(ref, onClose)

  return (
    <>
      <div className="tv-popover-catcher" aria-hidden="true" onMouseDown={onClose} />
      <div ref={ref} role="dialog" aria-label="Conta" className="tv-account-popover">
        <div className="tv-account-head">
          <span className="tv-account-avatar" aria-hidden="true">{accountInitial(email)}</span>
          <span className="tv-account-user">
            <strong>{email ?? 'Conta'}</strong>
            <small>{description ?? 'Administrador da plataforma'}</small>
          </span>
        </div>
        <AccountNameAction variant="popover" name={name} disabled={pending} />
        <div className="tv-account-section">
          <span className="tv-account-label">Tema</span>
          <ThemeSegment className="tv-theme-segment" />
        </div>
        <PwaInstallAction variant="popover" />
        <PwaNotificationsAction variant="popover" />
        <hr className="tv-account-divider" />
        <button type="button" disabled={pending} className="tv-signout-button" onClick={signOut}>
          {pending ? <SpinnerRing decorative /> : <LuLogOut aria-hidden="true" />}
          <span>{pending ? 'Saindo…' : 'Sair'}</span>
        </button>
      </div>
    </>
  )
}
