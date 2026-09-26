'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import Link, { useLinkStatus } from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'
import { RiHomeLine, RiMenuLine, RiUser3Line } from 'react-icons/ri'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { SignOutButton } from './sign-out-button'
import { CommandPaletteTrigger } from './command-palette'
import { NavTree } from './nav-tree'
import { externalPathname } from './navigation'
import type { TavviShellConfig } from './navigation.types'

type MobilePanel = 'none' | 'profile' | 'pages'

const EASE = [0.23, 1, 0.32, 1] as const

const SHEET_VARIANTS = {
  hidden: { opacity: 0, y: '100%' },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE } },
  exit: { opacity: 0, y: '100%', transition: { duration: 0.16, ease: EASE } },
}

const SHEET_REDUCED = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.12 } },
}

const POPOVER_VARIANTS = {
  hidden: { opacity: 0, scale: 0.96, y: 6 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.18, ease: EASE },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: 6,
    transition: { duration: 0.13, ease: EASE },
  },
}

const POPOVER_REDUCED = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.12 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
}

const SCRIM_VARIANTS = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
}

const PROFILE_PANEL_ID = 'mobile-profile-panel'
const PAGES_PANEL_ID = 'mobile-pages-panel'
const DOCK_BOTTOM = 'calc(0.75rem + env(safe-area-inset-bottom))'
const PANEL_BOTTOM = 'calc(5.5rem + env(safe-area-inset-bottom))'

function HomePendingSurface({ children }: { children: ReactNode }) {
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
          <Spinner aria-hidden="true" className="relative size-[20px] text-foreground" />
        </span>
      ) : null}
    </>
  )
}

