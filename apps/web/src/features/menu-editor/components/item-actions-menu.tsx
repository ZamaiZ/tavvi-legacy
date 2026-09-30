'use client'

import { useState } from 'react'
import { LuEllipsis } from 'react-icons/lu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { OwnerMenuCategoryDTO, OwnerMenuItemDTO } from '@/domain/menu'
import { itemMenuModel, runItemMenuEntry } from '../lib/item-menu-model'
import { MoveToCategory } from './move-to-category'
import type { ItemActions } from './use-item-actions'

// Menu do item: Editar · Esgotado/Disponível · Ocultar | Mover para | Excluir.
// Os rótulos vêm do modelo que o botão direito também usa.
export function ItemActionsMenu({
  item,
  categories,
  actions,
  triggerClassName = 'tv-picon is-more',
  open: controlledOpen,
  onOpenChange,
  touch = false,
}: {
  item: OwnerMenuItemDTO
  categories: OwnerMenuCategoryDTO[]
  actions: ItemActions
  triggerClassName?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Aberto pelo segurar no celular: nenhum campo recebe o foco sozinho. */
  touch?: boolean
}) {
  const [localOpen, setLocalOpen] = useState(false)
  const open = controlledOpen ?? localOpen
  const setOpen = onOpenChange ?? setLocalOpen
  const model = itemMenuModel(item, actions.available, categories)

  return (
    <DropdownMenu open={open} onOpenChange={(next) => setOpen(next)}>
      <DropdownMenuTrigger className={triggerClassName} aria-label={`Ações do item ${item.name}`}>
        <LuEllipsis aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={4} className="is-item">
        {model.primary.map((entry) => (
          <DropdownMenuItem key={entry.key} onClick={() => runItemMenuEntry(entry.key, actions)}>
            <entry.icon />{entry.label}
          </DropdownMenuItem>
        ))}
        {model.moveTargets.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <MoveToCategory
              item={item}
              categories={categories}
              touch={touch}
              onMove={(categoryId) => {
                setOpen(false)
                actions.moveTo(categoryId)
              }}
            />
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => runItemMenuEntry(model.remove.key, actions)}>
          <model.remove.icon />{model.remove.label}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
