'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { LuSearch } from 'react-icons/lu'

export type InviteFilter = 'all' | 'pending' | 'redeemed' | 'expired' | 'revoked'

const filters: { value: InviteFilter; label: string }[] = [
  { value: 'all', label: 'Todos' }, { value: 'pending', label: 'Pendentes' },
  { value: 'redeemed', label: 'Resgatados' }, { value: 'expired', label: 'Vencidos' },
  { value: 'revoked', label: 'Revogados' },
]

export function Toolbar({ kind, query, filter, counts }: {
  kind: 'invites' | 'restaurants'
  query: string
  filter?: InviteFilter
  counts?: Partial<Record<InviteFilter, number>>
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [value, setValue] = useState(query)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => setValue(query), [query])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  function update(nextQuery: string, nextFilter = filter) {
    const params = new URLSearchParams(window.location.search)
    if (nextQuery) params.set('q', nextQuery)
    else params.delete('q')
    if (nextFilter && nextFilter !== 'all') params.set('situacao', nextFilter)
    else params.delete('situacao')
    const encoded = params.toString()
    router.replace(`${pathname}${encoded ? `?${encoded}` : ''}`, { scroll: false })
  }
  return <div className="tv-toolbar">
    <label className={`tv-search-field${kind === 'restaurants' ? ' is-wide' : ''}`}><LuSearch aria-hidden="true" /><input aria-label={kind === 'invites' ? 'Buscar por e-mail' : 'Buscar restaurante ou /slug'} placeholder={kind === 'invites' ? 'Buscar por e-mail' : 'Buscar restaurante ou /slug'} value={value} onChange={(event) => { const next = event.target.value; setValue(next); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => update(next), 200) }} /></label>
    {kind === 'invites' && <div className="tv-filter-strip" role="radiogroup" aria-label="Filtrar convites">{filters.map((item) => <button key={item.value} type="button" role="radio" aria-checked={(filter ?? 'all') === item.value} className={(filter ?? 'all') === item.value ? 'is-active' : ''} onClick={() => update(value, item.value)}>{item.label}<small>{counts?.[item.value] ?? 0}</small></button>)}</div>}
  </div>
}
