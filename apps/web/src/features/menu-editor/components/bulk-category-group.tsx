'use client'

import { useEffect, useRef, useState } from 'react'
import { LuChevronDown, LuFolder, LuPlus, LuTrash2 } from 'react-icons/lu'
import type { OwnerMenuCategoryDTO } from '@/domain/menu'
import type { BulkDraftErrors, BulkItemDraft, NewMenuCategoryDraft } from '../lib/bulk-menu-draft'
import type { ItemDraft, VariantDraft } from '../lib/item-draft'
import { BulkItemRow } from './bulk-item-row'

export function BulkCategoryGroup({
  category,
  items,
  newCategory,
  canAddItem,
  disabled,
  errors,
  revealErrorTick,
  mediaNotices,
  inspectingItems,
  categories,
  newCategories,
  onAddItem,
  onRemoveCategory,
  onToggleItem,
  onChangeItem,
  onSetPricing,
  onAddVariant,
  onUpdateVariant,
  onRemoveVariant,
  onMoveVariant,
  onAddFiles,
  onRemoveMedia,
  onMoveMedia,
  onMakeCover,
  onRemoveItem,
}: {
  category: OwnerMenuCategoryDTO | NewMenuCategoryDraft
  items: BulkItemDraft[]
  newCategory: boolean
  canAddItem: boolean
  disabled: boolean
  errors: Record<string, BulkDraftErrors>
  revealErrorTick: number
  mediaNotices: Record<string, string[]>
  inspectingItems: string[]
  categories: OwnerMenuCategoryDTO[]
  newCategories: NewMenuCategoryDraft[]
  onAddItem: () => void
  onRemoveCategory: () => void
  onToggleItem: (rowId: string) => void
  onChangeItem: (rowId: string, field: keyof ItemDraft, value: unknown) => void
  onSetPricing: (rowId: string, mode: ItemDraft['pricing']) => void
  onAddVariant: (rowId: string) => string
  onUpdateVariant: (rowId: string, key: string, change: Partial<VariantDraft>) => void
  onRemoveVariant: (rowId: string, key: string) => void
  onMoveVariant: (rowId: string, activeKey: string, overKey: string) => void
  onAddFiles: (rowId: string, files: File[]) => void
  onRemoveMedia: (rowId: string, key: string) => void
  onMoveMedia: (rowId: string, activeKey: string, overKey: string) => void
  onMakeCover: (rowId: string, key: string) => void
  onRemoveItem: (rowId: string) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const previousItemCount = useRef(items.length)
  const categoryError = errors[`category:${category.id}`]
  const hasInvalidItem = items.some((item) => Boolean(errors[item.id]))
  const contentId = `bulk-category-${category.id}-content`

  useEffect(() => {
    if (hasInvalidItem && revealErrorTick > 0) setExpanded(true)
  }, [hasInvalidItem, revealErrorTick])

  useEffect(() => {
    if (items.length > previousItemCount.current) setExpanded(true)
    previousItemCount.current = items.length
  }, [items.length])

  function addItem() {
    setExpanded(true)
    onAddItem()
  }

  return (
    <section className={`tv-bulk-category-group${newCategory ? ' is-new' : ''}`} data-bulk-category={category.id}>
      <header className="tv-bulk-category-head">
        <span className="tv-bulk-category-icon"><LuFolder aria-hidden="true" /></span>
        <div className="tv-bulk-category-copy">
          <h2>{category.name || 'Categoria sem nome'}</h2>
          <span>{items.length} {items.length === 1 ? 'item neste lote' : 'itens neste lote'}{newCategory ? ' · Nova categoria' : ''}</span>
          {categoryError?.name ? <p className="tv-pfield-error">{categoryError.name}</p> : null}
        </div>
        {newCategory ? <button type="button" className="tv-bulk-remove-category" disabled={disabled || items.length > 0} onClick={onRemoveCategory} aria-label={`Remover categoria ${category.name}`}><LuTrash2 aria-hidden="true" /></button> : null}
        <button
          type="button"
          className="tv-bulk-category-toggle"
          aria-label={`${expanded ? 'Recolher' : 'Expandir'} itens da categoria ${category.name}`}
          aria-expanded={expanded}
          aria-controls={contentId}
          title={expanded ? 'Recolher itens' : 'Expandir itens'}
          disabled={disabled}
          onClick={() => setExpanded((current) => !current)}
        >
          <LuChevronDown aria-hidden="true" />
          <span className="tv-bulk-category-toggle-label">{expanded ? 'Recolher' : 'Expandir'}</span>
        </button>
        <button type="button" className="tv-pbtn is-sm" disabled={disabled || !canAddItem} onClick={addItem}>
          <LuPlus aria-hidden="true" />Adicionar item
        </button>
      </header>
      <div
        id={contentId}
        className={`tv-bulk-category-collapse${expanded ? ' is-open' : ''}`}
        aria-hidden={!expanded}
        inert={!expanded}
      >
        <div className="tv-bulk-category-collapse-inner">
          {items.length > 0 ? (
            <div className="tv-bulk-category-items">
              {items.map((row, index) => (
                <BulkItemRow
                  key={row.id}
                  row={row}
                  index={index + 1}
                  errors={errors[row.id]}
                  mediaNotices={mediaNotices[row.id] ?? []}
                  inspecting={inspectingItems.includes(row.id)}
                  categories={categories}
                  newCategories={newCategories}
                  disabled={disabled}
                  onToggle={() => onToggleItem(row.id)}
                  onChange={(field, value) => onChangeItem(row.id, field, value)}
                  onSetPricing={(mode) => onSetPricing(row.id, mode)}
                  onAddVariant={() => onAddVariant(row.id)}
                  onUpdateVariant={(key, change) => onUpdateVariant(row.id, key, change)}
                  onRemoveVariant={(key) => onRemoveVariant(row.id, key)}
                  onMoveVariant={(activeKey, overKey) => onMoveVariant(row.id, activeKey, overKey)}
                  onAddFiles={(files) => onAddFiles(row.id, files)}
                  onRemoveMedia={(key) => onRemoveMedia(row.id, key)}
                  onMoveMedia={(activeKey, overKey) => onMoveMedia(row.id, activeKey, overKey)}
                  onMakeCover={(key) => onMakeCover(row.id, key)}
                  onRemove={() => onRemoveItem(row.id)}
                />
              ))}
            </div>
          ) : (
            <div className="tv-bulk-category-empty">
              <span>Os itens que você adicionar aqui ficam nesta categoria.</span>
              <button type="button" className="tv-add-item" disabled={disabled || !canAddItem} onClick={addItem}><LuPlus aria-hidden="true" />Adicionar primeiro item</button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
