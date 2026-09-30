'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LuBookOpen, LuContact, LuMail, LuPanelLeftClose, LuPanelLeftOpen, LuPalette, LuSearch, LuStore, LuUsers, LuUserRound } from 'react-icons/lu'
import { CommandPaletteTrigger } from './command-palette'
import { setCommandPaletteOpen } from './command-palette-store'
import { toExternalPath } from '@/lib/route-paths'
import type { RailMode } from './rail-store'

const icons = {
  mail: LuMail,
  store: LuStore,
  restaurant: LuStore,
  menu: LuBookOpen,
  palette: LuPalette,
  contact: LuContact,
  team: LuUsers,
} as const

export type SidebarEntry = {
  href: string
  label: string
  description?: string
  icon: keyof typeof icons
  count?: number
}

export function Sidebar({
  items,
  mode,
  contextLabel,
  contextDescription,
  email,
  onSearch,
  onAccount,
  onToggle,
  mobileChrome = true,
}: {
  items: SidebarEntry[]
  mode: RailMode
  contextLabel: string
  contextDescription: string
  email: string | null
  onSearch?: () => void
  onAccount: () => void
  onToggle: () => void
  mobileChrome?: boolean
}) {
  const pathname = toExternalPath(usePathname())
  const expanded = mode === 'pinned'
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`)
  const openSearch = () => {
    onSearch?.()
    setCommandPaletteOpen(true)
  }

  function links(mobile = false) {
    return items.map((item) => {
      const Icon = icons[item.icon]
      const selected = active(item.href)
      return (
        <Link
          key={item.href}
          href={item.href}
          aria-current={selected ? 'page' : undefined}
          aria-label={mobile ? item.label : undefined}
          title={!mobile && !expanded ? item.label : undefined}
          className={`tv-sidebar-link${selected ? ' is-active' : ''}${mobile ? ' is-mobile' : ''}`}
        >
          <Icon aria-hidden="true" />
          <span>{item.label}</span>
          {item.count != null ? <small>{item.count}</small> : null}
        </Link>
      )
    })
  }

  return (
    <>
      <aside className={`tv-sidebar${expanded ? ' is-expanded' : ''}`} aria-label="Navegação principal">
        <div className="tv-sidebar-brand">
          <span className="tv-sidebar-mark">
            <img className="tv-brandmark-light" src="/brand/tavvi-brandmark-gold-on-light.png" alt="" />
            <img className="tv-brandmark-dark" src="/brand/tavvi-brandmark-gold-on-dark.png" alt="" />
          </span>
          <span className="tv-sidebar-brand-copy"><strong>{contextLabel}</strong><small>{contextDescription}</small></span>
          <button type="button" className="tv-sidebar-collapse" aria-label={expanded ? 'Recolher menu' : 'Expandir menu'} title={expanded ? 'Recolher (⌘B)' : 'Expandir (⌘B)'} onClick={onToggle}>
            {expanded ? <LuPanelLeftClose /> : <LuPanelLeftOpen />}
          </button>
        </div>

        <CommandPaletteTrigger collapsed={!expanded} onOpen={openSearch} className="tv-sidebar-search" />
        <div className="tv-sidebar-section-label">{contextDescription === 'Console' ? 'Plataforma' : contextDescription.startsWith('Painel') ? 'Restaurante' : 'Gerenciar'}</div>
        <nav className="tv-sidebar-nav">{links()}</nav>

        <div className="tv-sidebar-footer">
          <button type="button" className="tv-sidebar-collapse-bottom" aria-label="Expandir menu" title="Expandir (⌘B)" onClick={onToggle}><LuPanelLeftOpen aria-hidden="true" /></button>
          <button type="button" className="tv-sidebar-account" onClick={onAccount}>
            <span className="tv-sidebar-avatar">{email?.trim().slice(0, 1).toUpperCase() || 'A'}</span>
            <span className="tv-sidebar-account-copy"><strong>{email ?? 'Conta'}</strong><small>{contextDescription === 'Console' ? 'Administrador da plataforma' : 'Acessar conta'}</small></span>
            <LuUserRound aria-hidden="true" />
          </button>
        </div>
      </aside>

      {mobileChrome ? <>
        <header className="tv-mobile-header">
          <span className="tv-sidebar-mark">
            <img className="tv-brandmark-light" src="/brand/tavvi-brandmark-gold-on-light.png" alt="" />
            <img className="tv-brandmark-dark" src="/brand/tavvi-brandmark-gold-on-dark.png" alt="" />
          </span>
          <span className="tv-mobile-context"><strong>{contextLabel}</strong><small>{contextDescription}</small></span>
          <button type="button" className="tv-mobile-search" aria-label="Buscar páginas" onClick={openSearch}><LuSearch /></button>
          <button type="button" className="tv-mobile-account" aria-label="Abrir conta" onClick={onAccount}>{email?.trim().slice(0, 1).toUpperCase() || 'A'}</button>
        </header>
        <nav className="tv-mobile-tabs" aria-label="Navegação principal">{links(true)}</nav>
      </> : null}
    </>
  )
}
