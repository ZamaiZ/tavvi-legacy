'use client'

import { LuBell, LuCheck, LuClock3, LuSearch, LuUserRound } from 'react-icons/lu'
import type { ServiceCallDTO, ServiceCallStatus } from '@/domain/service-call'
import { callServiceDuration, callWaitDuration, formatCallTime, formatElapsed } from '../service-call-time'

const STATUS_LABELS: Record<ServiceCallStatus, string> = {
  pending: 'Aguardando',
  in_progress: 'Em atendimento',
  resolved: 'Concluído',
}

export function CallList({ items, selectedId, onSelect, status, memberNames, now, hasMore, emptyReason = 'queue', onClearSearch }: {
  items: ServiceCallDTO[]
  selectedId: string | null
  onSelect: (call: ServiceCallDTO) => void
  status: ServiceCallStatus
  memberNames: Map<string, string>
  now: number
  hasMore: boolean
  emptyReason?: 'queue' | 'search'
  onClearSearch?: () => void
}) {
  if (!items.length) return <div className="tv-calls-empty">
    <span aria-hidden="true">{emptyReason === 'search' ? <LuSearch /> : status === 'resolved' ? <LuCheck /> : <LuBell />}</span>
    <strong>{emptyReason === 'search' ? 'Nenhuma mesa encontrada' : status === 'pending' ? 'Tudo em dia' : status === 'in_progress' ? 'Nenhum chamado em atendimento' : 'Ainda não há chamados concluídos'}</strong>
    <small>{emptyReason === 'search' ? hasMore ? 'A busca considera os chamados já carregados. Carregue mais para procurar nos próximos.' : 'Tente outro número de mesa ou limpe a busca para voltar à fila.' : status === 'pending' ? 'Novos pedidos das mesas aparecem aqui em tempo real.' : status === 'in_progress' ? 'Os chamados assumidos pela equipe aparecem nesta lista.' : 'Os atendimentos concluídos ficam disponíveis neste histórico.'}</small>
    {emptyReason === 'search' && onClearSearch ? <button type="button" className="tv-calls-empty-clear" onClick={onClearSearch}>Limpar busca</button> : null}
  </div>

  return <ul className="tv-calls-list" aria-label={`Chamados: ${STATUS_LABELS[status]}`}>
    {items.map((call) => {
      const elapsed = call.status === 'pending'
        ? formatElapsed(call.createdAt, now)
        : call.status === 'in_progress'
          ? callServiceDuration(call, now) ?? 'Não registrado'
          : callWaitDuration(call) ?? 'Tempo não registrado'
      const detail = call.status === 'pending'
        ? `Aguardando há ${elapsed}`
        : call.status === 'in_progress'
          ? `Em atendimento há ${elapsed}`
          : `Espera de ${elapsed}`
      const assignedName = call.assignedTo ? memberNames.get(call.assignedTo) : null
      return <li key={call.id}>
        <button
          type="button"
          className={`tv-call-row${call.id === selectedId ? ' is-selected' : ''}`}
          aria-current={call.id === selectedId ? 'true' : undefined}
          aria-label={`Mesa ${call.tableNumber}. ${STATUS_LABELS[call.status]}. ${detail}${assignedName ? `. Responsável: ${assignedName}` : ''}. Solicitado às ${formatCallTime(call.createdAt)}.`}
          onClick={() => onSelect(call)}
        >
          <span className={`tv-call-row-icon is-${call.status}`} aria-hidden="true">{call.status === 'resolved' ? <LuCheck /> : call.status === 'pending' ? <LuBell /> : <LuUserRound />}</span>
          <span className="tv-call-row-copy">
            <span className="tv-call-row-topline"><strong>Mesa {call.tableNumber}</strong><span className={`tv-call-state is-${call.status}`}>{STATUS_LABELS[call.status]}</span></span>
            <small>{detail}</small>
            {assignedName ? <small className="tv-call-assignee"><LuUserRound aria-hidden="true" />{assignedName}</small> : null}
          </span>
          <time dateTime={call.createdAt} title={new Date(call.createdAt).toLocaleString('pt-BR')}><LuClock3 aria-hidden="true" />{formatCallTime(call.createdAt)}</time>
        </button>
      </li>
    })}
  </ul>
}
