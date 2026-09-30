'use client'

import { useSyncExternalStore, type Ref } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LuBookOpen, LuChevronsUpDown, LuContact, LuMail, LuPalette, LuPanelLeft, LuPanelLeftOpen, LuSearch, LuStore, LuUsers } from 'react-icons/lu'
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

const subscribeNoop = () => () => {}

// Tecla modificadora dos atalhos: ⌘ no Mac, Ctrl nos demais. O servidor não
// sabe a plataforma, então renderiza Ctrl e o cliente corrige.
function useModifierKey() {
  return useSyncExternalStore(
    subscribeNoop,
    () => (/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'),
    () => 'Ctrl',
  )
}

function shortcut(modifier: string, key: string) {
  return modifier === '⌘' ? `⌘${key}` : `Ctrl ${key}`
}

export function Sidebar({
  items,
  mode,
  contextLabel,
  contextDescription,
  email,
  accountOpen = false,
  accountButtonRef,
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
  accountOpen?: boolean
  accountButtonRef?: Ref<HTMLButtonElement>
  onSearch?: () => void
  onAccount: () => void
  onToggle: () => void
  mobileChrome?: boolean
}) {
  const pathname = toExternalPath(usePathname())
  const modifier = useModifierKey()
  const expanded = mode === 'pinned'
  const initial = email?.trim().slice(0, 1).toUpperCase() || 'A'
  const accountDescription = contextDescription === 'Console' ? 'Administrador da plataforma' : 'Acessar conta'
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
          aria-label={mobile || !expanded ? item.label : undefined}
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
          <button type="button" className="tv-sidebar-collapse" aria-label="Recolher menu" title={`Recolher (${shortcut(modifier, 'B')})`} onClick={onToggle}>
            <LuPanelLeft aria-hidden="true" />
          </button>
        </div>

        <button
          type="button"
          className="tv-sidebar-search"
          aria-label="Buscar página ou ação"
          title={expanded ? undefined : `Buscar (${shortcut(modifier, 'K')})`}
          onClick={openSearch}
        >
          <LuSearch aria-hidden="true" />
          <span aria-hidden="true">Buscar</span>
          <kbd aria-hidden="true">{shortcut(modifier, 'K')}</kbd>
        </button>
        <div className="tv-sidebar-section-label">{contextDescription === 'Console' ? 'Plataforma' : contextDescription.startsWith('Painel') ? 'Restaurante' : 'Gerenciar'}</div>
        <nav className="tv-sidebar-nav">{links()}</nav>

        <div className="tv-sidebar-footer">
          <button type="button" className="tv-sidebar-collapse-bottom" aria-label="Expandir menu" title={`Expandir (${shortcut(modifier, 'B')})`} onClick={onToggle}>
            <LuPanelLeftOpen aria-hidden="true" />
          </button>
          <button
            ref={accountButtonRef}
            type="button"
            className="tv-sidebar-account"
            aria-haspopup="dialog"
            aria-expanded={accountOpen}
            aria-label={expanded ? undefined : `Conta: ${email ?? 'sem e-mail'}`}
            title={expanded ? undefined : 'Conta'}
            onClick={onAccount}
          >
            <span className="tv-sidebar-avatar" aria-hidden="true">{initial}</span>
            <span className="tv-sidebar-account-copy"><strong>{email ?? 'Conta'}</strong><small>{accountDescription}</small></span>
            <LuChevronsUpDown aria-hidden="true" />
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
          <button type="button" className="tv-mobile-account" aria-label="Abrir conta" onClick={onAccount}>{initial}</button>
        </header>
        <nav className="tv-mobile-tabs" aria-label="Navegação principal">{links(true)}</nav>
      </> : null}
    </>
  )
}
