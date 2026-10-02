'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { LuBell, LuChevronRight, LuCircleUserRound, LuLogOut, LuSettings } from 'react-icons/lu'
import { PwaInstallAction } from '@/components/pwa/pwa-install-action'
import { SpinnerRing } from '@/components/ui/spinner'
import { NotificationList } from '@/features/notifications/components/notification-list'
import { UnreadBadge } from '@/features/notifications/components/unread-badge'
import { useOptionalNotifications } from '@/features/notifications/notifications-provider'
import { accountInitial, ThemeSegment, useAccountDialogKeys, useSignOut } from './account-panel'

export function AccountPopover({ email, name, description, profileHref, settingsHref, onClose, onNavigate }: {
  email: string | null
  name: string | null
  description: string | null
  profileHref: string
  settingsHref: string
  onClose: () => void
  onNavigate: (href?: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { pending, signOut } = useSignOut()
  useAccountDialogKeys(ref, onClose)
  const notifications = useOptionalNotifications()
  const [centerOpen, setCenterOpen] = useState(false)
  const shownName = name?.trim() || null

  return <>
    <div className="tv-popover-catcher" aria-hidden="true" onMouseDown={onClose} />
    <div ref={ref} role="dialog" aria-label="Conta" className="tv-account-popover">
      <div className="tv-account-head">
        <span className="tv-account-avatar" aria-hidden="true">{accountInitial(email)}</span>
        <span className="tv-account-user">
          <strong>{shownName ?? email ?? 'Conta'}</strong>
          {shownName && email ? <span>{email}</span> : null}
          <small>{description ?? 'Administrador da plataforma'}</small>
        </span>
      </div>
      <div className="tv-account-group">
        <Link href={profileHref} className="tv-account-row" onClick={() => onNavigate(profileHref)}>
          <span className="tv-account-tile is-neutral" aria-hidden="true"><LuCircleUserRound /></span>
          <span className="tv-account-row-label">Perfil</span>
          <LuChevronRight className="tv-account-chevron" aria-hidden="true" />
        </Link>
        <span className="tv-account-hairline is-inset" aria-hidden="true" />
        <Link href={settingsHref} className="tv-account-row" onClick={() => onNavigate(settingsHref)}>
          <span className="tv-account-tile is-neutral" aria-hidden="true"><LuSettings /></span>
          <span className="tv-account-row-label">Configurações</span>
          <LuChevronRight className="tv-account-chevron" aria-hidden="true" />
        </Link>
        <PwaInstallAction variant="popover" />
      </div>
      <div className="tv-account-group">
        {notifications ? <>
          <button type="button" className="tv-account-row" aria-expanded={centerOpen} aria-controls="tv-notif-panel" onClick={() => setCenterOpen((open) => !open)}>
            <span className="tv-account-tile" aria-hidden="true"><LuBell /></span>
            <span className="tv-account-row-label">Notificações</span>
            <UnreadBadge count={notifications.unreadCount} />
            <LuChevronRight className="tv-account-chevron" aria-hidden="true" />
          </button>
          {centerOpen ? <section id="tv-notif-panel" className="tv-notif-panel" aria-label="Notificações"><NotificationList variant="panel" /></section> : null}
          <span className="tv-account-hairline" aria-hidden="true" />
        </> : null}
        <div className="tv-account-theme">
          <span className="tv-account-label">Tema</span>
          <ThemeSegment className="tv-theme-segment" />
        </div>
      </div>
      <button type="button" disabled={pending} className="tv-signout-button" onClick={signOut}>
        {pending ? <SpinnerRing decorative /> : <LuLogOut aria-hidden="true" />}
        <span>{pending ? 'Saindo…' : 'Sair'}</span>
      </button>
    </div>
  </>
}
