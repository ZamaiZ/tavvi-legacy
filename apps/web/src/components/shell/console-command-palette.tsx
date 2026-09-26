'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { LuArrowRight, LuPlus, LuSearch, LuSunMoon, LuX } from 'react-icons/lu'
import { useTheme } from '@/components/theme/theme-provider'
import type { ConsoleLeaf } from './console-config'
import { getActiveConsoleLeaf } from './console-config'
import { usePathname, useRouter } from 'next/navigation'
import { toExternalPath } from '@/lib/route-paths'

export function CommandPalette({ leaves, open, onClose, onNewInvite }: {
  leaves: ConsoleLeaf[]
  open: boolean
  onClose: () => void
  onNewInvite?: () => void
}) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const pathname = usePathname()
  const activeLeaf = getActiveConsoleLeaf(toExternalPath(pathname), leaves)
  const { theme, setTheme } = useTheme()
  const rows = useMemo(() => {
    const pages = leaves.map((leaf) => ({ key: leaf.key, label: leaf.label, type: 'Página', href: leaf.href, leaf }))
    const actions = [
      ...(onNewInvite ? [{ key: 'new-invite', label: 'Novo convite', type: 'Ação', action: onNewInvite }] : []),
      { key: 'theme', label: 'Alternar tema', type: 'Ação', action: () => setTheme(theme === 'dark' ? 'light' : 'dark') },
    ]
    return [...pages, ...actions].filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()))
  }, [leaves, onNewInvite, query, setTheme, theme])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActive(0)
    requestAnimationFrame(() => inputRef.current?.focus())
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowDown') { event.preventDefault(); setActive((index) => Math.min(rows.length - 1, index + 1)) }
      if (event.key === 'ArrowUp') { event.preventDefault(); setActive((index) => Math.max(0, index - 1)) }
      if (event.key === 'Enter' && rows[active]) {
        const item = rows[active]
        if ('href' in item) router.push(item.href)
        else item.action()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [active, onClose, open, router, rows])

  if (!open) return null
  return <div className="tv-command-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section role="dialog" aria-modal="true" aria-label="Buscar página ou ação" className="tv-command-box">
      <div className="tv-command-input"><LuSearch aria-hidden="true" /><input ref={inputRef} value={query} onChange={(event) => { setQuery(event.target.value); setActive(0) }} placeholder="Buscar página ou ação" /><kbd>Esc</kbd><button type="button" aria-label="Fechar busca" onClick={onClose}><LuX /></button></div>
      <div role="listbox" aria-label="Resultados" className="tv-command-results">
        {rows.length ? rows.map((row, index) => {
          const selected = index === active
          if ('href' in row) return <Link key={row.key} href={row.href} role="option" aria-selected={selected} aria-current={activeLeaf?.key === row.leaf.key ? 'page' : undefined} className={`tv-command-row${selected ? ' is-selected' : ''}`} onClick={onClose}><span>{row.label}</span><small>{row.type}</small></Link>
          const Icon = row.key === 'theme' ? LuSunMoon : LuPlus
          return <button key={row.key} type="button" role="option" aria-selected={selected} className={`tv-command-row${selected ? ' is-selected' : ''}`} onClick={() => { row.action(); onClose() }}><span><Icon aria-hidden="true" />{row.label}</span><small>{row.type}<LuArrowRight /></small></button>
        }) : <p className="tv-command-empty">Nada encontrado.</p>}
      </div>
    </section>
  </div>
}
