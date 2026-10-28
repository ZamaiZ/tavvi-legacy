import Link from 'next/link'
import { LuArrowUpRight, LuReceiptText } from 'react-icons/lu'
import { formatTableAccountIdentity, type TableAccountSummaryDTO } from '@/domain/table-account'
import { formatCents } from '@/lib/money'
import { formatRestaurantDateTime } from './finance-time'

export function PendingReceivables({ restaurantId, accounts, timezone }: {
  restaurantId: string
  accounts: TableAccountSummaryDTO[]
  timezone: string
}) {
  return <section className="tv-finance-card tv-finance-pending" aria-labelledby="tv-finance-pending-title">
    <div className="tv-finance-section-heading compact"><span className="tv-finance-icon"><LuReceiptText aria-hidden="true" /></span><div><p>CONTAS TRANSPORTADAS</p><h2 id="tv-finance-pending-title">Recebimentos pendentes</h2>
      <small>Esses saldos continuam ligados às comandas originais e não ocupam as mesas. Cada parcela pertence ao dia em que entrar.</small>
    </div></div>
    {accounts.length ? <div className="tv-finance-pending-list">
      {accounts.map((account) => <article key={account.accountId}>
        <div><strong>{formatTableAccountIdentity(account)}</strong><small>Comanda aberta em {formatRestaurantDateTime(account.openedAt, timezone)}
          {account.tipAccepted ? ' · gorjeta preservada' : ''}</small></div>
        <div className="tv-finance-pending-balance"><strong>{formatCents(account.balanceDueCents)}</strong><small>saldo aberto</small></div>
        <Link href={`/restaurantes/${restaurantId}/cash?accountId=${account.accountId}`}><span>Receber no Caixa</span><LuArrowUpRight aria-hidden="true" /></Link>
      </article>)}
    </div> : <div className="tv-finance-empty-state"><span><LuReceiptText aria-hidden="true" /></span><strong>Nenhum recebimento pendente</strong><p>Quando uma comanda for transportada no fechamento excepcional, o saldo ficará disponível aqui.</p></div>}
  </section>
}
