'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { CommandPalette } from './console-command-palette'
import { AccountPopover } from './account-popover'
import { MobileTabBar } from './mobile-tab-bar'
import { NavigationProgress } from './navigation-progress'
import { Sidebar } from './sidebar'
import { toggleRailMode, useRailMode, type RailMode } from './rail-store'
import type { ConsoleConfig, RestaurantShellInfo } from './console-config'
import { usePathname, useRouter } from 'next/navigation'
import { onNotificationInserted, onNotificationRemoved } from '@/features/notifications/effects'
import { NotificationsContext, useNotificationsController } from '@/features/notifications/notifications-provider'
import { useThemeColorSync } from '@/hooks/use-theme-color-sync'
import { ACTIVE_PANEL_RESTAURANT_COOKIE, toExternalPath } from '@/lib/route-paths'
import { countPendingServiceCallsAction } from '@/server/actions/service-calls'
import { useServiceCallsRealtime } from '@/features/calls/use-service-calls-realtime'

type InviteRequest = { email?: string; inviteId?: string }

type ConsoleActionValue = { openInvite: (email?: string, inviteId?: string) => void }
const ConsoleActionsContext = createContext<ConsoleActionValue>({ openInvite: () => undefined })
type ConsoleInviteValue = { request: InviteRequest | null; onClose: () => void }
const ConsoleInviteContext = createContext<ConsoleInviteValue | null>(null)
type ConsoleAccountValue = { open: boolean; email: string | null; name: string | null; description: string | null; onClose: () => void }
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

type RestaurantShellValue = RestaurantShellInfo & { email: string | null; name: string | null }
const RestaurantShellContext = createContext<RestaurantShellValue | null>(null)

// Restaurante atual, os restaurantes da pessoa e se ela edita. Lido por
// Ajustes, pelo sheet de troca e pelo seletor do sidebar.
export function useRestaurantShell() {
  const context = useContext(RestaurantShellContext)
  if (!context) throw new Error('useRestaurantShell precisa estar dentro do ConsoleShell de um restaurante')
  return context
}

type ShellCountsValue = { unreadFeedback: number; adjustUnreadFeedback: (delta: number) => void }
const ShellCountsContext = createContext<ShellCountsValue>({ unreadFeedback: 0, adjustUnreadFeedback: () => undefined })

