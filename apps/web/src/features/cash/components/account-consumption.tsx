import type { TableAccountDTO } from '@/domain/table-account'
import { formatCents } from '@/lib/money'

export function AccountConsumption({ account }: { account: TableAccountDTO }) {
  const itemCount = account.orders.reduce((count, order) => count + order.items.length, 0)
  const tipLabel = account.tipMode === 'disabled' ? 'desativada' : account.tipAccepted === null ? 'a definir' : account.tipAccepted ? 'aceita' : 'recusada'

  return <section className="tv-cash-consumption" aria-labelledby="tv-cash-consumption-title">
    <header className="tv-cash-panel-heading">
      <div><span>CONFERÊNCIA</span><h3 id="tv-cash-consumption-title">Consumo da comanda</h3><p>{itemCount} {itemCount === 1 ? 'item' : 'itens'} · {account.orders.length} {account.orders.length === 1 ? 'pedido' : 'pedidos'}</p></div>
    </header>
    {account.orders.length ? <div className="tv-cash-orders">
      {account.orders.map((order, index) => <section className="tv-cash-order" key={order.id}>
        <header><strong>Pedido {index + 1} <span>· {order.serviceCallId ? `chamado ${order.serviceCallId.slice(0, 8).toUpperCase()}` : 'Caixa'}</span></strong><small>{new Date(order.createdAt).toLocaleString('pt-BR')}</small></header>
        {order.items.map((item) => <div className={`tv-cash-order-item${item.cancelledAt ? ' is-cancelled' : ''}`} key={item.id}>
          <div><strong>{item.quantity}× {item.itemName}{item.variantName ? ` · ${item.variantName}` : ''}</strong><small>{item.categoryName}{item.note ? ` · Obs.: ${item.note}` : ''}{item.cancelledAt ? ` · Cancelado: ${item.cancelReason}` : ''}</small></div>
          <span>{formatCents(item.lineTotalCents)}</span>
        </div>)}
      </section>)}
    </div> : <p className="tv-cash-panel-empty">Nenhum item lançado nesta comanda.</p>}
    <dl className="tv-cash-account-totals">
      <div><dt>Subtotal</dt><dd>{formatCents(account.subtotalCents)}</dd></div>
      <div><dt>Gorjeta · {tipLabel}</dt><dd>{account.tipAccepted === null ? '—' : formatCents(account.tipCents)}</dd></div>
      <div className="is-total"><dt>Total da conta</dt><dd>{formatCents(account.totalCents)}</dd></div>
    </dl>
  </section>
}
