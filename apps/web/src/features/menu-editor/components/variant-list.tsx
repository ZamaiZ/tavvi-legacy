'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { closestCenter, DndContext, DragOverlay, type DragEndEvent, type DragStartEvent, type UniqueIdentifier } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { LuGripVertical, LuPlus, LuTrash2 } from 'react-icons/lu'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Switch } from '@/components/ui/switch'
import { formatCents } from '@/lib/money'
import { LIFT_DROP_ANIMATION, panelAnnouncements, PANEL_DRAG_INSTRUCTIONS, usePanelSensors } from '../lib/dnd'
import { MAX_VARIANTS, type VariantDraft } from '../lib/item-draft'

// Variações do item em rascunho: acrescentar, editar, marcar esgotada,
// remover e reordenar não gravam nada — tudo vale no "Salvar" do item. A
// ordem aqui é a do cardápio público.
export function VariantList({
  variants,
  rowErrors,
  disabled,
  appearance = 'panel',
  focusKey,
  onAdd,
  onChange,
  onRemove,
  onMove,
}: {
  variants: VariantDraft[]
  rowErrors?: Record<string, string>
  disabled: boolean
  appearance?: 'panel' | 'mobile'
  /** Linha que deve ganhar foco (a criada ao trocar para Variações). */
  focusKey?: string | null
  onAdd: () => string
  onChange: (key: string, change: Partial<VariantDraft>) => void
  onRemove: (key: string) => void
  onMove: (activeKey: string, overKey: string) => void
}) {
  const dndId = useId()
  const sensors = usePanelSensors()
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const nameRefs = useRef(new Map<string, HTMLInputElement>())
  const pendingFocus = useRef<string | null>(null)
  const keys = variants.map((variant) => variant.key)
  const active = variants.find((variant) => variant.key === activeKey) ?? null
  const describe = (id: UniqueIdentifier) => `Variação ${keys.indexOf(String(id)) + 1}`

  // Foco na linha nova só com mouse e teclado: no celular abriria o teclado
  // sem a pessoa pedir.
  useEffect(() => {
    if (focusKey) pendingFocus.current = focusKey
  }, [focusKey])
  useEffect(() => {
    const key = pendingFocus.current
    if (!key) return
    const node = nameRefs.current.get(key)
    if (!node) return
    pendingFocus.current = null
    if (window.matchMedia('(pointer: fine)').matches) node.focus()
  })

  function add() {
    pendingFocus.current = onAdd()
  }

  function onDragStart({ active: dragged }: DragStartEvent) {
    setActiveKey(String(dragged.id))
  }

  function onDragEnd({ active: dragged, over }: DragEndEvent) {
    setActiveKey(null)
    if (over && dragged.id !== over.id) onMove(String(dragged.id), String(over.id))
  }

  return (
    <div className={`tv-vlist${appearance === 'mobile' ? ' is-mobile' : ''}`}>
      {variants.length > 0 && appearance === 'panel' ? (
        <div className="tv-vlist-head" aria-hidden="true"><span /><span>Nome</span><span>Preço</span><span>Disponível</span><span /></div>
      ) : null}
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveKey(null)}
        accessibility={{ announcements: panelAnnouncements(describe, describe), screenReaderInstructions: PANEL_DRAG_INSTRUCTIONS }}
      >
        <SortableContext items={keys} strategy={verticalListSortingStrategy}>
          <ol className="tv-vlist-rows">
            {variants.map((variant, index) => (
              <VariantRow
                key={variant.key}
                variant={variant}
                index={index}
                error={rowErrors?.[variant.key]}
                disabled={disabled}
                isLast={index === variants.length - 1}
                registerName={(node) => {
                  if (node) nameRefs.current.set(variant.key, node)
                  else nameRefs.current.delete(variant.key)
                }}
                onAddNext={add}
                onChange={(change) => onChange(variant.key, change)}
                onRemove={() => onRemove(variant.key)}
              />
            ))}
          </ol>
        </SortableContext>
        <DragOverlay className="tv-drag-overlay" dropAnimation={LIFT_DROP_ANIMATION}>
          {active ? (
            <div className="tv-vrow is-overlay tv-lift is-row">
              <span className="tv-vrow-grip" aria-hidden="true"><LuGripVertical /></span>
              <span className="tv-vrow-static">{active.name || 'Sem nome'}</span>
              <span className="tv-vrow-static is-price">{active.priceCents === null ? '—' : formatCents(active.priceCents)}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      <div className="tv-vlist-foot">
        <button type="button" className="tv-vlist-add" disabled={disabled || variants.length >= MAX_VARIANTS} onClick={add}>
          <LuPlus aria-hidden="true" />Adicionar variação
        </button>
        <span className="tv-vlist-note">
          {variants.length >= MAX_VARIANTS ? `Limite de ${MAX_VARIANTS} variações.` : 'Arraste pela alça para mudar a ordem no cardápio.'}
        </span>
      </div>
    </div>
  )
}

function VariantRow({
  variant,
  index,
  error,
  disabled,
  isLast,
  registerName,
  onAddNext,
  onChange,
  onRemove,
}: {
  variant: VariantDraft
  index: number
  error?: string
  disabled: boolean
  isLast: boolean
  registerName: (node: HTMLInputElement | null) => void
  onAddNext: () => void
  onChange: (change: Partial<VariantDraft>) => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: variant.key, disabled })
  const label = variant.name.trim() || `variação ${index + 1}`

  function onPriceKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    // Enter nunca envia o formulário do item daqui: no fim da lista ele
    // cria a próxima linha, e só no rascunho.
    event.preventDefault()
    if (isLast) onAddNext()
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`tv-vrow${isDragging ? ' is-placeholder' : ''}${error ? ' is-invalid' : ''}`}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="tv-vrow-grip"
        aria-label={`Mover ${label}`}
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <LuGripVertical aria-hidden="true" />
      </button>
      <input
        ref={registerName}
        className="tv-vrow-name"
        value={variant.name}
        maxLength={60}
        placeholder={index === 0 ? 'Tamanho P' : 'Nome'}
        aria-label={`Nome da variação ${index + 1}`}
        aria-invalid={error ? true : undefined}
        disabled={disabled}
        enterKeyHint="next"
        onChange={(event) => onChange({ name: event.target.value })}
        onKeyDown={(event) => { if (event.key === 'Enter') event.preventDefault() }}
      />
      <span className="tv-vrow-price">
        <span aria-hidden="true">R$</span>
        <CurrencyInput
          valueCents={variant.priceCents}
          onValueChange={(priceCents) => onChange({ priceCents })}
          aria-label={`Preço da variação ${index + 1}`}
          disabled={disabled}
          enterKeyHint={isLast ? 'next' : 'done'}
          onKeyDown={onPriceKeyDown}
        />
      </span>
      <Switch
        checked={variant.isAvailable}
        disabled={disabled}
        aria-label={`${label} disponível`}
        onCheckedChange={(next) => onChange({ isAvailable: next })}
      />
      <button type="button" className="tv-vrow-remove" aria-label={`Remover ${label}`} disabled={disabled} onClick={onRemove}>
        <LuTrash2 aria-hidden="true" />
      </button>
      {error ? <p role="alert" className="tv-vrow-error">{error}</p> : null}
    </li>
  )
}