// Contador de feedbacks não lidos: vem do servidor e muda ao vivo
// (notificação nova, abrir, marcar como não lido, excluir).
export function useShellCounts() {
  return useContext(ShellCountsContext)
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
  const name = config.userName ?? null
  const description = config.userDescription ?? null
  const counts = { pendingInvites: 0, restaurants: 0, unreadFeedback: 0, unreadNotifications: 0, ...config.counts }
  // Quando o servidor manda um valor novo (navegação, router.refresh), ele
  // volta a valer; entre uma coisa e outra, a tela ajusta sozinha.
  const [unreadFeedback, setUnreadFeedback] = useState(counts.unreadFeedback)
  const [serverUnreadFeedback, setServerUnreadFeedback] = useState(counts.unreadFeedback)
  if (counts.unreadFeedback !== serverUnreadFeedback) {
    setServerUnreadFeedback(counts.unreadFeedback)
    setUnreadFeedback(counts.unreadFeedback)
  }
  const adjustUnreadFeedback = useCallback((delta: number) => {
    setUnreadFeedback((value) => Math.max(0, value + delta))
  }, [])
  const [pendingServiceCalls, setPendingServiceCalls] = useState(counts.pendingServiceCalls ?? 0)
  const [serverPendingServiceCalls, setServerPendingServiceCalls] = useState(counts.pendingServiceCalls ?? 0)
  const pendingServiceCallsRef = useRef(counts.pendingServiceCalls ?? 0)
  const [callsArrivalKey, setCallsArrivalKey] = useState(0)
  if ((counts.pendingServiceCalls ?? 0) !== serverPendingServiceCalls) {
    setServerPendingServiceCalls(counts.pendingServiceCalls ?? 0)
    setPendingServiceCalls(counts.pendingServiceCalls ?? 0)
    pendingServiceCallsRef.current = counts.pendingServiceCalls ?? 0
  }
  const refreshPendingServiceCalls = useCallback(async () => {
    const restaurantId = config.restaurant?.restaurantId
    if (!restaurantId) return
    const result = await countPendingServiceCallsAction({ restaurantId })
    if (result.ok) {
      if (result.data > pendingServiceCallsRef.current) setCallsArrivalKey((key) => key + 1)
      pendingServiceCallsRef.current = result.data
      setPendingServiceCalls(result.data)
    }
    else console.error('[chamados] contagem da navegação', result.error)
  }, [config.restaurant?.restaurantId])
  const onServiceCallsRealtime = useCallback(() => { void refreshPendingServiceCalls() }, [refreshPendingServiceCalls])
  useServiceCallsRealtime(config.restaurant?.restaurantId ?? '', onServiceCallsRealtime)
  const shellCounts = useMemo(() => ({ unreadFeedback, adjustUnreadFeedback }), [unreadFeedback, adjustUnreadFeedback])

  // Console = território admin; casca de restaurante = painel.
  const router = useRouter()
  const pathname = toExternalPath(usePathname())
  const effectContext = {
    territory: surface === 'console' ? ('admin' as const) : ('painel' as const),
    pathname,
    restaurantId: config.restaurant?.restaurantId ?? null,
    refresh: () => router.refresh(),
    adjustUnreadFeedback,
  }
  const notifications = useNotificationsController({
    initialUnread: counts.unreadNotifications,
    onInsert: (notification) => onNotificationInserted(notification, effectContext),
    onDelete: (notification) => onNotificationRemoved(notification, effectContext),
  })
  const widths = config.railWidths ?? { collapsed: 60, pinned: 232 }
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [accountSheetOpen, setAccountSheetOpen] = useState(false)
  const [inviteRequest, setInviteRequest] = useState<{ email?: string; inviteId?: string } | null>(null)
  const [pendingPageHref, setPendingPageHref] = useState<string | null>(null)
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
  const navigateFromAccount = useCallback((href?: string) => {
    setAccountOpen(false)
    if (href) {
      if (surface === 'restaurant' && config.restaurant) {
        const secure = window.location.protocol === 'https:' ? '; Secure' : ''
        document.cookie = `${ACTIVE_PANEL_RESTAURANT_COOKIE}=${config.restaurant.restaurantId}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`
      }
      setPendingPageHref(href)
    }
  }, [config.restaurant, surface])
  const closeAccountSheet = useCallback(() => {
    setAccountSheetOpen(false)
    accountTabRef.current?.focus()
  }, [])
  const accountContext = useMemo(() => ({ open: accountSheetOpen, email, name, description, onClose: closeAccountSheet }), [accountSheetOpen, closeAccountSheet, description, email, name])
  const restaurantContext = useMemo(() => (config.restaurant ? { ...config.restaurant, email, name } : null), [config.restaurant, email, name])
  const mobileTabs = (config.mobileTabs ?? []).map((tab) => {
    if (tab.key === 'invites') return { ...tab, badge: counts.pendingInvites }
    if (tab.key === 'feedback') return { ...tab, badge: unreadFeedback }
    if (tab.key === 'service') return { ...tab, badge: pendingServiceCalls }
    // Ajustes do painel abriga a central: o badge é o das notificações.
    if (tab.key === 'settings') return { ...tab, badge: notifications.unreadCount }
    return tab
  })
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
  useEffect(() => {
    setPendingPageHref(null)
  }, [pathname])

  // No celular a barra do navegador acompanha o fundo agrupado (console e
  // painel), inclusive quando o tema escolhido difere do tema do sistema.
  useThemeColorSync('#F2F0EB', '#0D0C0A')

  return <ConsoleActionsContext.Provider value={context}>
    <ConsoleInviteContext.Provider value={inviteContext}>
      <ConsoleAccountContext.Provider value={accountContext}>
        <RestaurantShellContext.Provider value={restaurantContext}>
        <NotificationsContext.Provider value={notifications}>
        <ShellCountsContext.Provider value={shellCounts}>
        <NavigationProgress>
        <div className="tv-console-root" data-surface={surface} style={{ '--tv-sidebar-width': mode === 'pinned' ? `${widths.pinned}px` : `${widths.collapsed}px` } as CSSProperties}>
          <Sidebar
            items={leaves.map((leaf) => ({
              href: leaf.href,
              label: leaf.label,
              description: leaf.sub,
              icon: leaf.icon,
              count: leaf.key === 'invites' ? counts.pendingInvites : leaf.key === 'restaurants' ? counts.restaurants : leaf.key === 'feedback' ? unreadFeedback || undefined : leaf.key === 'bell' ? pendingServiceCalls || undefined : undefined,
            }))}
            mode={mode}
            identity={config.sidebar}
            email={email}
            name={name}
            accountOpen={accountOpen}
            accountButtonRef={accountButtonRef}
            onSearch={() => setPaletteOpen(true)}
            onAccount={() => setAccountOpen((open) => !open)}
            onToggle={toggleRailMode}
            mobileChrome={surface === 'console' ? 'none' : 'header'}
            switcher={config.restaurant ? { restaurants: config.restaurant.restaurants, currentId: config.restaurant.restaurantId } : undefined}
            accountBadge={notifications.unreadCount > 0}
            callsArrivalKey={callsArrivalKey}
            pendingHref={pendingPageHref}
            onNavigate={setPendingPageHref}
          />
          <main className="tv-console-main" data-page-loading={pendingPageHref ? 'true' : undefined}>
            {children}
            {pendingPageHref ? <span className="tv-page-loading-mask" aria-hidden="true" /> : null}
          </main>
          {mobileTabs.length > 0 ? (
            <MobileTabBar
              tabs={mobileTabs}
              callsArrivalKey={callsArrivalKey}
              account={surface === 'console' ? { open: accountSheetOpen, buttonRef: accountTabRef, onOpen: () => setAccountSheetOpen(true), badge: notifications.unreadCount } : undefined}
            />
          ) : null}
          <CommandPalette leaves={leaves} open={paletteOpen} onClose={() => setPaletteOpen(false)} onNewInvite={config.showNewInvite ? () => openInvite() : undefined} />
          {accountOpen ? <AccountPopover
            email={email} name={name} description={description}
            profileHref={toExternalPath(surface === 'console' ? '/admin/profile' : '/admin/workspace/profile')}
            settingsHref={toExternalPath(surface === 'console' ? '/admin/settings' : '/admin/workspace/settings')}
            onClose={closeAccount} onNavigate={navigateFromAccount}
          /> : null}
          {config.showNewInvite ? inviteOverlay : null}
          {surface === 'console' ? accountSheet : null}
        </div>
        </NavigationProgress>
        </ShellCountsContext.Provider>
        </NotificationsContext.Provider>
        </RestaurantShellContext.Provider>
      </ConsoleAccountContext.Provider>
    </ConsoleInviteContext.Provider>
  </ConsoleActionsContext.Provider>
}
