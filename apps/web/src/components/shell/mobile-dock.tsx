'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { toExternalPath } from '@/lib/route-paths'
import { LuBookOpen, LuContact, LuHouse, LuMenu, LuMoon, LuPalette, LuSun, LuMonitor, LuStore, LuMail, LuUsers, LuUserRound, LuX, LuLogOut } from 'react-icons/lu'
import { useTheme, type Theme } from '@/components/theme/theme-provider'
import { signOutAction } from '@/server/actions/auth'
import type { ConsoleLeaf } from './console-config'
import { getActiveConsoleLeaf } from './console-config'

const themes: Record<Theme, { label: string; Icon: typeof LuSun }> = {
  system: { label: 'Sistema', Icon: LuMonitor },
  light: { label: 'Claro', Icon: LuSun },
  dark: { label: 'Escuro', Icon: LuMoon },
}

export function MobileDock({ leaves, email, description, counts, homeHref }: { leaves: ConsoleLeaf[]; email: string | null; description: string | null; counts: { pendingInvites: number; restaurants: number }; homeHref: string }) {
  const [panel, setPanel] = useState<'account' | 'menu' | null>(null)
  const [pending, setPending] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const { theme, setTheme } = useTheme()
  const pathname = usePathname()
  const activeLeaf = getActiveConsoleLeaf(toExternalPath(pathname), leaves)
  const [systemDark, setSystemDark] = useState(false)
  const activeTheme = themes[theme]
  const cycleTheme = () => setTheme(theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system')
  useEffect(() => {
    setSystemDark(document.documentElement.classList.contains('dark'))
  }, [theme])
  useEffect(() => {
    if (!panel) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setPanel(null)
      if (event.key === 'Tab' && panelRef.current) {
        const items = panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)')
        if (!items.length) return
        const first = items[0]
        const last = items[items.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    const prior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>('button, a[href]')?.focus())
    document.addEventListener('keydown', onKeyDown)
    return () => { document.body.style.overflow = prior; document.removeEventListener('keydown', onKeyDown) }
  }, [panel])
  const icons = { mail: LuMail, store: LuStore, menu: LuBookOpen, palette: LuPalette, contact: LuContact, team: LuUsers } as const
  const links = leaves.map((leaf) => ({ leaf, Icon: icons[leaf.icon] }))
  return <>
    {panel && <><button className="tv-mobile-scrim" aria-label="Fechar painel" onClick={() => setPanel(null)} /><div ref={panelRef} className={`tv-mobile-panel tv-mobile-${panel}`} role="dialog" aria-modal="true" aria-label={panel === 'account' ? 'Conta' : 'Navegação'}>
      {panel === 'account' ? <>
        <div className="tv-account-head"><span className="tv-account-avatar">{email?.trim().slice(0, 1).toUpperCase() || 'A'}</span><span className="tv-account-user"><strong>{email ?? 'Conta'}</strong><small>{description ?? 'Administrador da plataforma'}</small></span><button type="button" className="tv-icon-button" aria-label="Fechar conta" onClick={() => setPanel(null)}><LuX /></button></div>
        <div className="tv-mobile-theme"><span><small>Tema</small><strong>{activeTheme.label}{theme === 'system' ? ' · ' + (systemDark ? 'Escuro' : 'Claro') : ''}</strong></span><button type="button" aria-label="Alterar tema" onClick={cycleTheme}><activeTheme.Icon /></button></div>
        <button type="button" className="tv-signout-button" disabled={pending} onClick={async () => { setPending(true); await signOutAction() }}><LuLogOut />{pending ? 'Saindo…' : 'Sair'}</button>
      </> : <>
        <div className="tv-mobile-menu-head"><span>NAVEGAÇÃO</span><button type="button" className="tv-icon-button" aria-label="Fechar navegação" onClick={() => setPanel(null)}><LuX /></button></div>
        {links.map(({ leaf, Icon }) => {
          const count = leaf.key === 'invites' ? `${counts.pendingInvites} pendentes` : leaf.key === 'restaurants' ? counts.restaurants : null
          return <Link key={leaf.key} href={leaf.href} onClick={() => setPanel(null)} className={`tv-mobile-nav-row${activeLeaf?.key === leaf.key ? ' is-active' : ''}`}><span className="tv-mobile-nav-icon"><Icon /></span><span><strong>{leaf.label}</strong><small>{leaf.sub}</small></span>{count !== null && <span className="tv-mobile-nav-count">{count}</span>}</Link>
        })}
      </>}
    </div></>}
    <nav className="tv-mobile-dock" aria-label="Ações principais">
      <button type="button" aria-label="Conta" aria-expanded={panel === 'account'} className={panel === 'account' ? 'is-open' : ''} onClick={() => setPanel(panel === 'account' ? null : 'account')}><LuUserRound /></button>
      <Link href={homeHref} aria-label="Início" className="tv-mobile-home"><LuHouse /><span>Início</span></Link>
      <button type="button" aria-label="Menu" aria-expanded={panel === 'menu'} className={panel === 'menu' ? 'is-open' : ''} onClick={() => setPanel(panel === 'menu' ? null : 'menu')}><LuMenu /></button>
    </nav>
  </>
}
