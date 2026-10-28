import type { TableAccountDTO } from '@/domain/table-account'

export function AccountAudit({ account }: { account: TableAccountDTO }) {
  if (!account.events.length) return null
  return <details className="tv-cash-audit">
    <summary><span><strong>Histórico de auditoria</strong><small>{account.events.length} {account.events.length === 1 ? 'registro' : 'registros'}</small></span></summary>
    <ol>
      {account.events.map((event) => <li key={event.id}>
        <span className="tv-cash-audit-dot" aria-hidden="true" />
        <span><strong>{eventLabel(event.eventType)}</strong><small>{new Date(event.createdAt).toLocaleString('pt-BR')} · operador {event.actorId.slice(0, 8)}{event.reason ? ` · ${event.reason}` : ''}</small></span>
      </li>)}
    </ol>
  </details>
}

function eventLabel(eventType: string): string {
  const labels: Record<string, string> = {
    order_recorded: 'Pedido registrado',
    payment_received: 'Pagamento recebido',
    payment_refunded: 'Pagamento estornado',
    tip_decided: 'Decisão de gorjeta',
    settlement_reopened: 'Liquidação reaberta',
    order_item_cancelled: 'Item cancelado',
    account_closed: 'Comanda encerrada',
    account_reopened_by_refund: 'Conta reaberta por estorno',
    account_carried_to_pending: 'Saldo transportado para recebimento posterior',
  }
  return labels[eventType] ?? 'Alteração registrada'
}
