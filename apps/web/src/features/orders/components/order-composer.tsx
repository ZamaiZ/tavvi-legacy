'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { LuMinus, LuPlus, LuSearch, LuShoppingBag, LuTrash2 } from 'react-icons/lu'
import type { OrderLineInput, OrderableMenuCategoryDTO } from '@/domain/orders'
import { formatCents } from '@/lib/money'
import { SpinnerRing } from '@/components/ui/spinner'
import { Combobox } from '@/components/ui/combobox'
import { OrderItemDialog, type OrderableMenuItemWithCategory } from './order-item-dialog'

export type OrderComposerSubmitResult =
  | { ok: true; message?: string }
  | { ok: false; error: string; retryable: boolean }

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

export function OrderComposer({ menu, mobile, orderLabel, disabled = false, onSubmit, onDraftChange, onRetryStateChange }: {
  menu: OrderableMenuCategoryDTO[]
  mobile: boolean
  orderLabel: string
  disabled?: boolean
  onSubmit: (requestId: string, items: OrderLineInput[]) => Promise<OrderComposerSubmitResult>
  onDraftChange?: (hasDraft: boolean) => void
  onRetryStateChange?: (retryRequired: boolean) => void
}) {
  const router = useRouter()
  const [categoryId, setCategoryId] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [variantId, setVariantId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [note, setNote] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [retryRequired, setRetryRequired] = useState(false)
  const [busy, startTransition] = useTransition()
  const requestIds = useRef(new Map<string, string>())

  useEffect(() => {
    onDraftChange?.(cart.length > 0 || selectedItemId !== null)
    return () => onDraftChange?.(false)
  }, [cart.length, onDraftChange, selectedItemId])

  useEffect(() => {
    onRetryStateChange?.(retryRequired)
    return () => onRetryStateChange?.(false)
  }, [onRetryStateChange, retryRequired])

  const items = useMemo<OrderableMenuItemWithCategory[]>(
    () => menu.flatMap((category) => category.items.map((item) => ({ ...item, categoryName: category.name }))),
    [menu],
  )
  const selectedItem = items.find((item) => item.id === selectedItemId) ?? null
  const selectedVariant = selectedItem?.variants.find((variant) => variant.id === variantId) ?? null
  const query = search.trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const visibleItems = items.filter((item) => {
    const matchesCategory = categoryId === 'all' || item.categoryId === categoryId
    const itemText = `${item.name} ${item.description ?? ''} ${item.categoryName}`.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    return matchesCategory && (!query || itemText.includes(query))
  })
  const cartTotal = cart.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0)
  const editingDisabled = disabled || retryRequired || busy

  function openItem(itemId: string) {
    if (editingDisabled) return
    const item = items.find((entry) => entry.id === itemId)
    setSelectedItemId(itemId)
    setVariantId(item?.variants.length === 1 ? item.variants[0].id : '')
    setQuantity(1)
    setNote('')
    setError(null)
    setNotice(null)
    onDraftChange?.(true)
  }

  function closeItem() {
    setSelectedItemId(null)
    onDraftChange?.(cart.length > 0)
  }

  function addLine() {
    if (editingDisabled) return
    if (cart.length >= 40) {
      setError('Cada confirmação aceita até 40 linhas. Registre este pedido antes de adicionar mais itens.')
      return
    }
    if (!selectedItem || (selectedItem.variants.length > 0 && !selectedVariant)) return
    setCart((current) => [...current, {
      localId: crypto.randomUUID(),
      itemId: selectedItem.id,
      itemName: selectedItem.name,
      variantId: selectedVariant?.id ?? null,
      variantName: selectedVariant?.name ?? null,
      unitPriceCents: selectedVariant?.priceCents ?? selectedItem.basePriceCents,
      quantity,
      note: note.trim(),
    }])
    setSelectedItemId(null)
    setError(null)
    onDraftChange?.(true)
  }

  function changeQuantity(localId: string, next: number) {
    if (editingDisabled || next < 1 || next > 99) return
    setCart((current) => current.map((line) => line.localId === localId ? { ...line, quantity: next } : line))
  }

  function removeLine(localId: string) {
    if (editingDisabled) return
    const removingLastLine = cart.length === 1 && cart[0].localId === localId
    setCart((current) => current.filter((line) => line.localId !== localId))
    if (removingLastLine && selectedItemId === null) onDraftChange?.(false)
  }

  function submit() {
    if (busy || !cart.length || (disabled && !retryRequired)) return
    const requestItems: OrderLineInput[] = cart.map((line) => ({
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
    setNotice(null)
    startTransition(async () => {
      let result: OrderComposerSubmitResult
      try {
        result = await onSubmit(requestId, requestItems)
      } catch {
        result = { ok: false, error: 'A resposta ficou incerta. Repita a confirmação sem alterar os itens.', retryable: true }
      }
      if (!result.ok) {
        setError(result.error)
        setRetryRequired(result.retryable)
        if (!result.retryable) requestIds.current.delete(payload)
        return
      }
      requestIds.current.delete(payload)
      setRetryRequired(false)
      setCart([])
      setSelectedItemId(null)
      setError(null)
      setNotice(result.message ?? null)
      onDraftChange?.(false)
    })
  }

  return <section className="tv-order-entry tv-order-composer" aria-label={`Registrar pedido · ${orderLabel}`}>
    <div className="tv-order-entry-heading">
      <div><small>{orderLabel}</small><h3>O que vamos adicionar?</h3></div>
      <span><LuShoppingBag aria-hidden="true" />{cart.length} {cart.length === 1 ? 'item' : 'itens'}</span>
    </div>
    {!menu.length ? <p className="tv-order-empty">Não há itens visíveis e disponíveis para adicionar.</p> : <>
      <div className="tv-order-filters">
        <div className="tv-order-filter-field"><span>Categoria</span><Combobox label="Categoria" value={categoryId} options={[{ value: 'all', label: 'Todas as categorias' }, ...menu.map((category) => ({ value: category.id, label: category.name }))]} disabled={editingDisabled} onValueChange={setCategoryId} /></div>
        <label className="tv-order-search"><span>Buscar no cardápio</span><span className="tv-order-search-input"><LuSearch aria-hidden="true" /><input value={search} disabled={editingDisabled} onChange={(event) => setSearch(event.target.value)} placeholder="Prato, bebida…" /></span></label>
      </div>
      <div className="tv-order-menu-meta" aria-live="polite">{visibleItems.length} {visibleItems.length === 1 ? 'item disponível' : 'itens disponíveis'}</div>
      <div className="tv-order-menu-list">
        {visibleItems.length ? visibleItems.map((item) => {
          const price = item.variants.length ? Math.min(...item.variants.map((variant) => variant.priceCents)) : item.basePriceCents
          return <button type="button" disabled={editingDisabled} className="tv-order-menu-item" key={item.id} onClick={() => openItem(item.id)}>
            <span><strong>{item.name}</strong><small>{item.description || item.categoryName}{item.variants.length ? ` · ${item.variants.length} variações` : ''}</small></span>
            <span className="tv-order-menu-price"><small>{item.variants.length ? 'A partir de' : 'Valor'}</small><strong>{formatCents(price)}</strong><LuPlus aria-hidden="true" /></span>
          </button>
        }) : <p className="tv-order-empty">Nenhum item encontrado com esses filtros.</p>}
      </div>
      {cart.length ? <div className="tv-order-cart">
        <div className="tv-order-cart-heading"><strong>Pedido em andamento</strong><span>{formatCents(cartTotal)}</span><button type="button" disabled={editingDisabled} onClick={() => { setCart([]); onDraftChange?.(selectedItemId !== null) }}>Limpar pedido</button></div>
        {cart.length >= 40 ? <p className="tv-order-hint">Cada confirmação aceita até 40 linhas. Registre o pedido antes de adicionar mais itens.</p> : null}
        <ul>{cart.map((line) => <li key={line.localId}>
          <div className="tv-order-cart-copy"><strong>{line.quantity}× {line.itemName}{line.variantName ? ` · ${line.variantName}` : ''}</strong>{line.note ? <small>Obs.: {line.note}</small> : null}<small>{formatCents(line.unitPriceCents * line.quantity)}</small></div>
          <div className="tv-order-cart-actions"><div className="tv-order-quantity"><button type="button" aria-label="Diminuir quantidade" disabled={editingDisabled || line.quantity <= 1} onClick={() => changeQuantity(line.localId, line.quantity - 1)}><LuMinus aria-hidden="true" /></button><output>{line.quantity}</output><button type="button" aria-label="Aumentar quantidade" disabled={editingDisabled || line.quantity >= 99} onClick={() => changeQuantity(line.localId, line.quantity + 1)}><LuPlus aria-hidden="true" /></button></div><button type="button" className="tv-order-remove" aria-label={`Remover ${line.itemName}`} disabled={editingDisabled} onClick={() => removeLine(line.localId)}><LuTrash2 aria-hidden="true" /></button></div>
        </li>)}</ul>
        {retryRequired ? <p className="tv-order-hint" role="status">A resposta anterior ficou incerta. Repita este pedido sem alterar os itens.</p> : null}
        <button type="button" className="tv-order-confirm" disabled={busy || (disabled && !retryRequired)} onClick={submit}>{busy ? <><SpinnerRing decorative /> Registrando pedido…</> : <>{retryRequired ? 'Repetir confirmação' : disabled ? 'Comanda indisponível' : 'Confirmar pedido'} · {formatCents(cartTotal)}</>}</button>
      </div> : null}
      {error ? <p className="tv-order-error" role="alert">{error}{error.includes('preço mudou') ? <button type="button" onClick={() => { setError(null); router.refresh() }}>Atualizar cardápio</button> : null}</p> : null}
      {notice ? <p className="tv-order-hint" role="status">{notice}</p> : null}
    </>}
    <OrderItemDialog item={selectedItem} open={selectedItem !== null} mobile={mobile} variantId={variantId} quantity={quantity} note={note}
      disabled={editingDisabled} onOpenChange={(open) => { if (!open) closeItem() }} onVariantChange={setVariantId}
      onQuantityChange={setQuantity} onNoteChange={setNote} onAdd={addLine} />
  </section>
}
