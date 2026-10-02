'use client'

import { useCallback, useRef, useState, useSyncExternalStore, type Ref } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { LuChevronsUpDown, LuPanelLeft, LuPanelLeftOpen, LuSearch } from 'react-icons/lu'
import { setCommandPaletteOpen } from './command-palette-store'
import { navigationPathname, pickActiveHref } from './navigation'
import { getNavIcon } from './navigation-icons'
import { toExternalPath } from '@/lib/route-paths'
import type { RailMode } from './rail-store'
import type { NavIconName } from './navigation.types'
import type { RestaurantSwitchEntry } from './console-config'
import { RestaurantSwitcher } from './restaurant-switcher'
import { useCallArrivalShake } from './use-call-arrival-shake'

export type SidebarBrand =
  | { kind: 'tavvi' }
  | { kind: 'restaurant'; logoUrl: string | null; initials: string }

// O que o topo da sidebar mostra em cada contexto: a marca Tavvi no console e
// no seletor de restaurantes; dentro de um restaurante, a logo dele ou, sem
// logo, as iniciais no dourado.
export type SidebarIdentity = {
  brand: SidebarBrand
  title: string
  subtitle: string
  section: string
  accountDescription: string
}

function BrandMark({ brand }: { brand: SidebarBrand }) {
  if (brand.kind === 'restaurant' && brand.logoUrl) {
    return (
      <span className="tv-sidebar-mark is-logo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={brand.logoUrl} alt="" />
      </span>
    )
  }
  if (brand.kind === 'restaurant') {
    return <span className="tv-sidebar-mark is-initials" aria-hidden="true">{brand.initials}</span>
  }
  return (
    <span className="tv-sidebar-mark">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="tv-brandmark-light" src="/brand/tavvi-brandmark-gold-on-light.png" alt="" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="tv-brandmark-dark" src="/brand/tavvi-brandmark-gold-on-dark.png" alt="" />
    </span>
  )
}

