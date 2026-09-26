'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'
import { RiArrowLeftSLine } from 'react-icons/ri'
import { cn } from 'cn'
import { APP_MONOGRAM, APP_NAME } from '@/lib/brand'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { SignOutButton } from './sign-out-button'
import { CommandPaletteTrigger } from './command-palette'
import { NavTree } from './nav-tree'
import type { TavviShellConfig } from './navigation.types'
import {
  toggleSidebarCollapsed,
  useSidebarCollapsed,
} from './sidebar-store'

const EXPANDED_W = 260
const COLLAPSED_W = 64
const EASE = [0.23, 1, 0.32, 1] as const
const INSTANT = { duration: 0 }
const SIDEBAR_T = { duration: 0.22, ease: EASE }
const LABEL_T = (delay = 0) => ({ duration: 0.18, ease: EASE, delay })
const ICON_T = { duration: 0.22, ease: EASE }

function isEditable(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
      target.isContentEditable)
  )
}

export function DesktopSidebar({ config }: { config: TavviShellConfig }) {
  const collapsed = useSidebarCollapsed()
  const expanded = !collapsed
  const pathname = usePathname()
  const reduced = useReducedMotion()
  const [live, setLive] = useState(false)

  useEffect(() => {
    let secondFrame: number
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setLive(true))
    })
    return () => {
      cancelAnimationFrame(firstFrame)
      cancelAnimationFrame(secondFrame)
    }
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat || isEditable(event.target)) return
      if ((event.ctrlKey || event.metaKey) && event.code === 'KeyB') {
        event.preventDefault()
        toggleSidebarCollapsed()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const animate = live && !reduced
  const labelTransition = (delay = 0) =>
    animate ? LABEL_T(delay) : INSTANT

  return (
    <m.aside
      aria-label="Navegação principal"
      className="fixed inset-y-0 left-0 z-40 hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex"
      style={{ width: EXPANDED_W }}
      animate={{ width: expanded ? EXPANDED_W : COLLAPSED_W }}
      transition={animate ? SIDEBAR_T : INSTANT}
    >
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={toggleSidebarCollapsed}
        aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
        title={collapsed ? 'Expandir (Ctrl+B)' : 'Recolher (Ctrl+B)'}
        className={cn(
          'absolute right-0 top-3 z-20 size-[32px] translate-x-1/2',
          'rounded-full border-2 border-dashed border-sidebar-border bg-sidebar text-muted-foreground',
          '[transition:color_150ms_cubic-bezier(0.23,1,0.32,1),border-color_150ms_cubic-bezier(0.23,1,0.32,1),transform_100ms_ease-out]',
          'hover:border-primary hover:bg-sidebar-accent hover:text-foreground active:scale-95',
        )}
      >
        <m.span
          className="inline-flex"
          animate={{ rotate: expanded ? 0 : 180 }}
          transition={animate ? ICON_T : INSTANT}
        >
          <RiArrowLeftSLine size={16} aria-hidden="true" />
        </m.span>
      </Button>

      <div
        role="img"
        aria-label={config.contextLabel ? `${APP_NAME}, ${config.contextLabel}` : APP_NAME}
        className={cn(
          'flex h-16 shrink-0 items-center overflow-hidden border-b border-sidebar-border',
          collapsed ? 'justify-center px-0' : 'px-3',
        )}
      >
        <span
          aria-hidden="true"
          className="flex size-[32px] shrink-0 items-center justify-center rounded-lg bg-primary text-[0.7rem] font-bold tracking-[-0.02em] text-primary-foreground shadow-sm"
        >
          {APP_MONOGRAM}
        </span>
        <m.span
          aria-hidden="true"
          className="flex min-w-0 flex-col overflow-hidden whitespace-nowrap pl-3 select-none"
          animate={{
            maxWidth: expanded ? 188 : 0,
            opacity: expanded ? 1 : 0,
          }}
          transition={labelTransition()}
        >
          <span className="font-heading text-[0.65rem] font-semibold uppercase leading-none tracking-[0.14em] text-muted-foreground">
            {APP_NAME}
          </span>
          {config.contextLabel ? (
            <span
              className="mt-1.5 block max-w-[176px] truncate text-xs font-semibold leading-none text-foreground"
              title={config.contextLabel}
            >
              {config.contextLabel}
            </span>
          ) : null}
        </m.span>
      </div>

      <div className="shrink-0 px-2 pt-3">
        <CommandPaletteTrigger collapsed={collapsed} />
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-visible px-2 pt-2 pb-3">
        <NavTree
          items={config.items}
          pathname={pathname}
          density="sidebar"
          collapsed={collapsed}
          animate={animate}
        />
      </nav>

      <div className="flex shrink-0 flex-col gap-1 border-t border-sidebar-border px-2 py-3">
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger render={<span className="block w-full" />}>
              <ThemeToggle className="h-10 w-full rounded-md" />
            </TooltipTrigger>
            <TooltipContent side="right">Tema</TooltipContent>
          </Tooltip>
        ) : (
          <ThemeToggle label="Tema" className="h-10 rounded-md" />
        )}
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger render={<span className="block w-full" />}>
              <SignOutButton compact className="h-10 rounded-md" />
            </TooltipTrigger>
            <TooltipContent side="right">Sair</TooltipContent>
          </Tooltip>
        ) : (
          <SignOutButton className="h-10 justify-start gap-3 rounded-md px-3" />
        )}
      </div>
    </m.aside>
  )
}
