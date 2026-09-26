'use client'

import type { CSSProperties } from 'react'
import { cn } from 'cn'
import { DesktopSidebar } from './desktop-sidebar'
import { MobileNavigation } from './mobile-navigation'
import { CommandPalette } from './command-palette'
import type { TavviShellConfig } from './navigation.types'
import { useSidebarCollapsed } from './sidebar-store'

export function TavviShell({
  config,
  children,
  className,
}: {
  config: TavviShellConfig
  children: React.ReactNode
  className?: string
}) {
  const collapsed = useSidebarCollapsed()
  const style = {
    '--sidebar-width': collapsed ? '64px' : '260px',
  } as CSSProperties

  return (
    <div
      data-sidebar-collapsed={collapsed || undefined}
      style={style}
      className="min-h-dvh bg-surface-1 text-foreground"
    >
      <DesktopSidebar config={config} />
      <main
        className={cn(
          'min-h-dvh transition-[margin] duration-[220ms] ease-[cubic-bezier(0.23,1,0.32,1)] md:ml-[var(--sidebar-width)]',
          className,
        )}
      >
        {children}
      </main>
      <MobileNavigation config={config} />
      <CommandPalette config={config} />
    </div>
  )
}
