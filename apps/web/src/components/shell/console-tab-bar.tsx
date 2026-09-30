'use client'

import type { Ref } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LuCircleUserRound, LuMail, LuStore } from 'react-icons/lu'
import { toExternalPath } from '@/lib/route-paths'

const tabs = [
  { href: '/', match: ['/convites'], label: 'Convites', Icon: LuMail, badge: true },
  { href: '/restaurantes', match: [], label: 'Restaurantes', Icon: LuStore, badge: false },
] as const

function isActive(pathname: string, href: string, match: readonly string[]) {
  if (href === '/' && pathname === '/') return true
  return [href, ...match].some((prefix) => prefix !== '/' && (pathname === prefix || pathname.startsWith(`${prefix}/`)))
}

// Tab bar do console no celular, no padrão do iOS. Convites e Restaurantes
// navegam; Conta abre o sheet de conta sem trocar de tela.
export function ConsoleTabBar({ pendingCount, accountOpen, accountButtonRef, onAccount }: {
  pendingCount: number
  accountOpen: boolean
  accountButtonRef: Ref<HTMLButtonElement>
  onAccount: () => void
}) {
  const pathname = toExternalPath(usePathname())
  return (
    <nav className="tv-tabbar" aria-label="Navegação principal">
      {tabs.map(({ href, match, label, Icon, badge }) => {
        const active = isActive(pathname, href, match)
        const count = badge && pendingCount > 0 ? pendingCount : null
        return (
          <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={`tv-tabbar-item${active ? ' is-active' : ''}`}>
            <span className="tv-tabbar-icon">
              <Icon aria-hidden="true" />
              {count ? <span className="tv-tabbar-badge">{count > 99 ? '99+' : count}<span className="sr-only"> pendentes</span></span> : null}
            </span>
            <span>{label}</span>
          </Link>
        )
      })}
      <button ref={accountButtonRef} type="button" className="tv-tabbar-item" aria-haspopup="dialog" aria-expanded={accountOpen} onClick={onAccount}>
        <span className="tv-tabbar-icon"><LuCircleUserRound aria-hidden="true" /></span>
        <span>Conta</span>
      </button>
    </nav>
  )
}
