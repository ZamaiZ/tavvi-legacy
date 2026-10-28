'use client'

import { useEffect, useMemo, useState } from 'react'
import { LuCheck, LuSearch, LuX } from 'react-icons/lu'
import { formatTableAccountIdentity, type TableAccountSummaryDTO } from '@/domain/table-account'
import { formatCents } from '@/lib/money'
import { SpinnerRing } from '@/components/ui/spinner'

type CashListFilter = 'active' | 'pending' | 'closed'

export function CashAccountList({
  active,
  pending,
  recentClosed,
  selectedId,
  filter,
  refreshing,
  navigationLocked,
  onFilterChange,
  onSelect,
}: {
  active: TableAccountSummaryDTO[]
  pending: TableAccountSummaryDTO[]
  recentClosed: TableAccountSummaryDTO[]
  selectedId: string | null
  filter: CashListFilter
  refreshing: boolean
  navigationLocked: boolean
  onFilterChange: (filter: CashListFilter) => void
  onSelect: (accountId: string) => void
}) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const source = filter === 'active' ? active : filter === 'pending' ? pending : recentClosed

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [query])

  const visibleAccounts = useMemo(() => {
    if (!debouncedQuery) return source
    const normalize = (value: string) => value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const normalizedQuery = normalize(debouncedQuery)
    return source
      .map((account, index) => ({ account, index }))
      .filter(({ account }) => normalize(formatTableAccountIdentity(account)).includes(normalizedQuery))
      .sort((a, b) => {
        const aExact = formatTableAccountIdentity(a.account) === debouncedQuery
        const bExact = formatTableAccountIdentity(b.account) === debouncedQuery
        return Number(bExact) - Number(aExact) || a.index - b.index
      })
      .map(({ account }) => account)
  }, [debouncedQuery, source])

  return <aside className="tv-cash-accounts" aria-label="Comandas">
    <div className="tv-cash-list-heading">
      <div><strong>Comandas</strong><small>{visibleAccounts.length} de {source.length} {source.length === 1 ? 'comanda' : 'comandas'}</small></div>
      {refreshing ? <SpinnerRing decorative /> : null}
    </div>
    <div className="tv-cash-list-filters" role="group" aria-label="Filtrar comandas">
      <button type="button" aria-pressed={filter === 'active'} className={filter === 'active' ? 'is-active' : ''} onClick={() => onFilterChange('active')}>
        Em andamento <span>{active.length}</span>
      </button>
      <button type="button" aria-pressed={filter === 'pending'} className={filter === 'pending' ? 'is-active' : ''} onClick={() => onFilterChange('pending')}>
        Pendentes <span>{pending.length}</span>
      </button>
      <button type="button" aria-pressed={filter === 'closed'} className={filter === 'closed' ? 'is-active' : ''} onClick={() => onFilterChange('closed')}>
        Fechadas <span>{recentClosed.length}</span>
      </button>
    </div>
    <label className="tv-cash-search">
      <LuSearch aria-hidden="true" />
      <input aria-label="Buscar mesa, nome ou número da comanda" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Mesa, nome ou comanda" />
      {query ? <button type="button" aria-label="Limpar busca" onClick={() => setQuery('')}><LuX aria-hidden="true" /></button> : null}
    </label>
    {query !== debouncedQuery ? <span className="sr-only" role="status">Atualizando resultados da busca</span> : null}

    {visibleAccounts.length ? <ul>
      {visibleAccounts.map((account) => <li key={account.accountId}>
        <button type="button" disabled={navigationLocked} aria-current={selectedId === account.accountId ? 'true' : undefined} className={selectedId === account.accountId ? 'is-selected' : ''} onClick={() => onSelect(account.accountId)}>
          <span className={`tv-cash-table-number${account.status === 'closed' ? ' is-closed' : ''}`}>
            {account.status === 'closed' ? <LuCheck aria-hidden="true" /> : account.tableNumber ?? account.walkInNumber}
          </span>
          <span className="tv-cash-account-copy">
            <strong>{formatTableAccountIdentity(account)}</strong>
            <small>{account.status === 'closed' ? (account.closedAt ? new Date(account.closedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Conta encerrada') : account.status === 'pending' ? 'Pendente · mesa liberada' : account.status === 'settling' ? 'Fechamento iniciado' : 'Conta aberta'}</small>
          </span>
          <span className="tv-cash-account-value"><strong>{formatCents(account.status === 'closed' ? account.totalCents : account.balanceDueCents)}</strong><small>{account.status === 'closed' ? 'total' : 'pendente'}</small></span>
        </button>
      </li>)}
    </ul> : <div className="tv-cash-list-empty" role="status">
      <strong>{source.length ? 'Nenhuma comanda encontrada' : filter === 'active' ? 'Nenhuma comanda em andamento' : filter === 'pending' ? 'Nenhum recebimento pendente' : 'Nenhuma comanda fechada recente'}</strong>
      <span>{source.length ? 'Tente outro nome, mesa ou número de comanda.' : 'As comandas deste grupo aparecerão aqui.'}</span>
    </div>}
  </aside>
}
