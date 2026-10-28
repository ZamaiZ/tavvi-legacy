import { LuArrowDownLeft, LuArrowUpRight } from 'react-icons/lu'
import type { TableAccountDTO } from '@/domain/table-account'
import { formatCents } from '@/lib/money'

export function AccountPaymentHistory({ account }: { account: TableAccountDTO }) {
  return <section className="tv-cash-payment-history" aria-labelledby="tv-cash-payment-history-title">
    <header className="tv-cash-panel-heading">
      <div><span>LANÇAMENTOS</span><h3 id="tv-cash-payment-history-title">Pagamentos registrados</h3><p>Recebimentos e estornos feitos nesta comanda.</p></div>
    </header>
    {account.payments.length ? <ul>
      {account.payments.map((payment) => <li key={payment.id}>
        <span className={`tv-cash-payment-mark${payment.entryType === 'refunded' ? ' is-refunded' : ''}`} aria-hidden="true">{payment.entryType === 'received' ? <LuArrowDownLeft /> : <LuArrowUpRight />}</span>
        <span className="tv-cash-payment-copy"><strong>{payment.entryType === 'received' ? payment.methodName : `Estorno · ${payment.methodName}`}</strong><small>{new Date(payment.createdAt).toLocaleString('pt-BR')} · operador {payment.createdBy.slice(0, 8)}{payment.reason ? ` · ${payment.reason}` : ''}{payment.cashChangeCents ? ` · Troco ${formatCents(payment.cashChangeCents)}` : ''}</small></span>
        <strong className={payment.entryType === 'refunded' ? 'is-refunded' : ''}>{payment.entryType === 'received' ? '+' : '−'}{formatCents(payment.amountAppliedCents)}</strong>
      </li>)}
    </ul> : <p className="tv-cash-panel-empty">Nenhum pagamento registrado até agora.</p>}
    <dl className="tv-cash-payment-totals">
      <div><dt>Recebido líquido</dt><dd>{formatCents(account.paidCents)}</dd></div>
      <div className={`is-due${account.balanceDueCents <= 0 ? ' is-settled' : ''}`}><dt>Saldo pendente</dt><dd>{formatCents(account.balanceDueCents)}</dd></div>
    </dl>
  </section>
}
