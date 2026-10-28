'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ServiceCallDTO } from '@/domain/service-call'
import type { OrderLineInput, OrderableMenuCategoryDTO, RecordTableOrderResult } from '@/domain/orders'
import type { TableAccountDTO } from '@/domain/table-account'
import { formatTableAccountIdentity } from '@/domain/table-account'
import { formatCents } from '@/lib/money'
import { recordTableOrderAction } from '@/server/actions/orders'
import { getTableAccountForTableAction } from '@/server/actions/table-accounts'
import { useTableAccountsRealtime } from '@/features/cash/use-table-accounts-realtime'
import { OrderComposer, type OrderComposerSubmitResult } from './order-composer'

export function OrderEntry({ restaurantId, call, menu, initialAccount, mobile, onDraftChange }: {
  restaurantId: string
  call: ServiceCallDTO
  menu: OrderableMenuCategoryDTO[]
  initialAccount: TableAccountDTO | null
  mobile: boolean
  onDraftChange: (hasDraft: boolean) => void
}) {
  const [account, setAccount] = useState<TableAccountDTO | null>(
    initialAccount?.tableNumber === call.tableNumber ? initialAccount : null,
  )
  const [accountLoading, setAccountLoading] = useState(!initialAccount)
  const [accountClosed, setAccountClosed] = useState(false)
  const [accountError, setAccountError] = useState<string | null>(null)
  const [accountPreview, setAccountPreview] = useState<RecordTableOrderResult | null>(null)
  const knownAccountId = useRef(initialAccount?.accountId ?? null)

  useEffect(() => {
    let active = true
    setAccountLoading(true)
    setAccountError(null)
    setAccountPreview(null)
    setAccountClosed(false)
    knownAccountId.current = initialAccount?.tableNumber === call.tableNumber ? initialAccount.accountId : null
    void getTableAccountForTableAction({ restaurantId, tableNumber: call.tableNumber }).then((result) => {
      if (!active) return
      if (result.ok) {
        setAccount(result.data)
        knownAccountId.current = result.data?.accountId ?? null
      } else setAccountError(result.error)
    }).catch(() => { if (active) setAccountError('Não foi possível atualizar a comanda da mesa.') }).finally(() => {
      if (active) setAccountLoading(false)
    })
    return () => { active = false }
  }, [call.id, call.tableNumber, initialAccount?.accountId, restaurantId])

  const refreshAccountPreview = useCallback(async () => {
    try {
      const result = await getTableAccountForTableAction({ restaurantId, tableNumber: call.tableNumber })
      if (result.ok && result.data) {
        setAccount(result.data)
        knownAccountId.current = result.data.accountId
        setAccountClosed(false)
        setAccountPreview(null)
        setAccountError(null)
      } else if (result.ok && knownAccountId.current) {
        setAccount(null)
        setAccountClosed(true)
        setAccountPreview(null)
      } else if (!result.ok) setAccountError(result.error)
    } catch {
      setAccountError('Não foi possível atualizar os detalhes da comanda.')
    }
  }, [call.tableNumber, restaurantId])
  useTableAccountsRealtime(restaurantId, refreshAccountPreview)

  const submit = useCallback(async (requestId: string, items: OrderLineInput[]): Promise<OrderComposerSubmitResult> => {
    const result = await recordTableOrderAction({ restaurantId, callId: call.id, requestId, items })
    if (!result.ok) return { ok: false, error: result.error, retryable: !isDefinitiveOrderRejection(result.error) }
    setAccountPreview(result.data)
    setAccount(null)
    setAccountError(null)
    try {
      const refreshed = await getTableAccountForTableAction({ restaurantId, tableNumber: call.tableNumber })
      if (refreshed.ok && refreshed.data) {
        setAccount(refreshed.data)
        knownAccountId.current = refreshed.data.accountId
        setAccountClosed(false)
        setAccountPreview(null)
        return { ok: true }
      }
      return { ok: true, message: 'Pedido registrado. A comanda será atualizada quando a conexão sincronizar.' }
    } catch {
      return { ok: true, message: 'Pedido registrado. A comanda será atualizada quando a conexão sincronizar.' }
    }
  }, [call.id, call.tableNumber, restaurantId])

  const orderBlocked = account?.status === 'settling' || accountClosed
  const orderLabel = `Pedido da mesa ${call.tableNumber}`

  return <>
    {accountLoading ? <div className="tv-order-account-loading" role="status"><span /><span />Verificando a comanda desta mesa…</div> : account || accountPreview ? <div className="tv-order-account-balance">
      <span>{account ? formatTableAccountIdentity(account) : 'Comanda atualizada'}</span><strong>{formatCents(account?.balanceDueCents ?? accountPreview!.balanceDueCents)} em aberto</strong>
    </div> : accountClosed ? <p className="tv-order-account-hint">A comanda desta visita foi encerrada.</p> : <p className="tv-order-account-hint">A comanda desta mesa será aberta ao confirmar o primeiro pedido.</p>}
    {orderBlocked ? <p className="tv-order-hint" role="status">{accountClosed ? 'A comanda desta visita foi encerrada. Este chamado não pode abrir outra comanda.' : 'O caixa iniciou o fechamento desta comanda. Novos itens estão bloqueados; revise ou limpe qualquer rascunho local.'}</p> : null}
    {accountError ? <p className="tv-order-error" role="alert">{accountError}</p> : null}
    {account?.orders.length ? <details className="tv-order-account-orders">
      <summary>Pedidos recentes nesta comanda <span>{account.orders.length}</span></summary>
      {account.orders.slice(-4).reverse().map((order) => <div key={order.id}><small>{new Date(order.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · {order.serviceCallId ? `chamado #${order.serviceCallId.slice(0, 8).toUpperCase()}` : 'Caixa'}</small>
        {order.items.map((item) => <span key={item.id}>{item.cancelledAt ? 'Cancelado · ' : ''}{item.quantity}× {item.itemName}{item.variantName ? ` · ${item.variantName}` : ''}{item.note ? ` · Obs.: ${item.note}` : ''} · {formatCents(item.lineTotalCents)}</span>)}
      </div>)}
    </details> : accountPreview ? <p className="tv-order-account-hint">Pedido #{accountPreview.orderId.slice(0, 8).toUpperCase()} registrado. A comanda está sincronizando.</p> : null}
    <OrderComposer
      menu={menu}
      mobile={mobile}
      orderLabel={orderLabel}
      disabled={orderBlocked}
      onSubmit={submit}
      onDraftChange={onDraftChange}
    />
  </>
}

function isDefinitiveOrderRejection(message: string): boolean {
  return [
    'Você não tem acesso a este restaurante',
    'O chamado mudou de responsável',
    'Um item ou preço mudou',
    'Escolha uma variação',
    'A conta desta mesa está em fechamento',
    'A conta desta mesa já foi encerrada',
    'O chamado não está mais disponível',
    'As configurações do caixa não estão disponíveis',
    'Confira os itens e quantidades',
    'O total da comanda excede',
    'Você não tem permissão para registrar este pedido',
  ].some((knownMessage) => message.includes(knownMessage))
}
