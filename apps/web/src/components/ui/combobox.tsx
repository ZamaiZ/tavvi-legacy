'use client'

import { useState, type SyntheticEvent } from 'react'
import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox'
import { cn } from 'cn'
import { LuCheck, LuChevronRight, LuChevronsUpDown, LuSearch } from 'react-icons/lu'
import { MobileSheet, MobileSheetNav } from '@/components/shell/mobile-sheet'
import { useIsMobile } from '@/hooks/use-mobile'

export type ComboboxOption = { value: string; label: string; disabled?: boolean }

export type ComboboxProps = {
  options: ComboboxOption[]
  value: string | null
  onValueChange: (value: string) => void
  /** Nome acessível do gatilho e título do sheet no celular. */
  label: string
  id?: string
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  /** Grava o valor escolhido num campo oculto, para FormData. */
  name?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  /** 'row' é a linha de formulário do celular (.tv-frow). */
  variant?: 'field' | 'row'
  disabled?: boolean
  className?: string
  /** Dentro de cartão arrastável: o gatilho nunca inicia arrasto. */
  stopDragPropagation?: boolean
}

const stop = (event: SyntheticEvent) => event.stopPropagation()
const dragGuards = { onMouseDown: stop, onTouchStart: stop, onKeyDown: stop }

// Substitui todo <select> do console e do painel (spec de componentes §2).
// A busca fica sempre no topo da lista, inclusive nas listas curtas.
export function Combobox(props: ComboboxProps) {
  const isMobile = useIsMobile()
  if (props.variant === 'row' || isMobile) return <ComboboxSheet {...props} />
  return <ComboboxPopover {...props} />
}

// No celular, escolher é um sheet de baixo, como no iPhone: título do campo,
// busca de 16 px (sem zoom do iOS) e lista agrupada com ✓ dourado. A busca
// não ganha foco sozinha, para o teclado não cobrir a lista.
function ComboboxSheet({
  options,
  value,
  onValueChange,
  label,
  id,
  placeholder = 'Selecionar',
  searchPlaceholder = 'Buscar',
  emptyText = 'Nada encontrado.',
  name,
  size = 'md',
  variant = 'field',
  disabled,
  className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const selected = options.find((option) => option.value === value) ?? null

  const trigger = variant === 'row' ? (
    <button type="button" id={id} className={cn('tv-frow is-nav', className)} aria-haspopup="dialog" disabled={disabled} onClick={() => setOpen(true)}>
      <span>{label}</span>
      <span className="tv-frow-value">{selected?.label ?? placeholder}<LuChevronRight aria-hidden="true" /></span>
    </button>
  ) : (
    <button
      type="button"
      id={id}
      className={cn('tv-combo-trigger', `is-${size}`, className)}
      aria-label={label}
      aria-haspopup="dialog"
      data-placeholder={selected ? undefined : ''}
      disabled={disabled}
      onClick={() => setOpen(true)}
    >
      <span className="tv-combo-value">{selected?.label ?? placeholder}</span>
      <LuChevronsUpDown className="tv-combo-chevron" aria-hidden="true" />
    </button>
  )

  return (
    <>
      {trigger}
      {name ? <input type="hidden" name={name} value={value ?? ''} /> : null}
      <MobileSheet open={open} onOpenChange={setOpen} detent="content">
        <MobileSheetNav title={label} />
        {/* O corpo do MobileSheet só monta aberto: a busca recomeça a cada vez. */}
        <ComboboxPrimitive.Root
          inline
          open
          items={options}
          value={selected}
          onValueChange={(next: ComboboxOption | null) => {
            if (!next) return
            onValueChange(next.value)
            setOpen(false)
          }}
          isItemEqualToValue={(a: ComboboxOption, b: ComboboxOption) => a.value === b.value}
        >
          <label className="tv-combo-sheet-search">
            <LuSearch aria-hidden="true" />
            <ComboboxPrimitive.Input placeholder={searchPlaceholder} aria-label={`Buscar em ${label}`} />
          </label>
          <ComboboxPrimitive.Empty>
            <div className="tv-combo-sheet-empty">{emptyText}</div>
          </ComboboxPrimitive.Empty>
          <ComboboxPrimitive.List className="tv-group tv-combo-sheet-list">
            {(option: ComboboxOption) => (
              <ComboboxPrimitive.Item key={option.value} value={option} disabled={option.disabled} className="tv-choice">
                <span><strong>{option.label}</strong></span>
                {option.value === value ? <LuCheck aria-hidden="true" /> : null}
              </ComboboxPrimitive.Item>
            )}
          </ComboboxPrimitive.List>
        </ComboboxPrimitive.Root>
      </MobileSheet>
    </>
  )
}

function ComboboxPopover({
  options,
  value,
  onValueChange,
  label,
  id,
  placeholder = 'Selecionar',
  searchPlaceholder = 'Buscar',
  emptyText = 'Nada encontrado.',
  name,
  size = 'md',
  disabled,
  className,
  stopDragPropagation,
}: ComboboxProps) {
  const selected = options.find((option) => option.value === value) ?? null

  return (
    <ComboboxPrimitive.Root
      items={options}
      value={selected}
      onValueChange={(next: ComboboxOption | null) => {
        if (next) onValueChange(next.value)
      }}
      isItemEqualToValue={(a: ComboboxOption, b: ComboboxOption) => a.value === b.value}
      name={name}
      disabled={disabled}
      autoHighlight
    >
      <ComboboxPrimitive.Trigger
        id={id}
        aria-label={label}
        className={cn('tv-combo-trigger', `is-${size}`, className)}
        {...(stopDragPropagation ? dragGuards : {})}
      >
        <span className="tv-combo-value"><ComboboxPrimitive.Value placeholder={placeholder} /></span>
        <LuChevronsUpDown className="tv-combo-chevron" aria-hidden="true" />
      </ComboboxPrimitive.Trigger>
      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner className="tv-combo-positioner" align="start" sideOffset={4}>
          <ComboboxPrimitive.Popup className="tv-combo-popup" aria-label={label}>
            <label className="tv-combo-search">
              <LuSearch aria-hidden="true" />
              <ComboboxPrimitive.Input placeholder={searchPlaceholder} aria-label={`Buscar em ${label}`} />
            </label>
            <ComboboxPrimitive.Empty>
              <div className="tv-combo-empty">{emptyText}</div>
            </ComboboxPrimitive.Empty>
            <ComboboxPrimitive.List className="tv-combo-list">
              {(option: ComboboxOption) => (
                <ComboboxPrimitive.Item key={option.value} value={option} disabled={option.disabled} className="tv-combo-item">
                  <span>{option.label}</span>
                  <ComboboxPrimitive.ItemIndicator className="tv-combo-check">
                    <LuCheck aria-hidden="true" />
                  </ComboboxPrimitive.ItemIndicator>
                </ComboboxPrimitive.Item>
              )}
            </ComboboxPrimitive.List>
          </ComboboxPrimitive.Popup>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive.Root>
  )
}
