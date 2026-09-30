'use client'

import { ContextMenu as ContextMenuPrimitive } from '@base-ui/react/context-menu'
import { cn } from 'cn'
import { LuCheck, LuChevronRight } from 'react-icons/lu'
import { useFinePointer } from '@/hooks/use-fine-pointer'

// Menu do botão direito (spec de componentes §4.1). Só com mouse: no toque,
// o segurar e os deslizes de cada tela continuam no comando.
function ContextMenu({ disabled, ...props }: ContextMenuPrimitive.Root.Props) {
  const finePointer = useFinePointer()
  return <ContextMenuPrimitive.Root disabled={disabled || !finePointer} {...props} />
}

// O evento para na captura, e o menu do Base UI nem chega a ouvi-lo, em dois
// casos: dentro de campos editáveis, que ficam com o menu do navegador
// (copiar, colar); e quando vem de um portal (diálogo, menu "…", lista do
// combobox) que está dentro do gatilho na árvore do React, mas não no DOM.
function ContextMenuTrigger({ onContextMenuCapture, ...props }: ContextMenuPrimitive.Trigger.Props) {
  return (
    <ContextMenuPrimitive.Trigger
      data-slot="context-menu-trigger"
      {...props}
      onContextMenuCapture={(event) => {
        onContextMenuCapture?.(event)
        const target = event.target as Element
        if (!event.currentTarget.contains(target) || target.closest('input, textarea, [contenteditable="true"]')) event.stopPropagation()
      }}
    />
  )
}

function ContextMenuContent({ className, width = 'md', ...props }: ContextMenuPrimitive.Popup.Props & { width?: 'sm' | 'md' }) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Positioner className="tv-ctx-positioner">
        <ContextMenuPrimitive.Popup data-slot="context-menu-content" className={cn('tv-ctx-popup', width === 'sm' && 'is-sm', className)} {...props} />
      </ContextMenuPrimitive.Positioner>
    </ContextMenuPrimitive.Portal>
  )
}

function ContextMenuItem({ className, variant = 'default', ...props }: ContextMenuPrimitive.Item.Props & { variant?: 'default' | 'destructive' }) {
  return <ContextMenuPrimitive.Item data-slot="context-menu-item" data-variant={variant} className={cn('tv-ctx-item', className)} {...props} />
}

function ContextMenuSeparator({ className, ...props }: ContextMenuPrimitive.Separator.Props) {
  return <ContextMenuPrimitive.Separator className={cn('tv-ctx-separator', className)} {...props} />
}

function ContextMenuSub(props: ContextMenuPrimitive.SubmenuRoot.Props) {
  return <ContextMenuPrimitive.SubmenuRoot {...props} />
}

function ContextMenuSubTrigger({ className, children, ...props }: ContextMenuPrimitive.SubmenuTrigger.Props) {
  return (
    <ContextMenuPrimitive.SubmenuTrigger className={cn('tv-ctx-item', className)} {...props}>
      {children}
      <LuChevronRight className="tv-ctx-sub-arrow" aria-hidden="true" />
    </ContextMenuPrimitive.SubmenuTrigger>
  )
}

function ContextMenuSubContent({ className, ...props }: ContextMenuPrimitive.Popup.Props) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Positioner className="tv-ctx-positioner" side="right" align="start" alignOffset={-6} sideOffset={2}>
        <ContextMenuPrimitive.Popup data-slot="context-menu-content" className={cn('tv-ctx-popup is-sub', className)} {...props} />
      </ContextMenuPrimitive.Positioner>
    </ContextMenuPrimitive.Portal>
  )
}

function ContextMenuRadioGroup(props: ContextMenuPrimitive.RadioGroup.Props) {
  return <ContextMenuPrimitive.RadioGroup {...props} />
}

function ContextMenuRadioItem({ className, children, ...props }: ContextMenuPrimitive.RadioItem.Props) {
  return (
    <ContextMenuPrimitive.RadioItem className={cn('tv-ctx-item', className)} {...props}>
      <span>{children}</span>
      <ContextMenuPrimitive.RadioItemIndicator className="tv-ctx-check">
        <LuCheck aria-hidden="true" />
      </ContextMenuPrimitive.RadioItemIndicator>
    </ContextMenuPrimitive.RadioItem>
  )
}

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
}
