'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Link, { useLinkStatus } from 'next/link'
import { AnimatePresence, useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'
import { RiArrowDownSLine, RiArrowRightSLine } from 'react-icons/ri'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getActiveHref, isGroupActive } from './navigation'
import { getNavIcon } from './navigation-icons'
import type { NavGroup, NavItem, NavLeaf } from './navigation.types'
import { RAIL, TreeRail, type NavTreeDensity, type Rail } from './nav-tree-geometry'

type NavTreeProps = {
  items: NavItem[]
  pathname: string
  density: NavTreeDensity
  collapsed?: boolean
  animate?: boolean
  onNavigate?: () => void
}

const EASE = [0.23, 1, 0.32, 1] as const
const INSTANT = { duration: 0 }
const LABEL_T = (delay = 0) => ({ duration: 0.18, ease: EASE, delay })
const FLYOUT_OPEN_DELAY = 250
const FLYOUT_CLOSE_DELAY = 120

const FLYOUT_VARIANTS = {
  hidden: {
    opacity: 0,
    scale: 0.96,
    filter: 'blur(1px)',
    transition: { duration: 0.14, ease: EASE },
  },
  visible: {
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
    transition: { duration: 0.18, ease: EASE },
  },
}

const FLYOUT_REDUCED = {
  hidden: { opacity: 0, transition: { duration: 0.1 } },
  visible: { opacity: 1, transition: { duration: 0.12 } },
}

const SCRIM_VARIANTS = {
  hidden: { opacity: 0, transition: { duration: 0.14, ease: EASE } },
  visible: { opacity: 1, transition: { duration: 0.18, ease: EASE } },
}

const SCRIM_REDUCED = {
  hidden: { opacity: 0, transition: { duration: 0.1 } },
  visible: { opacity: 1, transition: { duration: 0.12 } },
}


function NavPendingSurface({ children }: { children: ReactNode }) {
  const { pending } = useLinkStatus()

  return (
    <>
      {children}
      {pending ? (
        <span
          aria-busy="true"
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-[inherit]"
        >
          <span className="absolute inset-0 rounded-[inherit] bg-background/25 backdrop-blur-[2px] motion-reduce:backdrop-blur-none" />
          <Spinner aria-hidden="true" className="relative size-4 text-foreground" />
        </span>
      ) : null}
    </>
  )
}

function SidebarLabel({
  children,
  expanded,
  animate,
  delay = 0,
}: {
  children: ReactNode
  expanded: boolean
  animate: boolean
  delay?: number
}) {
  return (
    <m.span
      className="overflow-hidden whitespace-nowrap leading-none"
      animate={{ maxWidth: expanded ? 200 : 0, opacity: expanded ? 1 : 0 }}
      transition={animate ? LABEL_T(delay) : INSTANT}
    >
      {children}
    </m.span>
  )
}

function SheetTreeChild({
  child,
  activeHref,
  onNavigate,
}: {
  child: NavLeaf
  activeHref: string | undefined
  onNavigate?: () => void
}) {
  const isActive = !child.disabled && activeHref === child.href
  const Icon = getNavIcon(child.icon)
  const className = cn(
    'relative flex h-full w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs/relaxed',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
    child.disabled
      ? 'cursor-not-allowed select-none opacity-35'
      : '[transition:background-color_150ms_cubic-bezier(0.23,1,0.32,1),transform_110ms_ease-out] hover:bg-sidebar-accent active:scale-[0.98]',
    isActive &&
      'bg-sidebar-accent dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)]',
  )

  const inner = (
    <>
      <span className={cn('inline-flex shrink-0', isActive && 'text-primary')}>
        <Icon size={20} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            'block text-xs/relaxed leading-none',
            isActive
              ? 'font-semibold text-foreground'
              : 'font-medium text-muted-foreground',
          )}
        >
          {child.label}
        </span>
        {child.description ? (
          <span className="mt-1 block text-xs/relaxed leading-none text-muted-foreground">
            {child.description}
          </span>
        ) : null}
      </span>
    </>
  )

  if (child.disabled) {
    return (
      <span aria-disabled="true" className={className}>
        {inner}
      </span>
    )
  }

  return (
    <Link
      href={child.href}
      aria-current={isActive ? 'page' : undefined}
      className={className}
      onClick={onNavigate}
    >
      <NavPendingSurface>{inner}</NavPendingSurface>
    </Link>
  )
}