function usePanelFocusTrap(
  panelRef: React.RefObject<HTMLElement | null>,
  active: boolean,
) {
  useEffect(() => {
    if (!active || !panelRef.current) return
    const panel = panelRef.current
    const getFocusable = () =>
      [...panel.querySelectorAll<HTMLElement>(
        'a[href], button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])',
      )].filter((node) => !node.closest('[aria-disabled="true"]'))

    getFocusable()[0]?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Tab') return
      const focusable = getFocusable()
      if (!focusable.length) {
        event.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    panel.addEventListener('keydown', onKeyDown)
    return () => panel.removeEventListener('keydown', onKeyDown)
  }, [active, panelRef])
}

export function MobileNavigation({ config }: { config: TavviShellConfig }) {
  const [panel, setPanel] = useState<MobilePanel>('none')
  const pathname = usePathname()
  const reduced = useReducedMotion()
  const profileButtonRef = useRef<HTMLButtonElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const profilePanelRef = useRef<HTMLDivElement>(null)
  const pagesPanelRef = useRef<HTMLDivElement>(null)

  const close = useCallback((restoreFocus = true) => {
    setPanel((previous) => {
      if (restoreFocus) {
        const trigger = previous === 'profile'
          ? profileButtonRef.current
          : previous === 'pages'
            ? menuButtonRef.current
            : null
        if (trigger) requestAnimationFrame(() => trigger.focus())
      }
      return 'none'
    })
  }, [])

  const togglePanel = useCallback((nextPanel: Exclude<MobilePanel, 'none'>) => {
    setPanel((current) => current === nextPanel ? 'none' : nextPanel)
  }, [])

  useEffect(() => {
    setPanel('none')
  }, [pathname])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat) return
      const target = event.target
      const editable = target instanceof HTMLElement && (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
        target.isContentEditable
      )

      if (
        !editable &&
        (event.ctrlKey || event.metaKey) &&
        event.code === 'KeyB' &&
        window.matchMedia('(max-width: 767px)').matches
      ) {
        event.preventDefault()
        togglePanel('pages')
        return
      }

      if (event.key === 'Escape' && panel !== 'none') close(true)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [close, panel, togglePanel])

  useEffect(() => {
    if (panel !== 'pages') return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [panel])

  usePanelFocusTrap(profilePanelRef, panel === 'profile')
  usePanelFocusTrap(pagesPanelRef, panel === 'pages')

  const isHome = externalPathname(pathname) === config.homeHref
  const sheetVariants = reduced ? SHEET_REDUCED : SHEET_VARIANTS
  const popoverVariants = reduced ? POPOVER_REDUCED : POPOVER_VARIANTS

  return (
    <>
      <AnimatePresence>
        {panel === 'pages' ? (
          <m.div
            key="scrim"
            variants={SCRIM_VARIANTS}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-30 bg-foreground/45 md:hidden"
            aria-hidden="true"
            onClick={() => close(true)}
          />
        ) : null}
      </AnimatePresence>

      {panel === 'profile' ? (
        <div
          className="fixed inset-0 z-30 md:hidden"
          aria-hidden="true"
          onClick={() => close(true)}
        />
      ) : null}

      <AnimatePresence>
        {panel === 'profile' ? (
          <m.div
            ref={profilePanelRef}
            key="profile-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Conta"
            id={PROFILE_PANEL_ID}
            variants={popoverVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed left-3 z-40 w-56 rounded-2xl border border-border bg-popover/90 p-1.5 shadow-md backdrop-blur-xl md:hidden"
            style={{ bottom: PANEL_BOTTOM, transformOrigin: 'bottom left' }}
          >
            <div className="px-3 py-2.5 select-none">
              <p className="text-xs/relaxed font-semibold leading-none text-foreground">
                Conta
              </p>
              <p className="mt-1 truncate text-xs/relaxed leading-none text-muted-foreground">
                {config.userLabel ?? 'Preferências da sessão'}
              </p>
            </div>
            <div className="mx-1.5 my-1 h-px bg-border/70" />
            <ThemeToggle label="Alternar tema" className="h-11 rounded-xl" />
            <SignOutButton className="h-11 rounded-xl" />
          </m.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {panel === 'pages' ? (
          <m.div
            ref={pagesPanelRef}
            key="pages-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Navegação"
            id={PAGES_PANEL_ID}
            variants={sheetVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed right-3 left-3 z-40 flex flex-col overflow-hidden rounded-2xl border border-border bg-popover/90 shadow-md backdrop-blur-xl md:hidden"
            style={{
              bottom: PANEL_BOTTOM,
              maxHeight: 'min(calc(100dvh - 9rem - env(safe-area-inset-top) - env(safe-area-inset-bottom)), 520px)',
            }}
          >
            <div className="pointer-events-none flex shrink-0 justify-center pt-3 pb-0.5 select-none">
              <div className="h-1 w-9 rounded-full bg-border" />
            </div>
            <div className="shrink-0 px-5 pt-2.5 pb-4 select-none">
              <p className="font-heading text-xl font-semibold tracking-tight text-foreground">
                Navegação
              </p>
              <p className="mt-0.5 text-xs/relaxed text-muted-foreground">
                {config.contextLabel ?? 'Acesse as áreas do Tavvi'}
              </p>
            </div>
            <div className="min-h-0 overflow-y-auto overscroll-contain px-3 pb-4">
              <CommandPaletteTrigger
                className="mb-3"
                onOpen={() => close(false)}
              />
              <NavTree
                items={config.items}
                pathname={pathname}
                density="sheet"
                onNavigate={() => close(false)}
              />
            </div>
          </m.div>
        ) : null}
      </AnimatePresence>

      <nav
        aria-label="Navegação móvel"
        className="fixed right-3 left-3 z-50 md:hidden"
        style={{ bottom: DOCK_BOTTOM }}
      >
        <div className="relative grid h-[68px] grid-cols-3 items-center rounded-2xl border border-sidebar-border bg-sidebar/80 px-3 shadow-md backdrop-blur-xl">
          <div className="flex justify-start">
            <Button
              ref={profileButtonRef}
              type="button"
              variant="ghost"
              size="icon-lg"
              onClick={() => togglePanel('profile')}
              aria-label={panel === 'profile' ? 'Fechar perfil' : 'Abrir perfil'}
              aria-expanded={panel === 'profile'}
              aria-controls={PROFILE_PANEL_ID}
              className={cn(
                'flex size-11 items-center justify-center rounded-xl',
                '[transition:background-color_150ms_cubic-bezier(0.23,1,0.32,1),color_150ms_cubic-bezier(0.23,1,0.32,1),transform_100ms_ease-out]',
                'hover:bg-accent hover:text-foreground active:scale-[0.93]',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                panel === 'profile'
                  ? 'bg-sidebar-accent text-foreground'
                  : 'text-muted-foreground',
              )}
            >
              <RiUser3Line size={21} aria-hidden="true" />
            </Button>
          </div>

          <div className="flex justify-center">
            <Link
              href={config.homeHref}
              aria-label="Ir para o início"
              aria-current={isHome ? 'page' : undefined}
              className={cn(
                'relative flex size-[58px] -translate-y-[14px] items-center justify-center rounded-[18px] shadow-md',
                '[transition:background-color_160ms_cubic-bezier(0.23,1,0.32,1),color_160ms_cubic-bezier(0.23,1,0.32,1),transform_110ms_ease-out]',
                'active:scale-[0.92] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                isHome
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-popover text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <HomePendingSurface>
                <RiHomeLine size={23} aria-hidden="true" />
              </HomePendingSurface>
            </Link>
          </div>

          <div className="flex justify-end">
            <Button
              ref={menuButtonRef}
              type="button"
              variant="ghost"
              size="icon-lg"
              onClick={() => togglePanel('pages')}
              aria-label={panel === 'pages' ? 'Fechar navegação' : 'Abrir navegação'}
              aria-expanded={panel === 'pages'}
              aria-controls={PAGES_PANEL_ID}
              className={cn(
                'flex size-11 items-center justify-center rounded-xl',
                '[transition:background-color_150ms_cubic-bezier(0.23,1,0.32,1),color_150ms_cubic-bezier(0.23,1,0.32,1),transform_100ms_ease-out]',
                'hover:bg-accent hover:text-foreground active:scale-[0.93]',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                panel === 'pages'
                  ? 'bg-sidebar-accent text-foreground'
                  : 'text-muted-foreground',
              )}
            >
              <RiMenuLine size={21} aria-hidden="true" />
            </Button>
          </div>
        </div>
      </nav>
    </>
  )
}
