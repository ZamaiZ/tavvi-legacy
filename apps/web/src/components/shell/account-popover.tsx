'use client'

import { useRef, useState } from 'react'
import { LuBell, LuChevronRight, LuLogOut, LuMonitorSmartphone } from 'react-icons/lu'
import { PwaInstallAction } from '@/components/pwa/pwa-install-action'
import { SpinnerRing } from '@/components/ui/spinner'
import { PanelConfirm } from '@/features/workspace/components/panel-confirm'
import { NotificationList } from '@/features/notifications/components/notification-list'
import { UnreadBadge } from '@/features/notifications/components/unread-badge'
import { useOptionalNotifications } from '@/features/notifications/notifications-provider'
import { AccountNameAction } from './account-name-action'
import { accountInitial, signOutEverywhereCopy, ThemeSegment, useAccountDialogKeys, useSignOut, useSignOutEverywhere } from './account-panel'

// Popover de conta da sidebar (handoff Notificacoes Premium): fixo acima do
// botão de conta, sem escurecer a tela. Clicar fora ou Esc fecha. Grupos no
// estilo iOS: Nome e Tema; Notificações (e Instalar app, quando dá). "Sair
// de todos os aparelhos" só existe no console (desvio do handoff, decidido
// em 2026-10-01) e confirma com o alerta compacto do README §6.5, na escala
// do popover.
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
  // Nulo na escolha de restaurante (TavviShell), que não tem central.
  const notifications = useOptionalNotifications()
  const [centerOpen, setCenterOpen] = useState(false)
  // Sem nome, o e-mail sobe para o título e não se repete embaixo.
  const [shownName, setShownName] = useState(name?.trim() || null)

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
            <strong>{shownName ?? email ?? 'Conta'}</strong>
            {shownName && email ? <span>{email}</span> : null}
            <small>{description ?? 'Administrador da plataforma'}</small>
          </span>
        </div>
        <div className="tv-account-group">
          <AccountNameAction variant="popover" name={name} disabled={busy} onSaved={setShownName} />
          <span className="tv-account-hairline" aria-hidden="true" />
          <div className="tv-account-theme">
            <span className="tv-account-label">Tema</span>
            <ThemeSegment className="tv-theme-segment" />
          </div>
        </div>
        <div className="tv-account-group">
          {notifications ? (
            <>
              <button
                type="button"
                className="tv-account-row"
                aria-expanded={centerOpen}
                aria-controls="tv-notif-panel"
                onClick={() => setCenterOpen((open) => !open)}
              >
                <span className="tv-account-tile" aria-hidden="true"><LuBell /></span>
                <span className="tv-account-row-label">Notificações</span>
                <UnreadBadge count={notifications.unreadCount} />
                <LuChevronRight className="tv-account-chevron" aria-hidden="true" />
              </button>
              {/* A central abre ao lado do popover e mora DENTRO dele, logo
                  depois da linha que a abre: o Tab segue dela para a central
                  e continua preso no diálogo, e clicar fora fecha os dois.
                  Ela é absoluta em relação ao popover: não mexe no grupo. */}
              {centerOpen ? (
                <section id="tv-notif-panel" className="tv-notif-panel" aria-label="Notificações">
                  <NotificationList variant="panel" onNavigate={onClose} />
                </section>
              ) : null}
            </>
          ) : null}
          <PwaInstallAction variant="popover" />
        </div>
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
