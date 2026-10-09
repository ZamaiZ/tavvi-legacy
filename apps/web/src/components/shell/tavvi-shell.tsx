'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { cn } from 'cn'
import { AccountPopover } from './account-popover'
import { MobileDock } from './mobile-dock'
import { CommandPalette } from './command-palette'
import { flattenNavItems } from './navigation'
import { Sidebar, type SidebarIdentity } from './sidebar'
import { toggleRailMode, useRailMode, type RailMode } from './rail-store'
import type { TavviShellConfig } from './navigation.types'
import { useThemeColorSync } from '@/hooks/use-theme-color-sync'
import { toExternalPath } from '@/lib/route-paths'
import { NavigationProgress } from './navigation-progress'

export function TavviShell({
  config,
  sidebar,
  itemCounts,
  children,
  className,
  initialRail = 'collapsed',
}: {
  config: TavviShellConfig
  sidebar: SidebarIdentity
  /** Contador à direita de cada item, pela rota. */
  itemCounts?: Record<string, number>
  children: React.ReactNode
  className?: string
  initialRail?: RailMode
}) {
  const mode = useRailMode(initialRail)
  const [accountOpen, setAccountOpen] = useState(false)
  const accountButtonRef = useRef<HTMLButtonElement>(null)
  const mobileAccountButtonRef = useRef<HTMLButtonElement>(null)
  const closeAccount = useCallback(() => {
    setAccountOpen(false)
    const target = window.matchMedia('(max-width: 767px)').matches ? mobileAccountButtonRef.current : accountButtonRef.current
    target?.focus()
  }, [])
  const expanded = mode === 'pinned'
  const sidebarWidth = expanded ? 232 : 60
  const entries = flattenNavItems(config.items).map((item) => ({
    href: item.href,
    label: item.label,
    description: item.description,
    icon: item.icon,
    count: itemCounts?.[item.href],
  }))

  // A barra acompanha o fundo desta tela (--tv-bg), que não é o fundo
  // agrupado do ConsoleShell. Sem isto, o app instalado abriria a lista de
  // restaurantes com a barra preta do manifesto no tema claro.
  useThemeColorSync('#F5F3EE', '#0D0C0A')

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target
      const editable = target instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)
      if (event.repeat || editable) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') {
        if (window.matchMedia('(max-width: 767px)').matches) return
        event.preventDefault()
        toggleRailMode()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <NavigationProgress>
    <div className="tv-console-root" style={{ '--tv-sidebar-width': `${sidebarWidth}px` } as CSSProperties}>
      <Sidebar
        items={entries}
        mode={mode}
        identity={sidebar}
        email={config.userLabel}
        name={config.userName}
        accountOpen={accountOpen}
        accountButtonRef={accountButtonRef}
        onAccount={() => setAccountOpen((open) => !open)}
        onToggle={toggleRailMode}
        mobileChrome="header"
      />
      <main className={cn('tv-console-main', className)}>{children}</main>
      <MobileDock
        entries={entries}
        groupLabel={sidebar.section}
        groupIcon="store"
        homeHref={config.homeHref}
        subtitle="Acesse seus restaurantes"
        accountOpen={accountOpen}
        accountButtonRef={mobileAccountButtonRef}
        onAccount={() => setAccountOpen((open) => !open)}
        onCloseAccount={() => setAccountOpen(false)}
      />
      <CommandPalette config={config} />
      {accountOpen ? <AccountPopover
        email={config.userLabel} name={config.userName ?? null} description={null}
        profileHref={toExternalPath('/admin/workspace/profile')}
        settingsHref={toExternalPath('/admin/workspace/settings')}
        onClose={closeAccount} onNavigate={() => setAccountOpen(false)}
      /> : null}
    </div>
    </NavigationProgress>
  )
}
