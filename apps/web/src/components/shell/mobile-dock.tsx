'use client'

import { useCallback, useEffect, useRef, useState, type Ref } from 'react'
import Link, { useLinkStatus } from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { AnimatePresence, useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'
import { RiHomeLine, RiMenuLine, RiUser3Line } from 'react-icons/ri'
import { SpinnerRing } from '@/components/ui/spinner'
import { toExternalPath } from '@/lib/route-paths'
import { getNavIcon } from './navigation-icons'
import { navigationPathname, pickActiveHref } from './navigation'
import type { SidebarGroup } from './sidebar'
import { useCallArrivalShake } from './use-call-arrival-shake'

const EASE = [0.23, 1, 0.32, 1] as const
const PANEL_ID = 'tv-mobile-pages-panel'

function PendingLink({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus()
  return <span className="tv-dock-pending-wrap">{children}{pending ? <span className="tv-dock-pending"><SpinnerRing decorative /></span> : null}</span>
}

export function MobileDock({
  groups,
  homeHref,
  subtitle,
  accountOpen,
  accountButtonRef,
  onAccount,
  onCloseAccount,
  accountBadge = 0,
  menuBadge = 0,
  callsArrivalKey = 0,
}: {
  groups: SidebarGroup[]
  homeHref: string
  subtitle: string
  accountOpen: boolean
  accountButtonRef: Ref<HTMLButtonElement>
  onAccount: () => void
  onCloseAccount: () => void
  accountBadge?: number
  menuBadge?: number
  callsArrivalKey?: number
}) {
  const pathname = toExternalPath(usePathname())
  const step = useSearchParams().get('passo')
  const reduced = useReducedMotion()
  const [pagesOpen, setPagesOpen] = useState(false)
  const [seenPathname, setSeenPathname] = useState(pathname)
  const menuButtonRef = useCallArrivalShake<HTMLButtonElement>(callsArrivalKey)
  const pagesRef = useRef<HTMLDivElement>(null)

  if (seenPathname !== pathname) {
    setSeenPathname(pathname)
    setPagesOpen(false)
  }

  const closePages = useCallback((restoreFocus = true) => {
    setPagesOpen(false)
    if (restoreFocus) requestAnimationFrame(() => menuButtonRef.current?.focus())
  }, [])

  useEffect(() => {
    function onShortcut(event: KeyboardEvent) {
      if (event.repeat || !(event.ctrlKey || event.metaKey) || event.code !== 'KeyB') return
      if (window.matchMedia('(min-width: 768px)').matches) return
      const target = event.target
      if (target instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)) return
      event.preventDefault()
      onCloseAccount()
      setPagesOpen((open) => !open)
    }
    window.addEventListener('keydown', onShortcut)
    return () => window.removeEventListener('keydown', onShortcut)
  }, [onCloseAccount])

  useEffect(() => {
    if (!pagesOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const desktop = window.matchMedia('(min-width: 768px)')
    const onResize = () => { if (desktop.matches) closePages(false) }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closePages(); return }
      if (event.key !== 'Tab' || !pagesRef.current) return
      const focusable = [...pagesRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')]
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) { event.preventDefault(); return }
      if (!pagesRef.current.contains(document.activeElement)) { event.preventDefault(); first.focus() }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    pagesRef.current?.querySelector<HTMLElement>('button, a[href]')?.focus()
    desktop.addEventListener('change', onResize)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      desktop.removeEventListener('change', onResize)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [closePages, pagesOpen])

  const entries = groups.flatMap((group) => group.entries)
  const activeHref = pickActiveHref(navigationPathname(pathname, step), entries.map((entry) => entry.href))
  const isHome = pathname === homeHref
  const panelMotion = reduced
    ? { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.15 } }, exit: { opacity: 0, transition: { duration: 0.12 } } }
    : { hidden: { opacity: 0, y: '100%' }, visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE } }, exit: { opacity: 0, y: '100%', transition: { duration: 0.16, ease: EASE } } }

  return <>
    <AnimatePresence>
      {pagesOpen ? <m.button key="scrim" type="button" aria-label="Fechar navegação" className="tv-dock-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 0.18 }} onClick={() => closePages()} /> : null}
    </AnimatePresence>
    <AnimatePresence>
      {pagesOpen ? <m.div
        key="pages"
        ref={pagesRef}
        id={PANEL_ID}
        role="dialog"
        aria-modal="true"
        aria-label="Navegação"
        className="tv-dock-pages"
        variants={panelMotion}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        <span className="tv-dock-grip" aria-hidden="true" />
        <header className="tv-dock-pages-head"><h2>Navegação</h2><p>{subtitle}</p></header>
        <nav aria-label="Páginas" className="tv-dock-pages-scroll">
          {groups.map((group) => <section className="tv-dock-section" key={group.label}>
            <h3 className="tv-dock-section-title">{group.label}</h3>
            <ul className="tv-dock-links">
            {group.entries.map((entry) => {
              const Icon = getNavIcon(entry.icon)
              const active = entry.href === activeHref
              return <li key={entry.href}><Link href={entry.href} aria-current={active ? 'page' : undefined} className={`tv-dock-link${active ? ' is-active' : ''}`} onClick={() => closePages(false)}>
                <PendingLink><span className="tv-dock-link-icon"><Icon aria-hidden="true" /></span><span className="tv-dock-link-copy"><strong>{entry.label}</strong>{entry.description ? <small>{entry.description}</small> : null}</span>{entry.count ? <span className="tv-dock-count">{entry.count > 99 ? '99+' : entry.count}</span> : null}</PendingLink>
              </Link></li>
            })}
            </ul>
          </section>)}
        </nav>
      </m.div> : null}
    </AnimatePresence>
    <nav className="tv-dock" aria-label="Navegação móvel">
      <div className="tv-dock-bar">
        <div className="tv-dock-side"><button ref={accountButtonRef} type="button" className={`tv-dock-button${accountOpen ? ' is-active' : ''}`} aria-label={accountOpen ? 'Fechar perfil' : 'Abrir perfil'} aria-haspopup="dialog" aria-expanded={accountOpen} onClick={() => { closePages(false); onAccount() }}><RiUser3Line aria-hidden="true" />{accountBadge > 0 ? <span className="tv-dock-dot"><span className="sr-only">{accountBadge} notificações não lidas</span></span> : null}</button></div>
        <Link href={homeHref} aria-label="Ir para o início" aria-current={isHome ? 'page' : undefined} className={`tv-dock-home${isHome ? ' is-active' : ''}`} onClick={() => { closePages(false); onCloseAccount() }}><PendingLink><RiHomeLine aria-hidden="true" /></PendingLink></Link>
        <div className="tv-dock-side is-end"><button ref={menuButtonRef} type="button" className={`tv-dock-button${pagesOpen ? ' is-active' : ''}`} aria-label={pagesOpen ? 'Fechar navegação' : 'Abrir navegação'} aria-haspopup="dialog" aria-expanded={pagesOpen} aria-controls={PANEL_ID} onClick={() => { onCloseAccount(); setPagesOpen((open) => !open) }}><RiMenuLine aria-hidden="true" />{menuBadge > 0 ? <span className="tv-dock-badge">{menuBadge > 99 ? '99+' : menuBadge}<span className="sr-only"> pendentes</span></span> : null}</button></div>
      </div>
    </nav>
  </>
}