function NavChildLink({
  child,
  activeHref,
  density,
  inset,
  onNavigate,
}: {
  child: NavLeaf
  activeHref: string | undefined
  density: NavTreeDensity
  inset: 'tree' | 'flyout'
  onNavigate?: () => void
}) {
  if (density === 'sheet' && inset === 'tree') {
    return <SheetTreeChild child={child} activeHref={activeHref} onNavigate={onNavigate} />
  }

  const isActive = !child.disabled && activeHref === child.href
  const isFlyout = inset === 'flyout'
  const Icon = getNavIcon(child.icon)
  const className = cn(
    'relative z-10 flex w-full text-xs/relaxed transition-colors duration-150',
    isFlyout
      ? 'group/nav items-start gap-2.5 rounded-lg px-2 py-2'
      : 'h-10 items-center gap-2 rounded-md px-2.5',
    child.disabled
      ? 'cursor-not-allowed text-muted-foreground opacity-40'
      : cn(
          'text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          isFlyout ? 'hover:bg-accent' : 'hover:bg-sidebar-accent',
        ),
    isActive &&
      'bg-sidebar-accent font-semibold text-foreground dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)]',
  )

  const inner = isFlyout ? (
    <>
      <span
        className={cn(
          'flex size-[32px] shrink-0 items-center justify-center rounded-md',
          isActive ? 'bg-primary/10 text-primary' : 'bg-accent text-muted-foreground',
        )}
      >
        <Icon size={16} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block leading-none font-medium text-foreground">
          {child.label}
        </span>
        {child.description ? (
          <span className="mt-1 block text-xs/relaxed leading-snug text-muted-foreground">
            {child.description}
          </span>
        ) : null}
      </span>
      <RiArrowRightSLine
        size={14}
        aria-hidden="true"
        className="mt-1 shrink-0 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover/nav:opacity-100 group-focus-visible/nav:opacity-100"
      />
    </>
  ) : (
    <>
      <span className={cn('inline-flex shrink-0', isActive && 'text-primary')}>
        <Icon size={16} aria-hidden="true" />
      </span>
      {child.label}
    </>
  )

  if (child.disabled) {
    return <span aria-disabled="true" className={className}>{inner}</span>
  }

  return (
    <Link
      href={child.href}
      role={isFlyout ? 'menuitem' : undefined}
      aria-current={isActive ? 'page' : undefined}
      className={className}
      onClick={onNavigate}
    >
      <NavPendingSurface>{inner}</NavPendingSurface>
    </Link>
  )
}

function NavLeafRow({
  item,
  index,
  activeHref,
  density,
  collapsed,
  animate,
  onNavigate,
}: {
  item: NavLeaf
  index: number
  activeHref: string | undefined
  density: NavTreeDensity
  collapsed: boolean
  animate: boolean
  onNavigate?: () => void
}) {
  const Icon = getNavIcon(item.icon)
  const isActive = !item.disabled && activeHref === item.href

  if (density === 'sheet') {
    const content = (
      <>
        <span
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors duration-150',
            isActive ? 'bg-primary/10 text-primary' : 'bg-accent text-muted-foreground',
          )}
        >
          <Icon size={20} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span
            className={cn(
              'block text-xs/relaxed leading-none',
              isActive ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground',
            )}
          >
            {item.label}
          </span>
          {item.description ? (
            <span className="mt-1 block text-xs/relaxed leading-none text-muted-foreground">
              {item.description}
            </span>
          ) : null}
        </span>
      </>
    )

    if (item.disabled) {
      return (
        <div
          aria-disabled="true"
          className="flex min-h-11 cursor-not-allowed select-none items-center gap-4 rounded-xl px-3 py-3 opacity-35"
        >
          {content}
        </div>
      )
    }

    return (
      <Link
        href={item.href}
        aria-current={isActive ? 'page' : undefined}
        onClick={onNavigate}
        className={cn(
          'relative flex min-h-11 items-center gap-4 rounded-xl px-3 py-3',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          '[transition:background-color_150ms_cubic-bezier(0.23,1,0.32,1),transform_110ms_ease-out]',
          'hover:bg-accent active:scale-[0.98]',
          isActive && 'bg-sidebar-accent',
        )}
      >
        <NavPendingSurface>{content}</NavPendingSurface>
      </Link>
    )
  }

  const rowClassName = cn(
    'relative flex h-10 w-full items-center rounded-md text-xs/relaxed transition-colors duration-150',
    collapsed
      ? 'justify-center gap-0 px-0 text-muted-foreground'
      : 'gap-3 px-3 text-muted-foreground',
    item.disabled
      ? 'cursor-not-allowed opacity-40'
      : 'hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
    isActive &&
      'bg-sidebar-accent font-semibold text-foreground dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)]',
  )

  const rowContent = (
    <>
      <span className={cn('inline-flex shrink-0', isActive && 'text-primary')}>
        <Icon size={18} aria-hidden="true" />
      </span>
      <SidebarLabel expanded={!collapsed} animate={animate} delay={index * 0.03}>
        {item.label}
      </SidebarLabel>
    </>
  )

  const row = item.disabled ? (
    <span aria-disabled="true" className={rowClassName}>{rowContent}</span>
  ) : (
    <Link
      href={item.href}
      aria-current={isActive ? 'page' : undefined}
      className={rowClassName}
      onClick={onNavigate}
    >
      <NavPendingSurface>{rowContent}</NavPendingSurface>
    </Link>
  )

  if (!collapsed) return row

  return (
    <Tooltip>
      <TooltipTrigger render={<span className="block w-full" />}>
        {row}
      </TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  )
}

