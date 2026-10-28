import type { FinanceMethodSummaryDTO } from '@/domain/finance'
import { formatCents } from '@/lib/money'

export function FinanceMethodList({ methods }: { methods: FinanceMethodSummaryDTO[] }) {
  const hasRefunds = methods.some((method) => method.refundedCents > 0)
  return <table className="tv-finance-method-list">
    <thead>
      <tr><th scope="col">Forma de pagamento</th><th scope="col">Recebido</th>{hasRefunds ? <th scope="col">Estornado</th> : null}</tr>
    </thead>
    <tbody>
      {methods.map((method) => <tr key={method.methodId}>
        <th scope="row">{method.methodName}</th>
        <td><span aria-hidden="true">Recebido</span><b>{formatCents(method.receivedCents)}</b></td>
        {hasRefunds ? <td><span aria-hidden="true">Estornado</span><b>{method.refundedCents > 0 ? formatCents(method.refundedCents) : '—'}</b></td> : null}
      </tr>)}
    </tbody>
  </table>
}
