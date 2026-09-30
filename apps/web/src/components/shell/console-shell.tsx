'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { CommandPalette } from './console-command-palette'
import { AccountPopover } from './account-popover'
import { ConsoleTabBar } from './console-tab-bar'
import { Sidebar } from './sidebar'
import { toggleRailMode, useRailMode, type RailMode } from './rail-store'
import type { ConsoleConfig } from './console-config'

type InviteRequest = { email?: string; inviteId?: string }

type ConsoleActionValue = { openInvite: (email?: string, inviteId?: string) => void }
const ConsoleActionsContext = createContext<ConsoleActionValue>({ openInvite: () => undefined })
type ConsoleInviteValue = { request: InviteRequest | null; onClose: () => void }
const ConsoleInviteContext = createContext<ConsoleInviteValue | null>(null)

export function useConsoleActions() {
  return useContext(ConsoleActionsContext)
}

export function useConsoleInvite() {
  const context = useContext(ConsoleInviteContext)
  if (!context) throw new Error('useConsoleInvite precisa estar dentro de ConsoleShell')
  return context
}

export function ConsoleShell({
  children,
  config,
  initialRail,
  inviteOverlay,
  surface = 'restaurant',
}: {
  children: ReactNode
  config: ConsoleConfig
  initialRail: RailMode
  inviteOverlay?: ReactNode
  surface?: 'console' | 'restaurant'
}) {
  const leaves = config.leaves
  const email = config.userLabel
  const description = config.userDescription ?? null
  const counts = config.counts ?? { pendingInvites: 0, restaurants: 0 }
  const widths = config.railWidths ?? { collapsed: 60, pinned: 232 }
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [inviteRequest, setInviteRequest] = useState<{ email?: string; inviteId?: string } | null>(null)
  const mode = useRailMode(initialRail)
  const openInvite = useCallback((prefillEmail?: string, inviteId?: string) => setInviteRequest({ email: prefillEmail, inviteId }), [])
  const context = useMemo(() => ({ openInvite }), [openInvite])
  const closeInvite = useCallback(() => setInviteRequest(null), [])
  const inviteContext = useMemo(() => ({ request: inviteRequest, onClose: closeInvite }), [closeInvite, inviteRequest])
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

  // No celular a barra do navegador acompanha o fundo agrupado do console,
  // inclusive quando o tema escolhido difere do tema do sistema.
  useEffect(() => {
    if (surface !== 'console') return
    const root = document.documentElement
    const sync = () => {
      const color = root.classList.contains('dark') ? '#0D0C0A' : '#F2F0EB'
      document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => { meta.content = color })
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [surface])

  return <ConsoleActionsContext.Provider value={context}>
    <ConsoleInviteContext.Provider value={inviteContext}>
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
          contextLabel={config.contextDescription === 'Console' ? 'Tavvi' : config.contextLabel === 'Painel' ? config.contextDescription ?? 'Restaurante' : config.contextLabel ?? 'Tavvi'}
          contextDescription={config.contextDescription === 'Console' ? 'Console' : config.contextLabel === 'Painel' ? `Painel · ${config.userDescription?.split(' · ')[0] ?? 'Equipe'}` : config.contextDescription ?? 'Gerenciar'}
          email={email}
          onSearch={() => setPaletteOpen(true)}
          onAccount={() => setAccountOpen((open) => !open)}
          onToggle={toggleRailMode}
          mobileChrome={surface !== 'console'}
        />
        <main className="tv-console-main">{children}</main>
        {surface === 'console' ? <ConsoleTabBar pendingCount={counts.pendingInvites} /> : null}
        <CommandPalette leaves={leaves} open={paletteOpen} onClose={() => setPaletteOpen(false)} onNewInvite={config.showNewInvite ? () => openInvite() : undefined} />
        {accountOpen && <><button className="tv-overlay-scrim" aria-label="Fechar conta" onClick={() => setAccountOpen(false)} /><AccountPopover email={email} description={description} onClose={() => setAccountOpen(false)} /></>}
        {config.showNewInvite ? inviteOverlay : null}
      </div>
    </ConsoleInviteContext.Provider>
  </ConsoleActionsContext.Provider>
}
