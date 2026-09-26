'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { toExternalPath } from '@/lib/route-paths'
import { CommandPalette } from './console-command-palette'
import { AccountPopover } from './account-popover'
import { LiquidFrame } from './liquid-frame'
import { MobileDock } from './mobile-dock'
import { Rail } from './rail'
import { toggleRailMode, useRailMode, type RailMode } from './rail-store'
import { getActiveConsoleLeaf, type ConsoleConfig, type ConsoleLeaf } from './console-config'

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
}: {
  children: ReactNode
  config: ConsoleConfig
  initialRail: RailMode
  inviteOverlay?: ReactNode
}) {
  const leaves = config.leaves
  const email = config.userLabel
  const description = config.userDescription ?? null
  const counts = config.counts ?? { pendingInvites: 0, restaurants: 0 }
  const widths = config.railWidths ?? { collapsed: 80, pinned: 272 }
  const pathname = usePathname()
  const mode = useRailMode(initialRail)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [inviteRequest, setInviteRequest] = useState<{ email?: string; inviteId?: string } | null>(null)
  const moveRef = useRef<(left: number, cy: number, instant?: boolean) => void>(() => undefined)
  const activeLeaf = getActiveConsoleLeaf(toExternalPath(pathname), leaves)
  const activeIndex = Math.max(0, leaves.findIndex((leaf) => leaf.key === activeLeaf?.key))
  const openInvite = useCallback((prefillEmail?: string, inviteId?: string) => setInviteRequest({ email: prefillEmail, inviteId }), [])
  const context = useMemo(() => ({ openInvite }), [openInvite])
  const closeInvite = useCallback(() => setInviteRequest(null), [])
  const inviteContext = useMemo(() => ({ request: inviteRequest, onClose: closeInvite }), [closeInvite, inviteRequest])
  const setMove = useCallback((move: (left: number, cy: number, instant?: boolean) => void) => { moveRef.current = move }, [])

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
    moveRef.current(mode === 'pinned' ? widths.pinned : widths.collapsed, 196 + 64 * activeIndex)
  }, [activeIndex, mode, widths.collapsed, widths.pinned])

  const navigate = useCallback((leaf: ConsoleLeaf) => {
    const targetIndex = Math.max(0, leaves.findIndex((item) => item.key === leaf.key))
    moveRef.current(mode === 'pinned' ? widths.pinned : widths.collapsed, 196 + 64 * targetIndex)
  }, [leaves, mode, widths.collapsed, widths.pinned])

  return <ConsoleActionsContext.Provider value={context}>
    <ConsoleInviteContext.Provider value={inviteContext}>
      <div className="tv-console-root" style={{ '--tv-rail-collapsed-width': `${widths.collapsed}px`, '--tv-rail-pinned-width': `${widths.pinned}px` } as CSSProperties}>
        <LiquidFrame initialLeft={initialRail === 'pinned' ? widths.pinned : widths.collapsed} activeIndex={activeIndex} collapsedWidth={widths.collapsed} onReady={setMove}>
          <Rail leaves={leaves} mode={mode} email={email} userDescription={description} contextLabel={config.contextLabel ?? null} contextDescription={config.contextDescription ?? null} onSearch={() => setPaletteOpen(true)} onAccount={() => setAccountOpen((open) => !open)} onNavigate={navigate} />
          {children}
        </LiquidFrame>
        <MobileDock leaves={leaves} email={email} description={description} counts={counts} homeHref={config.homeHref ?? '/'} />
        <CommandPalette leaves={leaves} open={paletteOpen} onClose={() => setPaletteOpen(false)} onNewInvite={config.showNewInvite ? () => openInvite() : undefined} />
        {accountOpen && <><button className="tv-overlay-scrim" aria-label="Fechar conta" onClick={() => setAccountOpen(false)} /><AccountPopover email={email} description={description} onClose={() => setAccountOpen(false)} /></>}
        {config.showNewInvite ? inviteOverlay : null}
      </div>
    </ConsoleInviteContext.Provider>
  </ConsoleActionsContext.Provider>
}
