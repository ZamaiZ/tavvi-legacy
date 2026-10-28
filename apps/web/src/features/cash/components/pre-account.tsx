import { formatCents } from '@/lib/money'
import type { TableAccountDTO } from '@/domain/table-account'

export function PreAccount({ restaurantName, account }: { restaurantName: string; account: TableAccountDTO }) {
  const tipStatus = account.tipMode === 'disabled'
    ? 'desativada'
    : account.tipAccepted === null ? 'a definir' : account.tipAccepted ? 'aceita' : 'recusada'
  return <section id="tv-pre-account" className="tv-pre-account" aria-label="Demonstrativo interno da comanda">
    <header className="tv-pre-account-header">
      <div><strong>{restaurantName}</strong><small>Pré-conta · demonstrativo interno não fiscal</small></div>
      <div className="tv-pre-account-table"><small>Mesa</small><strong>{account.tableNumber}</strong></div>
    </header>
    <div className="tv-pre-account-meta"><span>Comanda aberta {new Date(account.openedAt).toLocaleString('pt-BR')}</span><span>Conta {account.accountId.slice(0, 8).toUpperCase()}</span></div>

    <div className="tv-pre-account-orders">
      {account.orders.map((order, index) => <section key={order.id}>
        <div className="tv-pre-account-order-heading"><strong>Pedido {index + 1} · chamado {order.serviceCallId.slice(0, 8).toUpperCase()}</strong><span>{new Date(order.createdAt).toLocaleString('pt-BR')} · atendente {order.createdBy.slice(0, 8)}</span></div>
        {order.items.map((item) => <div className={`tv-pre-account-item${item.cancelledAt ? ' is-cancelled' : ''}`} key={item.id}>
          <div><strong>{item.quantity}× {item.itemName}{item.variantName ? ` · ${item.variantName}` : ''}</strong><small>{item.categoryName}{item.note ? ` · Obs.: ${item.note}` : ''}{item.cancelledAt ? ` · Cancelado: ${item.cancelReason}` : ''}</small></div>
          <span>{formatCents(item.lineTotalCents)}</span>
        </div>)}
      </section>)}
    </div>

    <div className="tv-pre-account-totals">
      <div><span>Subtotal</span><strong>{formatCents(account.subtotalCents)}</strong></div>
      <div><span>Gorjeta ({tipStatus})</span><strong>{account.tipAccepted === null ? '—' : formatCents(account.tipCents)}</strong></div>
      <div className="is-total"><span>Total atual</span><strong>{formatCents(account.totalCents)}</strong></div>
    </div>

    <div className="tv-pre-account-payments">
      <h3>Pagamentos registrados</h3>
      {account.payments.length ? account.payments.map((payment) => <div className="tv-pre-account-payment" key={payment.id}>
        <span>{payment.entryType === 'received' ? payment.methodName : `Estorno · ${payment.methodName}`}<small>{new Date(payment.createdAt).toLocaleString('pt-BR')} · operador {payment.createdBy.slice(0, 8)}{payment.reason ? ` · ${payment.reason}` : ''}{payment.cashChangeCents ? ` · Troco ${formatCents(payment.cashChangeCents)}` : ''}</small></span>
        <strong>{payment.entryType === 'received' ? '−' : '+'}{formatCents(payment.amountAppliedCents)}</strong>
      </div>) : <p>Nenhum pagamento registrado.</p>}
      <div className="tv-pre-account-balance"><span>Recebido líquido</span><strong>{formatCents(account.paidCents)}</strong></div>
      <div className="tv-pre-account-balance is-due"><span>Saldo pendente</span><strong>{formatCents(account.balanceDueCents)}</strong></div>
    </div>

    {account.events.length ? <div className="tv-pre-account-events">
      <h3>Histórico de auditoria</h3>
      {account.events.map((event) => <div key={event.id}><span><strong>{eventLabel(event.eventType)}</strong><small>{new Date(event.createdAt).toLocaleString('pt-BR')} · operador {event.actorId.slice(0, 8)}{event.reason ? ` · ${event.reason}` : ''}</small></span></div>)}
    </div> : null}

    <footer>Apresentação para conferência da mesa e do caixa. Não substitui documento fiscal.</footer>
  </section>
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
