'use client'

import type { ReactElement, ReactNode } from 'react'
import { LuCornerDownRight } from 'react-icons/lu'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import type { OwnerMenuCategoryDTO, OwnerMenuItemDTO } from '@/domain/menu'
import { itemMenuModel, runItemMenuEntry } from '../lib/item-menu-model'
import { ItemDialogs } from './item-dialogs'
import { useItemActions, type ItemActions } from './use-item-actions'

type ItemContextMenuProps = {
  item: OwnerMenuItemDTO
  categories: OwnerMenuCategoryDTO[]
  /** Troca o "Mover para" padrão quando a tela guarda a ordem por conta própria (Planilha, Quadro). */
  onMove?: (categoryId: string) => void
  /** Quem não edita não recebe o menu. */
  disabled?: boolean
  /** A linha ou o cartão: vira a área do botão direito. */
  render: ReactElement
  children: ReactNode
}

// Botão direito no item (spec de componentes §4.3): as mesmas ações do "…".
export function ItemContextMenu({ item, categories, actions, onMove, disabled, render, children }: ItemContextMenuProps & { actions: ItemActions }) {
  const model = itemMenuModel(item, actions.available, categories)
  const move = onMove ?? actions.moveTo
  return (
    <ContextMenu disabled={disabled}>
      <ContextMenuTrigger render={render}>{children}</ContextMenuTrigger>
      <ContextMenuContent aria-label={`Ações do item ${item.name}`}>
        {model.primary.map((entry) => (
          <ContextMenuItem key={entry.key} onClick={() => runItemMenuEntry(entry.key, actions)}>
            <entry.icon aria-hidden="true" /><span>{entry.label}</span>
          </ContextMenuItem>
        ))}
        {model.moveTargets.length > 0 ? (
          <>
            <ContextMenuSeparator />
            <ContextMenuSub>
              <ContextMenuSubTrigger><LuCornerDownRight aria-hidden="true" /><span>Mover para</span></ContextMenuSubTrigger>
              <ContextMenuSubContent aria-label="Mover para">
                {model.moveTargets.map((target) => (
                  <ContextMenuItem key={target.id} className="is-target" onClick={() => move(target.id)}>
                    <LuCornerDownRight aria-hidden="true" /><span>{target.name}</span>
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
          </>
        ) : null}
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={() => runItemMenuEntry(model.remove.key, actions)}>
          <model.remove.icon aria-hidden="true" /><span>{model.remove.label}</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

// Para as telas que não têm as ações do item à mão (Planilha, Quadro,
// Estúdio, Sequência, Serviço): cria as ações e os diálogos de editar e excluir.
export function StandaloneItemContextMenu({ restaurantId, ...props }: ItemContextMenuProps & { restaurantId: string }) {
  const siblings = props.categories.find((category) => category.id === props.item.categoryId)?.items ?? []
  const actions = useItemActions({ restaurantId, item: props.item, siblings, categories: props.categories })
  return (
    <>
      <ItemContextMenu {...props} actions={actions} />
      {props.disabled ? null : <ItemDialogs item={props.item} categories={props.categories} actions={actions} />}
    </>
  )
}
