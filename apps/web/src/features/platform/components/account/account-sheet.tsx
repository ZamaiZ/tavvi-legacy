'use client'

import { useEffect, useRef, useState } from 'react'
import { LuLogOut, LuMonitorSmartphone } from 'react-icons/lu'
import { AccountNameAction } from '@/components/shell/account-name-action'
import { accountInitial, signOutEverywhereCopy, ThemeSegment, useAccountDialogKeys, useSignOut, useSignOutEverywhere } from '@/components/shell/account-panel'
import { useConsoleAccount } from '@/components/shell/console-shell'
import { PwaInstallAction } from '@/components/pwa/pwa-install-action'
import { PwaNotificationsAction } from '@/components/pwa/pwa-notifications-action'
import { ConfirmDialog } from '../confirm-dialog'

// Aba Conta do celular: sheet com Nome, Tema, Instalar app e Notificações
// (quando der), Sair e Sair de todos os aparelhos, sem trocar de tela. O
// desktop usa o popover da sidebar.
export function ConsoleAccountSheet() {
  const { open, email, name, description, onClose } = useConsoleAccount()
  if (!open) return null
  return <AccountSheet email={email} name={name} description={description ?? 'Administrador da plataforma'} onClose={onClose} />
}

function AccountSheet({ email, name, description, onClose }: { email: string | null; name: string | null; description: string; onClose: () => void }) {
  const ref = useRef<HTMLElement>(null)
  const [confirm, setConfirm] = useState<'signOut' | 'everywhere' | null>(null)
  const { pending, signOut } = useSignOut()
  const everywhere = useSignOutEverywhere(() => setConfirm(null))
  const busy = pending || everywhere.pending
  useAccountDialogKeys(ref, onClose)

  // O sheet só existe abaixo de 768 px; se a janela crescer, ele fecha.
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 768px)')
    const close = () => { if (desktop.matches) onClose() }
    desktop.addEventListener('change', close)
    return () => desktop.removeEventListener('change', close)
  }, [onClose])

  return (
    <>
      <button type="button" className="tv-sheet-scrim" aria-label="Fechar conta" onClick={onClose} />
      <section ref={ref} role="dialog" aria-modal="true" aria-label="Conta" className="tv-account-sheet">
        <span className="tv-sheet-m-handle" aria-hidden="true" />
        <div className="tv-account-sheet-profile">
          <span className="tv-account-sheet-avatar" aria-hidden="true">{accountInitial(email)}</span>
          <span className="tv-account-sheet-copy"><strong>{email ?? 'Conta'}</strong><small>{description}</small></span>
        </div>
        <AccountNameAction variant="row" name={name} className="is-spaced" disabled={busy} />
        <h2 className="tv-group-label">Aparência</h2>
        <div className="tv-group"><ThemeSegment className="tv-account-segment" /></div>
        <PwaInstallAction variant="row" className="is-spaced" />
        <PwaNotificationsAction variant="row" className="is-spaced" />
        <div className="tv-group is-spaced">
          <button type="button" className="tv-group-danger" disabled={busy} onClick={() => setConfirm('signOut')}>
            <LuLogOut aria-hidden="true" />{pending ? 'Saindo…' : 'Sair'}
          </button>
          <button type="button" className="tv-group-danger" disabled={busy} onClick={() => setConfirm('everywhere')}>
            <LuMonitorSmartphone aria-hidden="true" />{everywhere.pending ? 'Saindo de todos…' : 'Sair de todos os aparelhos'}
          </button>
        </div>
      </section>
      {confirm === 'signOut' ? (
        <ConfirmDialog
          title="Sair da conta?"
          description="Você precisará entrar novamente para acessar o console."
          confirmLabel="Sair da conta"
          pendingLabel="Saindo…"
          icon={<LuLogOut />}
          destructive
          pending={pending}
          onCancel={() => setConfirm(null)}
          onConfirm={signOut}
        />
      ) : null}
      {confirm === 'everywhere' ? (
        <ConfirmDialog
          title={signOutEverywhereCopy.title}
          description={signOutEverywhereCopy.description}
          confirmLabel={signOutEverywhereCopy.confirmLabel}
          pendingLabel={signOutEverywhereCopy.pendingLabel}
          icon={<LuMonitorSmartphone />}
          destructive
          pending={everywhere.pending}
          onCancel={() => setConfirm(null)}
          onConfirm={everywhere.signOutEverywhere}
        />
      ) : null}
    </>
  )
}
