'use client'

import { useRef } from 'react'
import { LuLogOut } from 'react-icons/lu'
import { accountInitial, ThemeSegment, useAccountDialogKeys, useSignOut } from './account-panel'

// Popover de conta da sidebar (Tavvi Web.dc.html): fixo acima do botão de
// conta, sem escurecer a tela. Clicar fora ou Esc fecha.
export function AccountPopover({ email, description, onClose }: {
  email: string | null
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
        <div className="tv-account-section">
          <span className="tv-account-label">Tema</span>
          <ThemeSegment className="tv-theme-segment" />
        </div>
        <hr className="tv-account-divider" />
        <button type="button" disabled={pending} className="tv-signout-button" onClick={signOut}>
          {pending ? <span className="tv-spinner" aria-hidden="true" /> : <LuLogOut aria-hidden="true" />}
          <span>{pending ? 'Saindo…' : 'Sair'}</span>
        </button>
      </div>
    </>
  )
}
