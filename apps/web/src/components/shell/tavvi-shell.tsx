'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { cn } from 'cn'
import { AccountPopover } from './account-popover'
import { CommandPalette } from './command-palette'
import { flattenNavItems } from './navigation'
import { Sidebar } from './sidebar'
import { toggleRailMode, useRailMode, type RailMode } from './rail-store'
import type { TavviShellConfig } from './navigation.types'

export function TavviShell({
  config,
  children,
  className,
  initialRail = 'collapsed',
}: {
  config: TavviShellConfig
  children: React.ReactNode
  className?: string
  initialRail?: RailMode
}) {
  const mode = useRailMode(initialRail)
  const [accountOpen, setAccountOpen] = useState(false)
  const expanded = mode === 'pinned'
  const sidebarWidth = expanded ? 232 : 60
  const entries = flattenNavItems(config.items).map((item) => ({
    href: item.href,
    label: item.label,
    description: item.description,
    icon: item.icon,
  }))

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target
      const editable = target instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)
      if (event.repeat || editable) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault()
        toggleRailMode()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="tv-console-root" style={{ '--tv-sidebar-width': `${sidebarWidth}px` } as CSSProperties}>
      <Sidebar
        items={entries}
        mode={mode}
        contextLabel={config.contextLabel ?? 'Tavvi'}
        contextDescription={config.contextDescription ?? 'Painel'}
        email={config.userLabel}
        onAccount={() => setAccountOpen((open) => !open)}
        onToggle={toggleRailMode}
      />
      <main className={cn('tv-console-main', className)}>{children}</main>
      <CommandPalette config={config} />
      {accountOpen ? <><button className="tv-overlay-scrim" aria-label="Fechar conta" onClick={() => setAccountOpen(false)} /><AccountPopover email={config.userLabel} description={null} onClose={() => setAccountOpen(false)} /></> : null}
    </div>
  )
}
