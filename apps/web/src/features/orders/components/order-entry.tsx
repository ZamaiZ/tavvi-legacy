'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { LuMinus, LuPlus, LuSearch, LuShoppingBag, LuTrash2 } from 'react-icons/lu'
import type { ServiceCallDTO } from '@/domain/service-call'
import type { OrderableMenuCategoryDTO, RecordTableOrderResult } from '@/domain/orders'
import type { TableAccountDTO } from '@/domain/table-account'
import { formatCents } from '@/lib/money'
import { SpinnerRing } from '@/components/ui/spinner'
import { Combobox } from '@/components/ui/combobox'
import { recordTableOrderAction } from '@/server/actions/orders'
import { getTableAccountForTableAction } from '@/server/actions/table-accounts'
import { useTableAccountsRealtime } from '@/features/cash/use-table-accounts-realtime'
import { OrderItemDialog, type OrderableMenuItemWithCategory } from './order-item-dialog'

type CartLine = {
  localId: string
  itemId: string
  itemName: string
  variantId: string | null
  variantName: string | null
  unitPriceCents: number
  quantity: number
  note: string
}

export function OrderEntry({
  restaurantId,
  call,
  menu,
  initialAccount,
  mobile,
  onDraftChange,
}: {
  restaurantId: string
  call: ServiceCallDTO
  menu: OrderableMenuCategoryDTO[]
  initialAccount: TableAccountDTO | null
  mobile: boolean
  onDraftChange: (hasDraft: boolean) => void
}) {
  const router = useRouter()
  const [categoryId, setCategoryId] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [variantId, setVariantId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [note, setNote] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [account, setAccount] = useState<TableAccountDTO | null>(
    initialAccount?.tableNumber === call.tableNumber ? initialAccount : null,
  )
  const [accountLoading, setAccountLoading] = useState(!initialAccount)
  const [accountClosed, setAccountClosed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryRequired, setRetryRequired] = useState(false)
  const [busy, startTransition] = useTransition()
  const requestIds = useRef(new Map<string, string>())
  const knownAccountId = useRef(initialAccount?.accountId ?? null)
  const [accountPreview, setAccountPreview] = useState<RecordTableOrderResult | null>(null)

  useEffect(() => {
    let active = true
    setCart([])
    setSelectedItemId(null)
    setError(null)
    setAccountPreview(null)
    setAccountLoading(true)
    setAccountClosed(false)
    knownAccountId.current = initialAccount?.tableNumber === call.tableNumber ? initialAccount.accountId : null
    void getTableAccountForTableAction({ restaurantId, tableNumber: call.tableNumber }).then((result) => {
      if (!active) return
      if (result.ok) {
        setAccount(result.data)
        knownAccountId.current = result.data?.accountId ?? null
      } else setError(result.error)
    }).catch(() => { if (active) setError('Não foi possível atualizar a comanda da mesa.') }).finally(() => {
      if (active) setAccountLoading(false)
    })
    return () => { active = false }
  }, [call.id, call.tableNumber, restaurantId])

  useEffect(() => {
    onDraftChange(cart.length > 0 || selectedItemId !== null)
    return () => onDraftChange(false)
  }, [call.id, cart.length, onDraftChange, selectedItemId])

  const items = useMemo<OrderableMenuItemWithCategory[]>(() => menu.flatMap((category) => category.items.map((item) => ({ ...item, categoryName: category.name }))), [menu])
  const selectedItem = items.find((item) => item.id === selectedItemId) ?? null
  const selectedVariant = selectedItem?.variants.find((variant) => variant.id === variantId) ?? null
  const orderBlocked = account?.status === 'settling' || accountClosed
  const query = search.trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const visibleItems = items.filter((item) => {
    const matchesCategory = categoryId === 'all' || item.categoryId === categoryId
    const itemText = `${item.name} ${item.description ?? ''} ${item.categoryName}`.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    return matchesCategory && (!query || itemText.includes(query))
  })
  const cartTotal = cart.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0)

  function openItem(itemId: string) {
    if (busy) return
    const item = items.find((entry) => entry.id === itemId)
    setSelectedItemId(itemId)
    setVariantId(item?.variants.length === 1 ? item.variants[0].id : '')
    setQuantity(1)
    setNote('')
    setError(null)
    onDraftChange(true)
  }

  function closeItem() {
    setSelectedItemId(null)
    onDraftChange(cart.length > 0)
  }

  function addLine() {
    if (busy) return
    if (cart.length >= 40) {
      setError('Cada confirmação aceita até 40 linhas. Registre este pedido antes de adicionar mais itens.')
      return
    }
    if (!selectedItem || (selectedItem.variants.length > 0 && !selectedVariant)) return
    const cleanNote = note.trim()
    const nextLine: CartLine = {
      localId: crypto.randomUUID(),
      itemId: selectedItem.id,
      itemName: selectedItem.name,
      variantId: selectedVariant?.id ?? null,
      variantName: selectedVariant?.name ?? null,
      unitPriceCents: selectedVariant?.priceCents ?? selectedItem.basePriceCents,
      quantity,
      note: cleanNote,
    }
    setCart((current) => [...current, nextLine])
    setSelectedItemId(null)
    setError(null)
    onDraftChange(true)
  }

  function changeQuantity(localId: string, next: number) {
    if (busy) return
    if (next < 1 || next > 99) return
    setCart((current) => current.map((line) => line.localId === localId ? { ...line, quantity: next } : line))
  }

  function removeLine(localId: string) {
    if (busy) return
    const removingLastLine = cart.length === 1 && cart[0].localId === localId
    setCart((current) => current.filter((line) => line.localId !== localId))
    if (removingLastLine && selectedItemId === null) onDraftChange(false)
  }

  const refreshAccountPreview = useCallback(async () => {
    try {
      const result = await getTableAccountForTableAction({ restaurantId, tableNumber: call.tableNumber })
      if (result.ok && result.data) {
        setAccount(result.data)
        knownAccountId.current = result.data.accountId
        setAccountClosed(false)
        setAccountPreview(null)
        setError(null)
      } else if (result.ok && knownAccountId.current) {
        setAccount(null)
        setAccountClosed(true)
        setAccountPreview(null)
      } else if (!result.ok) {
        setError(result.error)
      }
    } catch {
      setError('Não foi possível atualizar os detalhes da comanda.')
    }
  }, [restaurantId, call.tableNumber])
  useTableAccountsRealtime(restaurantId, refreshAccountPreview)

  function submit() {
    if (busy || !cart.length) return
    const requestItems = cart.map((line) => ({
      itemId: line.itemId,
      variantId: line.variantId,
      quantity: line.quantity,
      expectedUnitPriceCents: line.unitPriceCents,
      note: line.note,
    }))
    const payload = JSON.stringify(requestItems)
    const requestId = requestIds.current.get(payload) ?? crypto.randomUUID()
    requestIds.current.set(payload, requestId)
    setError(null)
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof recordTableOrderAction>>
      try {
        result = await recordTableOrderAction({ restaurantId, callId: call.id, requestId, items: requestItems })
      } catch {
        setRetryRequired(true)
        setError('Não foi possível confirmar o pedido. Tente novamente sem alterar os itens para evitar duplicidade.')
        return
      }
      if (!result.ok) {
        setError(result.error)
        if (isDefinitiveOrderRejection(result.error)) {
          setRetryRequired(false)
          requestIds.current.delete(payload)
        } else {
          setRetryRequired(true)
        }
        return
      }
      setRetryRequired(false)
      setCart([])
      onDraftChange(false)
      requestIds.current.delete(payload)
      setAccountPreview(result.data)
      setAccount(null)
      try {
        const refreshed = await getTableAccountForTableAction({ restaurantId, tableNumber: call.tableNumber })
        if (refreshed.ok && refreshed.data) {
          setAccount(refreshed.data)
          knownAccountId.current = refreshed.data.accountId
          setAccountClosed(false)
          setAccountPreview(null)
        } else if (!refreshed.ok || !refreshed.data) {
          setError('Pedido registrado, mas não foi possível atualizar os detalhes da comanda.')
        }
      } catch {
        setError('Pedido registrado, mas não foi possível atualizar os detalhes da comanda.')
      }
    })
  }

  return <section className="tv-order-entry" aria-label="Registrar pedido da mesa">
    <div className="tv-order-entry-heading">
      <div><small>Pedido da mesa {call.tableNumber}</small><h3>O que vamos adicionar?</h3></div>
      <span><LuShoppingBag aria-hidden="true" />{cart.length} {cart.length === 1 ? 'item' : 'itens'}</span>
    </div>

    {accountLoading ? <div className="tv-order-account-loading" role="status"><span /><span />Verificando a comanda desta mesa…</div> : account || accountPreview ? <div className="tv-order-account-balance">
      <span>Comanda da mesa</span><strong>{formatCents(account?.balanceDueCents ?? accountPreview!.balanceDueCents)} em aberto</strong>
    </div> : accountClosed ? <p className="tv-order-account-hint">A comanda desta visita foi encerrada.</p> : <p className="tv-order-account-hint">A comanda desta mesa será aberta ao confirmar o primeiro pedido.</p>}
    {orderBlocked ? <p className="tv-order-hint" role="status">{accountClosed ? 'A comanda desta visita foi encerrada. Este chamado não pode abrir outra comanda.' : 'O caixa iniciou o fechamento desta comanda. Novos itens estão bloqueados; se houver um rascunho local, revise-o ou limpe-o.'}</p> : null}
    {account?.orders.length ? <details className="tv-order-account-orders">
      <summary>Pedidos recentes nesta comanda <span>{account.orders.length}</span></summary>
      {account.orders.slice(-4).reverse().map((order) => <div key={order.id}><small>{new Date(order.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · chamado #{order.serviceCallId.slice(0, 8).toUpperCase()}</small>
        {order.items.map((item) => <span key={item.id}>{item.cancelledAt ? 'Cancelado · ' : ''}{item.quantity}× {item.itemName}{item.variantName ? ` · ${item.variantName}` : ''}{item.note ? ` · Obs.: ${item.note}` : ''} · {formatCents(item.lineTotalCents)}</span>)}
      </div>)}
    </details> : accountPreview ? <p className="tv-order-account-hint">Pedido #{accountPreview.orderId.slice(0, 8).toUpperCase()} registrado. A comanda está sincronizando.</p> : null}

    {!menu.length ? <p className="tv-order-empty">Não há itens visíveis e disponíveis para adicionar.</p> : <>
      <div className="tv-order-filters">
        <div className="tv-order-filter-field"><span>Categoria</span><Combobox label="Categoria" value={categoryId} options={[{ value: 'all', label: 'Todas as categorias' }, ...menu.map((category) => ({ value: category.id, label: category.name }))]} disabled={orderBlocked || retryRequired || busy} onValueChange={setCategoryId} /></div>
        <label className="tv-order-search"><span>Buscar no cardápio</span><span className="tv-order-search-input"><LuSearch aria-hidden="true" /><input value={search} disabled={orderBlocked || retryRequired || busy} onChange={(event) => setSearch(event.target.value)} placeholder="Prato, bebida…" /></span></label>
      </div>

      <div className="tv-order-menu-meta" aria-live="polite">{visibleItems.length} {visibleItems.length === 1 ? 'item disponível' : 'itens disponíveis'}</div>
      <div className="tv-order-menu-list">
        {visibleItems.length ? visibleItems.map((item) => {
          const price = item.variants.length ? Math.min(...item.variants.map((variant) => variant.priceCents)) : item.basePriceCents
          return <button type="button" disabled={retryRequired || orderBlocked || busy} className="tv-order-menu-item" key={item.id} onClick={() => openItem(item.id)}>
            <span><strong>{item.name}</strong><small>{item.description || item.categoryName}{item.variants.length ? ` · ${item.variants.length} variações` : ''}</small></span>
            <span className="tv-order-menu-price"><small>{item.variants.length ? 'A partir de' : 'Valor'}</small><strong>{formatCents(price)}</strong><LuPlus aria-hidden="true" /></span>
          </button>
        }) : <p className="tv-order-empty">Nenhum item encontrado com esses filtros.</p>}
      </div>

      {cart.length ? <div className="tv-order-cart">
        <div className="tv-order-cart-heading"><strong>Pedido em andamento</strong><span>{formatCents(cartTotal)}</span><button type="button" disabled={retryRequired || busy} onClick={() => { setCart([]); onDraftChange(selectedItemId !== null) }}>Limpar pedido</button></div>
        {cart.length >= 40 ? <p className="tv-order-hint">Cada confirmação aceita até 40 linhas. Registre o pedido antes de adicionar mais itens.</p> : null}
        <ul>{cart.map((line) => <li key={line.localId}>
          <div className="tv-order-cart-copy"><strong>{line.quantity}× {line.itemName}{line.variantName ? ` · ${line.variantName}` : ''}</strong>{line.note ? <small>Obs.: {line.note}</small> : null}<small>{formatCents(line.unitPriceCents * line.quantity)}</small></div>
          <div className="tv-order-cart-actions"><div className="tv-order-quantity"><button type="button" aria-label="Diminuir quantidade" disabled={retryRequired || busy || line.quantity <= 1} onClick={() => changeQuantity(line.localId, line.quantity - 1)}><LuMinus /></button><output>{line.quantity}</output><button type="button" aria-label="Aumentar quantidade" disabled={retryRequired || busy || line.quantity >= 99} onClick={() => changeQuantity(line.localId, line.quantity + 1)}><LuPlus /></button></div><button type="button" className="tv-order-remove" aria-label={`Remover ${line.itemName}`} disabled={retryRequired || busy} onClick={() => removeLine(line.localId)}><LuTrash2 /></button></div>
        </li>)}</ul>
        {retryRequired ? <p className="tv-order-hint" role="status">A resposta anterior ficou incerta. Repita este pedido sem alterar os itens.</p> : null}
        <button type="button" className="tv-order-confirm" disabled={busy || (orderBlocked && !retryRequired)} onClick={submit}>{busy ? <><SpinnerRing decorative /> Registrando pedido…</> : <>{retryRequired ? 'Repetir confirmação' : accountClosed ? 'Comanda encerrada' : orderBlocked ? 'Fechamento iniciado' : 'Confirmar pedido'} · {formatCents(cartTotal)}</>}</button>
      </div> : null}
      {error ? <p className="tv-order-error" role="alert">{error}{error.includes('preço mudou') ? <button type="button" onClick={() => { setError(null); router.refresh() }}>Atualizar cardápio</button> : null}</p> : null}
    </>}
    <OrderItemDialog
      item={selectedItem}
      open={selectedItem !== null}
      mobile={mobile}
      variantId={variantId}
      quantity={quantity}
      note={note}
      disabled={retryRequired || orderBlocked || busy}
      onOpenChange={(open) => { if (!open) closeItem() }}
      onVariantChange={setVariantId}
      onQuantityChange={setQuantity}
      onNoteChange={setNote}
      onAdd={addLine}
    />
  </section>
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
