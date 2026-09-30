'use client'

import { useId, useLayoutEffect, useMemo, useRef, useState, useTransition, type ReactNode, type SyntheticEvent } from 'react'
import {
  closestCorners,
  DndContext,
  DragOverlay,
  useDroppable,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { LuLayoutGrid } from 'react-icons/lu'
import { Combobox } from '@/components/ui/combobox'
import { toast } from '@/components/ui/toast'
import type { OwnerMenuCategoryDTO, OwnerMenuItemDTO } from '@/domain/menu'
import { PanelEmptyState } from '@/features/workspace/components/panel-empty-state'
import { panelAnnouncements, PANEL_DRAG_INSTRUCTIONS, usePanelSensors } from '../../lib/dnd'
import { priceLabel } from '../../lib/item-display'
import { moveItemToCategory, saveItemOrder } from '../../lib/menu-order'
import { StandaloneItemContextMenu } from '../item-context-menu'
import { NewCategoryButton } from '../new-category-button'

type Columns = Record<string, string[]>
const COLUMN = 'column:'

// Menus e listas portados mandam os eventos pela árvore do React até o
// cartão, mas não estão dentro dele no DOM: esses nunca iniciam arrasto.
const fromInside = (event: SyntheticEvent) => event.currentTarget.contains(event.target as Node)

function toColumns(categories: OwnerMenuCategoryDTO[]): Columns {
  return Object.fromEntries(categories.map((category) => [category.id, category.items.map((item) => item.id)]))
}

function columnOf(columns: Columns, id: UniqueIdentifier): string | null {
  const key = String(id)
  if (key.startsWith(COLUMN)) return key.slice(COLUMN.length)
  return Object.keys(columns).find((column) => columns[column].includes(key)) ?? null
}

// Quadro (README §7.5, item 11): uma coluna por categoria, cartões que
// arrastam entre colunas e dentro delas. A ordem aparece na hora e volta
// atrás, com aviso, se o servidor recusar.
export function BoardMode({ restaurantId, categories, canEdit }: { restaurantId: string; categories: OwnerMenuCategoryDTO[]; canEdit: boolean }) {
  const dndId = useId()
  const sensors = usePanelSensors()
  const boardRef = useRef<HTMLElement>(null)
  const [pending, startTransition] = useTransition()
  const serverColumns = useMemo(() => toColumns(categories), [categories])
  const [columns, setColumns] = useState<Columns>(serverColumns)
  const [syncedFrom, setSyncedFrom] = useState(serverColumns)
  const [activeId, setActiveId] = useState<string | null>(null)
  const snapshot = useRef<Columns>(serverColumns)
  const itemsById = useMemo(() => new Map(categories.flatMap((category) => category.items.map((item) => [item.id, item] as const))), [categories])
  const namesById = useMemo(() => new Map(categories.map((category) => [category.id, category.name] as const)), [categories])

  // O servidor é a fonte da verdade: a revalidação traz a ordem nova e o
  // quadro volta a espelhá-la — exceto no meio de um arrasto.
  if (syncedFrom !== serverColumns && !activeId) {
    setSyncedFrom(serverColumns)
    setColumns(serverColumns)
  }

  // As colunas ocupam a altura até o fim da janela; rolam por dentro e a
  // coluna inteira é área de soltar.
  useLayoutEffect(() => {
    const board = boardRef.current
    if (!board) return
    const fit = () => {
      const top = board.getBoundingClientRect().top + window.scrollY
      board.style.setProperty('--tv-board-height', `${Math.max(420, window.innerHeight - top - 24)}px`)
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(document.body)
    window.addEventListener('resize', fit)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', fit)
    }
  }, [categories.length > 0])

  const describe = (id: UniqueIdentifier) => itemsById.get(String(id))?.name ?? 'Item'
  const place = (id: UniqueIdentifier) => {
    const key = String(id)
    return key.startsWith(COLUMN) ? `coluna ${namesById.get(key.slice(COLUMN.length)) ?? ''}` : describe(id)
  }

  function persist(id: string, from: string | null, to: string, next: Columns) {
    const item = itemsById.get(id)
    const previous = snapshot.current
    if (!item || !from) return
    if (from === to && previous[to]?.join() === next[to].join()) return
    startTransition(async () => {
      const result = from === to
        ? await saveItemOrder(restaurantId, next[to])
        : await moveItemToCategory({ restaurantId, item, categoryId: to, sourceIds: next[from], targetIds: next[to] })
      if (result.ok) {
        toast.add({ title: from === to ? 'Ordem atualizada' : `Item movido para ${namesById.get(to)}`, type: 'success' })
      } else {
        setColumns(previous)
        toast.add({ title: result.error, type: 'error' })
      }
    })
  }

  function onDragStart({ active }: DragStartEvent) {
    snapshot.current = columns
    setActiveId(String(active.id))
  }

  // Entre colunas, o cartão muda de lista ainda durante o arrasto, para o
  // espaço reservado aparecer onde ele vai cair.
  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return
    const from = columnOf(columns, active.id)
    const to = columnOf(columns, over.id)
    if (!from || !to || from === to) return
    const id = String(active.id)
    setColumns((current) => {
      const target = current[to].filter((entry) => entry !== id)
      const overIndex = target.indexOf(String(over.id))
      target.splice(overIndex >= 0 ? overIndex : target.length, 0, id)
      return { ...current, [from]: current[from].filter((entry) => entry !== id), [to]: target }
    })
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    const id = String(active.id)
    const to = over ? columnOf(columns, over.id) : null
    if (!over || !to) {
      setColumns(snapshot.current)
      return
    }
    const list = columns[to]
    const fromIndex = list.indexOf(id)
    const overIndex = list.indexOf(String(over.id))
    const next = overIndex >= 0 && fromIndex >= 0 && fromIndex !== overIndex ? { ...columns, [to]: arrayMove(list, fromIndex, overIndex) } : columns
    setColumns(next)
    persist(id, columnOf(snapshot.current, id), to, next)
  }

  function onDragCancel() {
    setActiveId(null)
    setColumns(snapshot.current)
  }

  function moveViaSelect(id: string, to: string) {
    const from = columnOf(columns, id)
    if (!from || from === to) return
    const next = { ...columns, [from]: columns[from].filter((entry) => entry !== id), [to]: [...columns[to], id] }
    snapshot.current = columns
    setColumns(next)
    persist(id, from, to, next)
  }

  if (categories.length === 0) {
    return (
      <PanelEmptyState
        density="section"
        icon={<LuLayoutGrid />}
        title="Crie uma categoria para abrir o quadro"
        description="Cada categoria vira uma coluna onde você pode organizar os itens."
        action={canEdit ? <NewCategoryButton restaurantId={restaurantId} appearance="chip" /> : undefined}
      />
    )
  }

  const activeItem = activeId ? itemsById.get(activeId) ?? null : null

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
      accessibility={{ announcements: panelAnnouncements(describe, place), screenReaderInstructions: PANEL_DRAG_INSTRUCTIONS }}
    >
      <section ref={boardRef} className="tv-board" aria-label="Quadro por categoria">
        {categories.map((category) => {
          const ids = columns[category.id] ?? []
          return (
            <BoardColumn key={category.id} id={category.id} name={category.name} count={ids.length}>
              <SortableContext id={category.id} items={ids} strategy={verticalListSortingStrategy}>
                {ids.map((id) => {
                  const item = itemsById.get(id)
                  return item ? (
                    <SortableBoardCard key={id} restaurantId={restaurantId} item={item} columnId={category.id} categories={categories} disabled={!canEdit || pending} onMove={canEdit ? moveViaSelect : undefined} />
                  ) : null
                })}
              </SortableContext>
              {ids.length === 0 ? (
                <div className="tv-bcol-empty"><strong>Coluna livre</strong>Solte um item nesta coluna para organizá-lo aqui.</div>
              ) : null}
            </BoardColumn>
          )
        })}
      </section>
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' }}>
        {activeItem ? (
          <article className="tv-bcard is-overlay">
            <BoardCardContent item={activeItem} columnId={columnOf(columns, activeItem.id) ?? activeItem.categoryId} categories={categories} disabled />
          </article>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

function BoardColumn({ id, name, count, children }: { id: string; name: string; count: number; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${COLUMN}${id}` })
  return (
    <div className={`tv-bcol${isOver ? ' is-over' : ''}`}>
      <header><strong>{name}</strong><span>{count}</span></header>
      <div ref={setNodeRef} className="tv-bcol-list">{children}</div>
    </div>
  )
}

function SortableBoardCard({
  restaurantId,
  item,
  columnId,
  categories,
  disabled,
  onMove,
}: {
  restaurantId: string
  item: OwnerMenuItemDTO
  columnId: string
  categories: OwnerMenuCategoryDTO[]
  disabled: boolean
  onMove?: (id: string, categoryId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled })
  // O botão direito não inicia arrasto: o MouseSensor do dnd-kit só reage ao
  // botão principal.
  return (
    <StandaloneItemContextMenu
      restaurantId={restaurantId}
      item={item}
      categories={categories}
      onMove={onMove ? (categoryId) => onMove(item.id, categoryId) : undefined}
      disabled={!onMove}
      render={
        <article
          ref={setNodeRef}
          style={{ transform: CSS.Translate.toString(transform), transition }}
          className={`tv-bcard${isDragging ? ' is-placeholder' : ''}`}
          {...attributes}
          onMouseDown={(event) => { if (fromInside(event)) listeners?.onMouseDown?.(event) }}
          onTouchStart={(event) => { if (fromInside(event)) listeners?.onTouchStart?.(event) }}
          onKeyDown={(event) => { if (fromInside(event)) listeners?.onKeyDown?.(event) }}
          aria-label={`${item.name}, ${priceLabel(item)}, ${item.isAvailable ? 'disponível' : 'esgotado'}`}
        />
      }
    >
      <BoardCardContent item={item} columnId={columnId} categories={categories} disabled={disabled} onMove={onMove} />
    </StandaloneItemContextMenu>
  )
}

function BoardCardContent({
  item,
  columnId,
  categories,
  disabled,
  onMove,
}: {
  item: OwnerMenuItemDTO
  columnId: string
  categories: OwnerMenuCategoryDTO[]
  disabled: boolean
  onMove?: (id: string, categoryId: string) => void
}) {
  return (
    <>
      <strong>{item.name}</strong>
      <div className="tv-bcard-meta">
        <span>{priceLabel(item)}</span>
        <span>{item.isAvailable ? 'Disponível' : 'Esgotado'}</span>
      </div>
      {/* O gatilho nunca inicia arrasto e as teclas dele não vão para o
          sensor de teclado do cartão. */}
      <Combobox
        label={`Mover ${item.name} para outra categoria`}
        options={categories.map((category) => ({ value: category.id, label: category.name }))}
        value={columnId}
        onValueChange={(next) => onMove?.(item.id, next)}
        size="xs"
        disabled={disabled || !onMove}
        className="tv-bcard-combo"
        stopDragPropagation
      />
    </>
  )
}
