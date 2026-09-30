'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LuCircleUserRound, LuMail, LuStore } from 'react-icons/lu'
import { toExternalPath } from '@/lib/route-paths'

const tabs = [
  { href: '/', match: ['/convites'], label: 'Convites', Icon: LuMail, badge: true },
  { href: '/restaurantes', match: [], label: 'Restaurantes', Icon: LuStore, badge: false },
  { href: '/conta', match: [], label: 'Conta', Icon: LuCircleUserRound, badge: false },
] as const

function isActive(pathname: string, href: string, match: readonly string[]) {
  if (href === '/' && pathname === '/') return true
  return [href, ...match].some((prefix) => prefix !== '/' && (pathname === prefix || pathname.startsWith(`${prefix}/`)))
}

// Tab bar do console no celular, no padrão do iOS: três destinos fixos,
// rótulo sempre visível e o dourado só na aba ativa. O desktop usa a sidebar.
export function ConsoleTabBar({ pendingCount }: { pendingCount: number }) {
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
    </nav>
  )
}
