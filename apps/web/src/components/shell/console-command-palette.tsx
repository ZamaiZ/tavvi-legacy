'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { IconType } from 'react-icons'
import { LuBookOpen, LuContact, LuMail, LuPalette, LuPlus, LuSearch, LuStore, LuUsers, LuCircleUserRound, LuSettings } from 'react-icons/lu'
import { toExternalPath } from '@/lib/route-paths'
import { getActiveConsoleLeaf, type ConsoleIcon, type ConsoleLeaf } from './console-config'
import { getNavIcon } from './navigation-icons'
import { useProgressNavigate } from './navigation-progress'

const icons: Record<ConsoleIcon, IconType> = {
  mail: LuMail,
  store: LuStore,
  restaurant: getNavIcon('restaurant'),
  menu: LuBookOpen,
  palette: LuPalette,
  contact: LuContact,
  team: LuUsers,
  feedback: getNavIcon('feedback'),
  tag: getNavIcon('tag'),
  bell: getNavIcon('bell'),
  cash: getNavIcon('cash'),
  finance: getNavIcon('finance'),
}

type PaletteRow =
  | { key: string; label: string; sub: string; kind: 'Página'; icon: IconType; href: string; group: string; keywords?: string[] }
  | { key: string; label: string; sub: string; kind: 'Ação'; icon: IconType; action: () => void; group: string }

// Paleta ⌘K do console (Tavvi Web.dc.html): páginas e a ação de novo convite.
// O primeiro resultado vem marcado; setas movem e Enter executa.
export function CommandPalette({ leaves, open, onClose, onNewInvite }: {
  leaves: ConsoleLeaf[]
  open: boolean
  onClose: () => void
  onNewInvite?: () => void
}) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  const navigate = useProgressNavigate()
  const pathname = usePathname()
  const activeLeaf = getActiveConsoleLeaf(toExternalPath(pathname), leaves)
  const rows = useMemo<PaletteRow[]>(() => {
    const pages: PaletteRow[] = leaves.map((leaf) => ({ key: leaf.key, label: leaf.label, sub: leaf.sub, kind: 'Página', icon: icons[leaf.icon], href: leaf.href, group: leaf.group ?? 'Navegação', keywords: leaf.keywords }))
    const territoryRoot = pathname.startsWith('/admin/workspace') ? '/admin/workspace' : '/admin'
    pages.push(
      { key: 'account-profile', label: 'Perfil', sub: 'conta e senha', kind: 'Página', icon: LuCircleUserRound, href: toExternalPath(`${territoryRoot}/profile`), group: 'Conta' },
      { key: 'account-settings', label: 'Configurações', sub: 'tema, aparência, notificações', kind: 'Página', icon: LuSettings, href: toExternalPath(`${territoryRoot}/settings`), group: 'Conta' },
    )
    const actions: PaletteRow[] = onNewInvite
      ? [{ key: 'new-invite', label: 'Novo convite', sub: 'Criar um acesso de administrador', kind: 'Ação', icon: LuPlus, action: onNewInvite, group: 'Ações' }]
      : []
    const term = query.trim().toLocaleLowerCase('pt-BR')
    return [...pages, ...actions].filter((row) => !term || `${row.label} ${row.sub} ${row.group} ${'keywords' in row ? row.keywords?.join(' ') ?? '' : ''}`.toLocaleLowerCase('pt-BR').includes(term))
  }, [leaves, onNewInvite, pathname, query])

  function run(row: PaletteRow) {
    onClose()
    if ('href' in row) navigate(row.href)
    else row.action()
  }

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setQuery('')
    setActive(0)
    requestAnimationFrame(() => inputRef.current?.focus())
    return () => previous?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      } else if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActive((index) => Math.min(rows.length - 1, index + 1))
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActive((index) => Math.max(0, index - 1))
      } else if (event.key === 'Enter' && rows[active]) {
        event.preventDefault()
        const row = rows[active]
        onClose()
        if ('href' in row) navigate(row.href)
        else row.action()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [active, navigate, onClose, open, rows])

  if (!open) return null
  const activeId = rows[active] ? `${listId}-${rows[active].key}` : undefined
  return <div className="tv-command-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section role="dialog" aria-modal="true" aria-label="Buscar página ou ação" className="tv-command-box">
      <div className="tv-command-input">
        <LuSearch aria-hidden="true" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => { setQuery(event.target.value); setActive(0) }}
          placeholder="Buscar página ou ação"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={activeId}
          aria-autocomplete="list"
        />
        <kbd>esc</kbd>
      </div>
      <div id={listId} role="listbox" aria-label="Resultados" className="tv-command-results">
        {rows.length ? rows.map((row, index) => {
          const Icon = row.icon
          const selected = index === active
          const previous = rows[index - 1]
          const content = <>
            <span className="tv-command-tile"><Icon aria-hidden="true" /></span>
            <span className="tv-command-copy"><strong>{row.label}</strong><small>{row.sub}</small></span>
            <span className="tv-command-kind">{row.kind}</span>
          </>
          const shared = {
            id: `${listId}-${row.key}`,
            role: 'option' as const,
            'aria-selected': selected,
            tabIndex: -1,
            className: `tv-command-row${selected ? ' is-selected' : ''}`,
            onMouseMove: () => setActive(index),
          }
          return <div key={row.key} className="tv-command-result-group" role="presentation">
            {previous?.group !== row.group ? <h3 className="tv-command-group-label" aria-hidden="true">{row.group}</h3> : null}
            {'href' in row
              ? <Link {...shared} href={row.href} aria-current={activeLeaf?.key === row.key ? 'page' : undefined} onClick={onClose}>{content}</Link>
              : <button {...shared} type="button" onClick={() => run(row)}>{content}</button>}
          </div>
        }) : <p className="tv-command-empty">Nada encontrado.</p>}
      </div>
    </section>
  </div>
}