function NavGroupBlock({
  item,
  index,
  pathname,
  density,
  collapsed,
  animate,
  onNavigate,
}: {
  item: NavGroup
  index: number
  pathname: string
  density: NavTreeDensity
  collapsed: boolean
  animate: boolean
  onNavigate?: () => void
}) {
  const groupActive = isGroupActive(pathname, item)
  const activeHref = getActiveHref(pathname, item.children)
  const [open, setOpen] = useState(groupActive)
  const [flyoutOpen, setFlyoutOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const flyoutRef = useRef<HTMLDivElement>(null)
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [flyoutPosition, setFlyoutPosition] = useState<{ top: number; left: number } | null>(null)
  const panelId = useId()
  const Icon = getNavIcon(item.icon)
  const isSheet = density === 'sheet'
  const parentLit = open || groupActive
  const reduceMotion = Boolean(useReducedMotion())

  function clearOpenTimer() {
    if (openTimer.current === null) return
    clearTimeout(openTimer.current)
    openTimer.current = null
  }

  function clearCloseTimer() {
    if (closeTimer.current === null) return
    clearTimeout(closeTimer.current)
    closeTimer.current = null
  }

  function measureFlyout() {
    const rect = rootRef.current?.getBoundingClientRect()
    if (rect) setFlyoutPosition({ top: rect.top, left: rect.right + 12 })
  }

  function hideFlyout() {
    clearOpenTimer()
    clearCloseTimer()
    closeTimer.current = setTimeout(() => {
      setFlyoutOpen(false)
      closeTimer.current = null
    }, FLYOUT_CLOSE_DELAY)
  }

  function showFlyout() {
    clearOpenTimer()
    clearCloseTimer()
    openTimer.current = setTimeout(() => {
      measureFlyout()
      setFlyoutOpen(true)
      openTimer.current = null
    }, FLYOUT_OPEN_DELAY)
  }

  function openFlyoutNow() {
    clearOpenTimer()
    clearCloseTimer()
    measureFlyout()
    setFlyoutOpen(true)
  }

  const navigationKey = `${pathname}|${collapsed}`
  const [syncedNavigationKey, setSyncedNavigationKey] = useState(navigationKey)
  if (syncedNavigationKey !== navigationKey) {
    setSyncedNavigationKey(navigationKey)
    if (groupActive) setOpen(true)
    setFlyoutOpen(false)
  }

  useEffect(() => {
    clearOpenTimer()
    clearCloseTimer()
  }, [pathname, collapsed])

  useEffect(() => () => {
    clearOpenTimer()
    clearCloseTimer()
  }, [])

  useEffect(() => {
    if (!flyoutOpen) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      hideFlyout()
      rootRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    }

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || flyoutRef.current?.contains(target)) return
      hideFlyout()
    }

    function onViewportChange() {
      measureFlyout()
    }

    window.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('resize', onViewportChange)
    window.addEventListener('scroll', onViewportChange, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('resize', onViewportChange)
      window.removeEventListener('scroll', onViewportChange, true)
    }
  }, [flyoutOpen])

  const chevron = !collapsed ? (
    <RiArrowDownSLine
      size={16}
      aria-hidden="true"
      className={cn(
        'ml-auto shrink-0 transition-transform duration-[180ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none',
        open && 'rotate-180',
      )}
    />
  ) : null

  const rail = RAIL[density]
  const childrenList = (
    <div className="relative">
      <div aria-hidden="true" className="mx-1 h-px" />
      <div className="relative">
        <TreeRail count={item.children.length} rail={rail} />
        <ul id={collapsed ? undefined : panelId} className="flex flex-col gap-1 pt-2 pb-1">
          {item.children.map((child) => (
            <li
              key={child.href}
              className="relative z-10"
              style={{ paddingLeft: rail.childPad, height: rail.row }}
            >
              <NavChildLink
                child={child}
                activeHref={activeHref}
                density={density}
                inset="tree"
                onNavigate={onNavigate}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )

  if (isSheet) {
    return (
      <div
        className={cn(
          'relative overflow-hidden rounded-xl p-0 transition-[padding,background-color] duration-[180ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:duration-0',
          open && 'bg-accent p-1',
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="lg"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((current) => !current)}
          className={cn(
            'relative z-10 flex min-h-11 w-full cursor-pointer items-center gap-4 px-3 py-3',
            open ? 'rounded-t-xl' : 'rounded-xl',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            '[transition:background-color_150ms_cubic-bezier(0.23,1,0.32,1),transform_110ms_ease-out]',
            'hover:bg-accent active:scale-[0.98]',
            !open && parentLit && 'bg-sidebar-accent',
          )}
        >
          <span
            className={cn(
              'flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors duration-150',
              parentLit ? 'bg-primary/10 text-primary' : 'bg-accent text-muted-foreground',
            )}
          >
            <Icon size={20} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span
              className={cn(
                'block text-xs/relaxed leading-none',
                parentLit ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground',
              )}
            >
              {item.label}
            </span>
            {item.description ? (
              <span className="mt-1 block text-xs/relaxed leading-none text-muted-foreground">
                {item.description}
              </span>
            ) : null}
          </span>
          {chevron}
        </Button>
        <m.div
          initial={false}
          animate={{ height: open ? 'auto' : 0 }}
          transition={reduceMotion ? INSTANT : { duration: 0.18, ease: EASE }}
          className="overflow-hidden"
          {...(!open ? { inert: true } : {})}
        >
          {childrenList}
        </m.div>
      </div>
    )
  }

  const flyoutVariants = reduceMotion ? FLYOUT_REDUCED : FLYOUT_VARIANTS

  return (
    <div
      ref={rootRef}
      className={cn(
        'relative w-full',
        !collapsed &&
          'overflow-hidden rounded-md p-0 transition-[padding,background-color] duration-[180ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:duration-0',
        !collapsed && open && 'bg-accent p-1',
      )}
      onMouseEnter={() => collapsed && showFlyout()}
      onMouseLeave={() => collapsed && hideFlyout()}
      onFocusCapture={() => collapsed && showFlyout()}
      onBlurCapture={(event) => {
        if (!collapsed) return
        const next = event.relatedTarget as Node | null
        if (next && event.currentTarget.contains(next)) return
        if (next && flyoutRef.current?.contains(next)) return
        hideFlyout()
      }}
    >
      <Button
        type="button"
        variant="ghost"
        size="lg"
        aria-label={collapsed ? item.label : undefined}
        aria-expanded={collapsed ? flyoutOpen : open}
        aria-controls={collapsed ? (flyoutOpen ? panelId : undefined) : panelId}
        aria-haspopup={collapsed ? 'menu' : undefined}
        onClick={() => {
          if (collapsed) return openFlyoutNow()
          setOpen((current) => !current)
        }}
        className={cn(
          'relative z-10 flex h-10 w-full cursor-pointer items-center text-xs/relaxed transition-colors duration-150',
          collapsed
            ? 'justify-center gap-0 rounded-md px-0 text-muted-foreground'
            : cn('gap-3 px-3 text-muted-foreground', open ? 'rounded-t-md' : 'rounded-md'),
          'hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          collapsed
            ? groupActive &&
                'bg-sidebar-accent font-semibold text-foreground dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)]'
            : cn(
                parentLit && 'font-semibold text-foreground',
                !open && parentLit &&
                  'bg-sidebar-accent dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)]',
              ),
        )}
      >
        <span
          className={cn(
            'inline-flex shrink-0',
            (collapsed ? groupActive : parentLit) && 'text-primary',
          )}
        >
          <Icon size={18} aria-hidden="true" />
        </span>
        <SidebarLabel expanded={!collapsed} animate={animate} delay={index * 0.03}>
          {item.label}
        </SidebarLabel>
        {chevron}
      </Button>

      {typeof document !== 'undefined' && collapsed
        ? createPortal(
            <AnimatePresence>
              {flyoutOpen ? (
                <m.div
                  key="scrim"
                  aria-hidden="true"
                  variants={reduceMotion ? SCRIM_REDUCED : SCRIM_VARIANTS}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  className={cn(
                    'pointer-events-none fixed inset-y-0 right-0 left-16 z-30 hidden md:block',
                    reduceMotion ? 'bg-background/70' : 'bg-background/50 backdrop-blur-[6px]',
                  )}
                />
              ) : null}
              {flyoutOpen && flyoutPosition ? (
                <m.div
                  key="flyout"
                  ref={flyoutRef}
                  id={panelId}
                  role="menu"
                  aria-label={item.label}
                  variants={flyoutVariants}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  onMouseEnter={openFlyoutNow}
                  onMouseLeave={hideFlyout}
                  className="fixed z-50 w-72 overflow-visible rounded-xl border border-border bg-popover p-1.5 shadow-lg"
                  style={{
                    top: flyoutPosition.top,
                    left: flyoutPosition.left,
                    transformOrigin: 'left 20px',
                  }}
                >
                  <div aria-hidden="true" className="absolute top-0 right-full h-10 w-3" />
                  <span
                    aria-hidden="true"
                    className="absolute top-[15px] -left-[5px] size-2.5 rotate-45 border-b border-l border-border bg-popover"
                  />
                  <div className="relative mb-1 flex items-start gap-2.5 px-2 py-2">
                    <span
                      aria-hidden="true"
                      className="absolute top-2.5 bottom-2.5 left-0 w-0.5 rounded-full bg-primary"
                    />
                    <span className="flex size-[32px] shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon size={16} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 pt-0.5">
                      <span className="block text-xs/relaxed leading-none font-semibold text-foreground">
                        {item.label}
                      </span>
                      {item.description ? (
                        <span className="mt-1 block text-xs/relaxed leading-snug text-muted-foreground">
                          {item.description}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <div aria-hidden="true" className="mx-1.5 mb-1 h-px bg-border/70" />
                  <ul className="flex max-h-[min(24rem,calc(100dvh-6rem))] flex-col gap-0.5 overflow-y-auto">
                    {item.children.map((child) => (
                      <li key={child.href}>
                        <NavChildLink
                          child={child}
                          activeHref={activeHref}
                          density="sidebar"
                          inset="flyout"
                          onNavigate={() => {
                            setFlyoutOpen(false)
                            onNavigate?.()
                          }}
                        />
                      </li>
                    ))}
                  </ul>
                </m.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}

      {!collapsed ? (
        <m.div
          initial={false}
          animate={{ height: open ? 'auto' : 0 }}
          transition={reduceMotion ? INSTANT : { duration: 0.18, ease: EASE }}
          className="overflow-hidden"
          {...(!open ? { inert: true } : {})}
        >
          {childrenList}
        </m.div>
      ) : null}
    </div>
  )
}

export function NavTree({
  items,
  pathname,
  density,
  collapsed = false,
  animate = false,
  onNavigate,
}: NavTreeProps) {
  const activeHref = getActiveHref(pathname, items)

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, index) => (
        <li key={item.kind === 'group' ? item.id : item.href}>
          {item.kind === 'group' ? (
            <NavGroupBlock
              item={item}
              index={index}
              pathname={pathname}
              density={density}
              collapsed={collapsed}
              animate={animate}
              onNavigate={onNavigate}
            />
          ) : (
            <NavLeafRow
              item={item}
              index={index}
              activeHref={activeHref}
              density={density}
              collapsed={collapsed}
              animate={animate}
              onNavigate={onNavigate}
            />
          )}
        </li>
      ))}
    </ul>
  )
}
