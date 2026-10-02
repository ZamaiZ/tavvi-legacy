'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { LuSearch } from 'react-icons/lu'

export type InviteFilter = 'all' | 'pending' | 'redeemed' | 'expired' | 'revoked'

const filters: { value: InviteFilter; label: string }[] = [
  { value: 'all', label: 'Todos' }, { value: 'pending', label: 'Pendentes' },
  { value: 'redeemed', label: 'Resgatados' }, { value: 'expired', label: 'Vencidos' },
  { value: 'revoked', label: 'Revogados' },
]

export function Toolbar({ kind, query, filter, counts, busy = false }: {
  kind: 'invites' | 'restaurants'
  query: string
  filter?: InviteFilter
  counts?: Partial<Record<InviteFilter, number>>
  /** A lista está atualizando por um filtro de fora (os atalhos do topo). */
  busy?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [value, setValue] = useState(query)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Em transição, a lista antiga fica na tela enquanto a nova carrega, e a
  // barra fina avisa que está atualizando.
  const [searching, startUpdate] = useTransition()
  const updating = searching || busy
  useEffect(() => setValue(query), [query])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  function update(nextQuery: string, nextFilter = filter) {
    const params = new URLSearchParams(window.location.search)
    if (nextQuery) params.set('q', nextQuery)
    else params.delete('q')
    if (nextFilter && nextFilter !== 'all') params.set('situacao', nextFilter)
    else params.delete('situacao')
    const encoded = params.toString()
    startUpdate(() => router.replace(`${pathname}${encoded ? `?${encoded}` : ''}`, { scroll: false }))
  }
  return <div className="tv-toolbar" aria-busy={updating || undefined}>
    <label className={`tv-search-field${kind === 'restaurants' ? ' is-wide' : ''}`}><LuSearch aria-hidden="true" /><input aria-label={kind === 'invites' ? 'Buscar por e-mail' : 'Buscar restaurante ou /slug'} placeholder={kind === 'invites' ? 'Buscar por e-mail' : 'Buscar restaurante ou /slug'} value={value} onChange={(event) => { const next = event.target.value; setValue(next); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => update(next), 200) }} /></label>
    {kind === 'invites' && <div className="tv-filter-strip" role="radiogroup" aria-label="Filtrar convites">{filters.map((item) => <button key={item.value} type="button" role="radio" aria-checked={(filter ?? 'all') === item.value} className={(filter ?? 'all') === item.value ? 'is-active' : ''} onClick={() => update(value, item.value)}>{item.label}<small>{counts?.[item.value] ?? 0}</small></button>)}</div>}
    <span className="tv-toolbar-progress" data-active={updating || undefined} aria-hidden="true" />
  </div>
}
