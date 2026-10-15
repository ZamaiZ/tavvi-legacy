'use client'

import { LuMinus, LuPlus, LuX } from 'react-icons/lu'
import { Dialog } from '@base-ui/react/dialog'
import type { OrderableMenuItemDTO } from '@/domain/orders'
import { formatCents } from '@/lib/money'
import { MobileSheet, MobileSheetNav } from '@/components/shell/mobile-sheet'
import { useTerritoryContainer } from '@/features/workspace/components/use-territory-container'

export type OrderableMenuItemWithCategory = OrderableMenuItemDTO & { categoryName: string }

export function OrderItemDialog({
  item,
  open,
  mobile,
  variantId,
  quantity,
  note,
  disabled,
  onOpenChange,
  onVariantChange,
  onQuantityChange,
  onNoteChange,
  onAdd,
}: {
  item: OrderableMenuItemWithCategory | null
  open: boolean
  mobile: boolean
  variantId: string
  quantity: number
  note: string
  disabled: boolean
  onOpenChange: (open: boolean) => void
  onVariantChange: (variantId: string) => void
  onQuantityChange: (quantity: number) => void
  onNoteChange: (note: string) => void
  onAdd: () => void
}) {
  const container = useTerritoryContainer()
  const selectedVariant = item?.variants.find((variant) => variant.id === variantId) ?? null
  const unitPrice = selectedVariant?.priceCents ?? item?.basePriceCents ?? 0
  const canAdd = !!item && !disabled && (item.variants.length === 0 || !!selectedVariant)
  const fields = item ? <>
    <div className="tv-order-item-product">
      <span>{item.categoryName}</span>
      <strong>{item.name}</strong>
      {item.description ? <p>{item.description}</p> : null}
    </div>

    {item.variants.length ? <label className="tv-order-item-field">
      <span>Variação <i>Obrigatória</i></span>
      <select value={variantId} disabled={disabled} onChange={(event) => onVariantChange(event.target.value)}>
        <option value="">Escolha uma variação</option>
        {item.variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.name} · {formatCents(variant.priceCents)}</option>)}
      </select>
    </label> : null}

    <label className="tv-order-item-field">
      <span>Observação <small>Opcional</small></span>
      <textarea value={note} disabled={disabled} maxLength={1000} onChange={(event) => onNoteChange(event.target.value)} placeholder="Ex.: sem cebola, molho à parte…" />
      <small className="tv-order-item-help">A observação será registrada neste item da comanda.</small>
    </label>

    <div className="tv-order-item-controls">
      <div className="tv-order-quantity" aria-label="Quantidade">
        <button type="button" aria-label="Diminuir quantidade" disabled={disabled || quantity <= 1} onClick={() => onQuantityChange(Math.max(1, quantity - 1))}><LuMinus aria-hidden="true" /></button>
        <output aria-live="polite">{quantity}</output>
        <button type="button" aria-label="Aumentar quantidade" disabled={disabled || quantity >= 99} onClick={() => onQuantityChange(Math.min(99, quantity + 1))}><LuPlus aria-hidden="true" /></button>
      </div>
      <div className="tv-order-item-total"><span>Total do item</span><strong>{formatCents(unitPrice * quantity)}</strong></div>
    </div>
  </> : null

  const actions = <div className="tv-order-item-actions">
    <button type="button" className="tv-order-item-cancel" disabled={disabled} onClick={() => onOpenChange(false)}>Voltar ao cardápio</button>
    <button type="button" className="tv-order-item-add" disabled={!canAdd} onClick={onAdd}>
      Adicionar ao pedido · {formatCents(unitPrice * quantity)}
    </button>
  </div>

  if (mobile) {
    return <MobileSheet open={open && !!item} onOpenChange={onOpenChange} detent="page">
      <MobileSheetNav title="Adicionar item" cancelLabel="Voltar" />
      <div className="tv-order-item-sheet">
        {fields}
        {actions}
      </div>
    </MobileSheet>
  }

  return <Dialog.Root open={open && !!item} onOpenChange={onOpenChange}>
    <Dialog.Portal container={container}>
      <Dialog.Backdrop className="tv-order-dialog-backdrop" />
      <Dialog.Popup className="tv-order-item-dialog" aria-busy={disabled || undefined}>
        <header className="tv-order-item-dialog-heading">
          <div><Dialog.Title className="tv-order-item-dialog-title">Adicionar item</Dialog.Title><Dialog.Description className="tv-order-item-dialog-description">Confira a variação, a quantidade e qualquer observação antes de incluir no pedido.</Dialog.Description></div>
          <button type="button" className="tv-order-dialog-close" aria-label="Fechar detalhes do item" onClick={() => onOpenChange(false)}><LuX aria-hidden="true" /></button>
        </header>
        <div className="tv-order-item-dialog-body">{fields}</div>
        {actions}
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
}
