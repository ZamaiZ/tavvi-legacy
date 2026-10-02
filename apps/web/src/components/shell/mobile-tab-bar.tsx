'use client'

import type { CSSProperties, Ref } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LuBookOpen, LuCircleUserRound, LuConciergeBell, LuMail, LuMessageSquareText, LuSettings, LuStore, LuUsers } from 'react-icons/lu'
import { toExternalPath } from '@/lib/route-paths'
import type { MobileTab } from './navigation.types'

const icons = {
  mail: LuMail,
  store: LuStore,
  menu: LuBookOpen,
  service: LuConciergeBell,
  team: LuUsers,
  feedback: LuMessageSquareText,
  settings: LuSettings,
} as const

function trimSlash(path: string) {
  return path.length > 1 ? path.replace(/\/+$/, '') : path
}

export function isMobileTabActive(pathname: string, tab: MobileTab) {
  const current = trimSlash(pathname)
  if (tab.exact) return current === trimSlash(tab.href)
  return [tab.href, ...(tab.match ?? [])].some((prefix) => {
    const normalized = trimSlash(prefix)
    if (normalized === '/') return current === '/'
    return current === normalized || current.startsWith(`${normalized}/`)
  })
}

// Tab bar do iOS no celular, do console e do painel. Cada aba navega; a
// Conta do console abre o sheet de conta sem trocar de tela.
export function MobileTabBar({ tabs, account }: {
  tabs: MobileTab[]
  account?: { open: boolean; buttonRef: Ref<HTMLButtonElement>; onOpen: () => void; badge?: number }
}) {
  const pathname = toExternalPath(usePathname())
  const count = tabs.length + (account ? 1 : 0)
  return (
    <nav className="tv-tabbar" aria-label="Navegação principal" style={{ '--tv-tab-count': count } as CSSProperties}>
      {tabs.map((tab) => {
        const Icon = icons[tab.icon]
        const active = isMobileTabActive(pathname, tab)
        const badge = tab.badge && tab.badge > 0 ? tab.badge : null
        return (
          <Link key={tab.key} href={tab.href} aria-current={active ? 'page' : undefined} className={`tv-tabbar-item${active ? ' is-active' : ''}`}>
            <span className="tv-tabbar-icon">
              <Icon aria-hidden="true" />
              {badge ? <span className="tv-tabbar-badge">{badge > 99 ? '99+' : badge}<span className="sr-only"> pendentes</span></span> : null}
            </span>
            <span>{tab.label}</span>
          </Link>
        )
      })}
      {account ? (
        <button ref={account.buttonRef} type="button" className="tv-tabbar-item" aria-haspopup="dialog" aria-expanded={account.open} onClick={account.onOpen}>
          <span className="tv-tabbar-icon">
            <LuCircleUserRound aria-hidden="true" />
            {account.badge && account.badge > 0 ? (
              <span className="tv-tabbar-badge">{account.badge > 99 ? '99+' : account.badge}<span className="sr-only"> não lidas</span></span>
            ) : null}
          </span>
          <span>Conta</span>
        </button>
      ) : null}
    </nav>
  )
}
