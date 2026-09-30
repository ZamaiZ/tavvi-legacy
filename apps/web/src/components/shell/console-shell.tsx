'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { CommandPalette } from './console-command-palette'
import { AccountPopover } from './account-popover'
import { MobileTabBar } from './mobile-tab-bar'
import { Sidebar } from './sidebar'
import { toggleRailMode, useRailMode, type RailMode } from './rail-store'
import type { ConsoleConfig, RestaurantShellInfo } from './console-config'

type InviteRequest = { email?: string; inviteId?: string }

type ConsoleActionValue = { openInvite: (email?: string, inviteId?: string) => void }
const ConsoleActionsContext = createContext<ConsoleActionValue>({ openInvite: () => undefined })
type ConsoleInviteValue = { request: InviteRequest | null; onClose: () => void }
const ConsoleInviteContext = createContext<ConsoleInviteValue | null>(null)
type ConsoleAccountValue = { open: boolean; email: string | null; description: string | null; onClose: () => void }
const ConsoleAccountContext = createContext<ConsoleAccountValue | null>(null)

export function useConsoleActions() {
  return useContext(ConsoleActionsContext)
}

export function useConsoleInvite() {
  const context = useContext(ConsoleInviteContext)
  if (!context) throw new Error('useConsoleInvite precisa estar dentro de ConsoleShell')
  return context
}

// Estado do sheet da aba Conta (celular). O sheet vem do layout pela prop
// `accountSheet`, no mesmo padrão do `inviteOverlay`.
export function useConsoleAccount() {
  const context = useContext(ConsoleAccountContext)
  if (!context) throw new Error('useConsoleAccount precisa estar dentro de ConsoleShell')
  return context
}

type RestaurantShellValue = RestaurantShellInfo & { email: string | null }
const RestaurantShellContext = createContext<RestaurantShellValue | null>(null)

// Restaurante atual, os restaurantes da pessoa e se ela edita. Lido por
// Ajustes, pelo sheet de troca e pelo seletor do sidebar.
export function useRestaurantShell() {
  const context = useContext(RestaurantShellContext)
  if (!context) throw new Error('useRestaurantShell precisa estar dentro do ConsoleShell de um restaurante')
  return context
}

export function ConsoleShell({
  children,
  config,
  initialRail,
  inviteOverlay,
  accountSheet,
  surface = 'restaurant',
}: {
  children: ReactNode
  config: ConsoleConfig
  initialRail: RailMode
  inviteOverlay?: ReactNode
  accountSheet?: ReactNode
  surface?: 'console' | 'restaurant'
}) {
  const leaves = config.leaves
  const email = config.userLabel
  const description = config.userDescription ?? null
  const counts = config.counts ?? { pendingInvites: 0, restaurants: 0 }
  const widths = config.railWidths ?? { collapsed: 60, pinned: 232 }
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [accountSheetOpen, setAccountSheetOpen] = useState(false)
  const [inviteRequest, setInviteRequest] = useState<{ email?: string; inviteId?: string } | null>(null)
  const accountButtonRef = useRef<HTMLButtonElement>(null)
  const accountTabRef = useRef<HTMLButtonElement>(null)
  const mode = useRailMode(initialRail)
  const openInvite = useCallback((prefillEmail?: string, inviteId?: string) => setInviteRequest({ email: prefillEmail, inviteId }), [])
  const context = useMemo(() => ({ openInvite }), [openInvite])
  const closeInvite = useCallback(() => setInviteRequest(null), [])
  const inviteContext = useMemo(() => ({ request: inviteRequest, onClose: closeInvite }), [closeInvite, inviteRequest])
  const closeAccount = useCallback(() => {
    setAccountOpen(false)
    accountButtonRef.current?.focus()
  }, [])
  const closeAccountSheet = useCallback(() => {
    setAccountSheetOpen(false)
    accountTabRef.current?.focus()
  }, [])
  const accountContext = useMemo(() => ({ open: accountSheetOpen, email, description, onClose: closeAccountSheet }), [accountSheetOpen, closeAccountSheet, description, email])
  const restaurantContext = useMemo(() => (config.restaurant ? { ...config.restaurant, email } : null), [config.restaurant, email])
  const mobileTabs = (config.mobileTabs ?? []).map((tab) => (tab.key === 'invites' ? { ...tab, badge: counts.pendingInvites } : tab))
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const editable = event.target instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) || event.target.isContentEditable)
      if (event.repeat || editable) return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault()
        toggleRailMode()
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mode])

  // No celular a barra do navegador acompanha o fundo agrupado (console e
  // painel), inclusive quando o tema escolhido difere do tema do sistema.
  useEffect(() => {
    const root = document.documentElement
    const sync = () => {
      const color = root.classList.contains('dark') ? '#0D0C0A' : '#F2F0EB'
      document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => { meta.content = color })
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return <ConsoleActionsContext.Provider value={context}>
    <ConsoleInviteContext.Provider value={inviteContext}>
      <ConsoleAccountContext.Provider value={accountContext}>
        <RestaurantShellContext.Provider value={restaurantContext}>
        <div className="tv-console-root" data-surface={surface} style={{ '--tv-sidebar-width': mode === 'pinned' ? `${widths.pinned}px` : `${widths.collapsed}px` } as CSSProperties}>
          <Sidebar
            items={leaves.map((leaf) => ({
              href: leaf.href,
              label: leaf.label,
              description: leaf.sub,
              icon: leaf.icon,
              count: leaf.key === 'invites' ? counts.pendingInvites : leaf.key === 'restaurants' ? counts.restaurants : undefined,
            }))}
            mode={mode}
            identity={config.sidebar}
            email={email}
            accountOpen={accountOpen}
            accountButtonRef={accountButtonRef}
            onSearch={() => setPaletteOpen(true)}
            onAccount={() => setAccountOpen((open) => !open)}
            onToggle={toggleRailMode}
            mobileChrome={surface === 'console' ? 'none' : 'header'}
            switcher={config.restaurant ? { restaurants: config.restaurant.restaurants, currentId: config.restaurant.restaurantId } : undefined}
          />
          <main className="tv-console-main">{children}</main>
          {mobileTabs.length > 0 ? (
            <MobileTabBar
              tabs={mobileTabs}
              account={surface === 'console' ? { open: accountSheetOpen, buttonRef: accountTabRef, onOpen: () => setAccountSheetOpen(true) } : undefined}
            />
          ) : null}
          <CommandPalette leaves={leaves} open={paletteOpen} onClose={() => setPaletteOpen(false)} onNewInvite={config.showNewInvite ? () => openInvite() : undefined} />
          {accountOpen ? <AccountPopover email={email} description={description} onClose={closeAccount} /> : null}
          {config.showNewInvite ? inviteOverlay : null}
          {surface === 'console' ? accountSheet : null}
        </div>
        </RestaurantShellContext.Provider>
      </ConsoleAccountContext.Provider>
    </ConsoleInviteContext.Provider>
  </ConsoleActionsContext.Provider>
}
