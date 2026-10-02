'use client'

import { LuBell, LuCheck, LuClock3 } from 'react-icons/lu'
import type { ServiceCallDTO } from '@/domain/service-call'
import { relativeTime } from '@/lib/relative-time'

export function CallList({ items, selectedId, onSelect, status }: {
  items: ServiceCallDTO[]
  selectedId: string | null
  onSelect: (call: ServiceCallDTO) => void
  status: 'pending' | 'resolved'
}) {
  if (!items.length) return <div className="tv-calls-empty"><span aria-hidden="true">{status === 'pending' ? <LuBell /> : <LuCheck />}</span><strong>{status === 'pending' ? 'Nenhum chamado pendente' : 'Ainda não há chamados concluídos'}</strong><small>{status === 'pending' ? 'Novos chamados aparecem aqui em tempo real.' : 'Os chamados atendidos ficam disponíveis neste histórico.'}</small></div>
  return <ul className="tv-calls-list" aria-label={status === 'pending' ? 'Chamados pendentes' : 'Chamados concluídos'}>
    {items.map((call) => <li key={call.id}>
      <button type="button" className="tv-call-row" aria-current={selectedId === call.id ? 'true' : undefined} onClick={() => onSelect(call)}>
        <span className={`tv-call-row-icon ${call.status === 'resolved' ? 'is-done' : ''}`} aria-hidden="true">{call.status === 'resolved' ? <LuCheck /> : <LuBell />}</span>
        <span className="tv-call-row-copy"><strong>Mesa {call.tableNumber}</strong><small>{call.status === 'resolved' ? 'Atendido' : 'Aguardando atendimento'} · {relativeTime(call.createdAt)}</small></span>
        <time dateTime={call.createdAt}><LuClock3 aria-hidden="true" />{new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(call.createdAt))}</time>
      </button>
    </li>)}
  </ul>
}
