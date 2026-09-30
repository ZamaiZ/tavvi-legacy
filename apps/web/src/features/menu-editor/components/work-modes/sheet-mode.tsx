'use client'

import { useOptimistic, useState, useTransition, type KeyboardEvent } from 'react'
import { LuTable } from 'react-icons/lu'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/toast'
import type { OwnerMenuCategoryDTO, OwnerMenuItemDTO } from '@/domain/menu'
import { PanelEmptyState } from '@/features/workspace/components/panel-empty-state'
import { setItemAvailabilityAction, updateItemAction } from '@/server/actions/menu'
import { itemPayload, moveItemToCategory } from '../../lib/menu-order'
import { StandaloneItemContextMenu } from '../item-context-menu'
import { NewCategoryButton } from '../new-category-button'
import { NewItemButton } from '../new-item-button'

// Planilha (README §7.5, item 10), com switches no lugar das caixas.
export function SheetMode({ restaurantId, categories, canEdit }: { restaurantId: string; categories: OwnerMenuCategoryDTO[]; canEdit: boolean }) {
  const items = categories.flatMap((category) => category.items)
  if (items.length === 0) {
    return (
      <PanelEmptyState
        density="section"
        icon={<LuTable />}
        title="A planilha ainda não tem itens"
        description="Adicione pratos ao cardápio para editar nomes, categorias, preços e disponibilidade em uma só tela."
        action={canEdit && categories[0]
          ? <NewItemButton restaurantId={restaurantId} categoryId={categories[0].id} appearance="chip" />
          : canEdit ? <NewCategoryButton restaurantId={restaurantId} appearance="chip" /> : undefined}
      />
    )
  }
  const categoryOptions: ComboboxOption[] = categories.map((category) => ({ value: category.id, label: category.name }))
  return (
    <section className="tv-sheet" aria-label="Planilha de itens">
      <div className="tv-sheet-head" aria-hidden="true"><span>Item</span><span>Categoria</span><span>Preço</span><span>Visível</span><span>Disponível</span></div>
      {items.map((item) => <SheetRow key={item.id} restaurantId={restaurantId} item={item} categories={categories} categoryOptions={categoryOptions} canEdit={canEdit} />)}
    </section>
  )
}

function SheetRow({ restaurantId, item, categories, categoryOptions, canEdit }: { restaurantId: string; item: OwnerMenuItemDTO; categories: OwnerMenuCategoryDTO[]; categoryOptions: ComboboxOption[]; canEdit: boolean }) {
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState(item.name)
  const [price, setPrice] = useState<number | null>(item.basePriceCents)
  const [categoryId, setCategoryId] = useOptimistic(item.categoryId)
  const [visible, setVisible] = useOptimistic(item.isVisible)
  const [available, setAvailable] = useOptimistic(item.isAvailable)

  function reset() {
    setName(item.name)
    setPrice(item.basePriceCents)
  }

  // Nome e preço salvam no blur; Enter confirma, Esc desfaz.
  function saveText() {
    const cents = price
    const trimmed = name.trim()
    if (cents === null || !trimmed) { reset(); return }
    if (trimmed === item.name && cents === item.basePriceCents) return
    startTransition(async () => {
      const result = await updateItemAction(itemPayload(item, { name: trimmed, basePriceCents: cents }))
      if (result.ok) toast.add({ title: 'Item atualizado', type: 'success' })
      else { reset(); toast.add({ title: result.error, type: 'error' }) }
    })
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') event.currentTarget.blur()
    if (event.key === 'Escape') reset()
  }

  function move(next: string) {
    const source = categories.find((category) => category.id === item.categoryId)
    const target = categories.find((category) => category.id === next)
    if (!source || !target || source.id === target.id) return
    startTransition(async () => {
      setCategoryId(next)
      const result = await moveItemToCategory({
        restaurantId,
        item,
        categoryId: next,
        sourceIds: source.items.filter((entry) => entry.id !== item.id).map((entry) => entry.id),
        targetIds: [...target.items.map((entry) => entry.id), item.id],
      })
      toast.add(result.ok ? { title: `Item movido para ${target.name}`, type: 'success' } : { title: result.error, type: 'error' })
    })
  }

  function toggleVisible(next: boolean) {
    startTransition(async () => {
      setVisible(next)
      const result = await updateItemAction(itemPayload(item, { isVisible: next }))
      if (!result.ok) toast.add({ title: result.error, type: 'error' })
    })
  }

  function toggleAvailable(next: boolean) {
    startTransition(async () => {
      setAvailable(next)
      const result = await setItemAvailabilityAction({ itemId: item.id, isAvailable: next })
      if (!result.ok) toast.add({ title: result.error, type: 'error' })
    })
  }

  return (
    <StandaloneItemContextMenu
      restaurantId={restaurantId}
      item={item}
      categories={categories}
      onMove={move}
      disabled={!canEdit}
      render={<div className="tv-sheet-row" />}
    >
      <input className="tv-sheet-name" value={name} disabled={!canEdit} aria-label={`Nome de ${item.name}`} onChange={(event) => setName(event.target.value)} onBlur={saveText} onKeyDown={onKeyDown} />
      <Combobox
        label={`Categoria de ${item.name}`}
        options={categoryOptions}
        value={categoryId}
        onValueChange={move}
        size="sm"
        disabled={!canEdit || pending}
        className="tv-sheet-combo"
      />
      <label className="tv-sheet-price">
        <span aria-hidden="true">R$</span>
        <CurrencyInput valueCents={price} onValueChange={setPrice} disabled={!canEdit} aria-label={`Preço de ${item.name}`} onBlur={saveText} onKeyDown={onKeyDown} />
      </label>
      <label className="tv-sheet-toggle">
        <Switch checked={visible} disabled={!canEdit} onCheckedChange={(next) => toggleVisible(next)} aria-label={`${item.name} visível`} />
        <span aria-hidden="true">Visível</span>
      </label>
      <label className="tv-sheet-toggle">
        <Switch checked={available} disabled={!canEdit} onCheckedChange={(next) => toggleAvailable(next)} aria-label={`${item.name} disponível`} />
        <span aria-hidden="true">Disponível</span>
      </label>
    </StandaloneItemContextMenu>
  )
}