export type SidebarEntry = {
  href: string
  label: string
  description?: string
  icon: NavIconName
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
  identity,
  email,
  name,
  accountOpen = false,
  accountButtonRef,
  onSearch,
  onAccount,
  onToggle,
  mobileChrome = 'full',
  switcher,
  accountBadge = false,
  callsArrivalKey = 0,
  pendingHref,
  onNavigate,
}: {
  items: SidebarEntry[]
  mode: RailMode
  identity: SidebarIdentity
  email: string | null
  name?: string | null
  accountOpen?: boolean
  accountButtonRef?: Ref<HTMLButtonElement>
  onSearch?: () => void
  onAccount: () => void
  onToggle: () => void
  /** Celular: `full` (cabeçalho com conta e abas, seletor de restaurantes),
      `header` (só o cabeçalho, painel com tab bar) ou `none` (console). */
  mobileChrome?: 'full' | 'header' | 'none'
  /** Com 2 ou mais restaurantes, o bloco da marca vira o seletor. */
  switcher?: { restaurants: RestaurantSwitchEntry[]; currentId: string }
  callsArrivalKey?: number
  /** Ponto no avatar quando há notificações não lidas. */
  accountBadge?: boolean
  pendingHref?: string | null
  onNavigate?: (href: string) => void
}) {
  const pathname = toExternalPath(usePathname())
  // As rotas com sidebar são dinâmicas (leem cookie e sessão), então a busca
  // já existe no render do servidor e não suspende.
  const step = useSearchParams().get('passo')
  const activeHref = pendingHref
    ? pickActiveHref(navigationPathname(toExternalPath(pendingHref), null), items.map((item) => item.href))
    : pickActiveHref(navigationPathname(pathname, step), items.map((item) => item.href))
  const modifier = useModifierKey()
  const expanded = mode === 'pinned'
  const initial = email?.trim().slice(0, 1).toUpperCase() || 'A'
  const [switchOpen, setSwitchOpen] = useState(false)
  const switchButtonRef = useRef<HTMLButtonElement>(null)
  const callsLinkRef = useCallArrivalShake<HTMLAnchorElement>(callsArrivalKey)
  const closeSwitch = useCallback(() => {
    setSwitchOpen(false)
    switchButtonRef.current?.focus()
  }, [])
  const canSwitch = Boolean(switcher && switcher.restaurants.length > 1)
  const openSearch = () => {
    onSearch?.()
    setCommandPaletteOpen(true)
  }

  function links(mobile = false) {
    return items.map((item) => {
      const Icon = getNavIcon(item.icon)
      const selected = item.href === activeHref
      const loading = Boolean(pendingHref && selected)
      return (
        <Link
          key={item.href}
          href={item.href}
          aria-current={selected ? 'page' : undefined}
          aria-label={mobile || !expanded ? item.label : undefined}
          title={!mobile && !expanded ? item.label : undefined}
          ref={item.icon === 'bell' ? callsLinkRef : undefined}
          className={`tv-sidebar-link${selected ? ' is-active' : ''}${loading ? ' is-loading' : ''}${mobile ? ' is-mobile' : ''}${item.icon === 'bell' && (item.count ?? 0) > 0 ? ' has-call-pending' : ''}`}
          onClick={(event) => {
            if (item.href !== activeHref && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
              onNavigate?.(item.href)
            }
          }}
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
          {canSwitch ? (
            <button
              ref={switchButtonRef}
              type="button"
              className="tv-sidebar-switch"
              aria-haspopup="dialog"
              aria-expanded={switchOpen}
              aria-label={`Trocar de restaurante. Atual: ${identity.title}`}
              title={expanded ? undefined : 'Trocar de restaurante'}
              onClick={() => setSwitchOpen((open) => !open)}
            >
              <BrandMark brand={identity.brand} />
              <span className="tv-sidebar-brand-copy"><strong>{identity.title}</strong><small>{identity.subtitle}</small></span>
              <LuChevronsUpDown aria-hidden="true" className="tv-sidebar-switch-icon" />
            </button>
          ) : (
            <>
              <BrandMark brand={identity.brand} />
              <span className="tv-sidebar-brand-copy"><strong>{identity.title}</strong><small>{identity.subtitle}</small></span>
            </>
          )}
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
        <div className="tv-sidebar-section-label">{identity.section}</div>
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
            aria-label={expanded ? undefined : `Conta: ${email ?? 'sem e-mail'}${accountBadge ? ', notificações não lidas' : ''}`}
            title={expanded ? undefined : 'Conta'}
            onClick={onAccount}
          >
            <span className="tv-sidebar-avatar" aria-hidden="true">
              {initial}
              {accountBadge ? <span className="tv-sidebar-account-dot" /> : null}
            </span>
            {expanded && accountBadge ? <span className="sr-only">Há notificações não lidas.</span> : null}
            <span className="tv-sidebar-account-copy"><strong>{name?.trim() || email || 'Conta'}</strong><small>{identity.accountDescription}</small></span>
            <LuChevronsUpDown aria-hidden="true" />
          </button>
        </div>
      </aside>
      {switchOpen && switcher ? <RestaurantSwitcher restaurants={switcher.restaurants} currentId={switcher.currentId} onClose={closeSwitch} /> : null}

      {mobileChrome !== 'none' ? <>
        <header className="tv-mobile-header">
          <BrandMark brand={identity.brand} />
          <span className="tv-mobile-context"><strong>{identity.title}</strong><small>{identity.subtitle}</small></span>
          <button type="button" className="tv-mobile-search" aria-label="Buscar páginas" onClick={openSearch}><LuSearch /></button>
          {mobileChrome === 'full' ? <button type="button" className="tv-mobile-account" aria-label="Abrir conta" onClick={onAccount}>{initial}</button> : null}
        </header>
        {mobileChrome === 'full' ? <nav className="tv-mobile-tabs" aria-label="Navegação principal">{links(true)}</nav> : null}
      </> : null}
    </>
  )
}
