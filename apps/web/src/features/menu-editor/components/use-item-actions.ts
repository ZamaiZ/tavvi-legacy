'use client'

import { useOptimistic, useState, useTransition } from 'react'
import { toast } from '@/components/ui/toast'
import type { OwnerMenuCategoryDTO, OwnerMenuItemDTO } from '@/domain/menu'
import { deleteItemAction, setItemAvailabilityAction, updateItemAction } from '@/server/actions/menu'
import type { ActionResult } from '@/server/actions/result'
import { itemPayload, moveItemToCategory, saveItemOrder } from '../lib/menu-order'

type RunningAction = 'availability' | 'visibility' | 'move' | 'reorder' | 'delete'

// Ações de um item, as mesmas na linha (Lista/Índice) e no cartão (Grade).
// A disponibilidade é otimista: no meio do serviço ninguém espera a ida e
// volta ao servidor para ver o interruptor mudar.
export function useItemActions({
  restaurantId,
  item,
  siblings,
  categories,
}: {
  restaurantId: string
  item: OwnerMenuItemDTO
  /** Itens da categoria na ordem do servidor, sem busca nem filtro. */
  siblings: OwnerMenuItemDTO[]
  categories: OwnerMenuCategoryDTO[]
}) {
  const [pending, startTransition] = useTransition()
  const [available, setAvailable] = useOptimistic(item.isAvailable)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  // Qual ação está rodando: a linha mostra o progresso no controle certo.
  const [lastAction, setLastAction] = useState<RunningAction | null>(null)
  const index = siblings.findIndex((entry) => entry.id === item.id)

  function run(kind: RunningAction, action: () => Promise<ActionResult>, done: string, after?: () => void) {
    if (pending) return
    setLastAction(kind)
    startTransition(async () => {
      const result = await action()
      after?.()
      toast.add(result.ok ? { title: done, type: 'success' } : { title: result.error, type: 'error' })
    })
  }

  // `announce`: o celular confirma com toast ("Item esgotado"), como no
  // design; o desktop fica calado, porque o switch já diz tudo.
  function toggleAvailability(next: boolean, announce = false) {
    if (pending) return
    setLastAction('availability')
    startTransition(async () => {
      setAvailable(next)
      const result = await setItemAvailabilityAction({ itemId: item.id, isAvailable: next })
      if (!result.ok) toast.add({ title: result.error, type: 'error' })
      else if (announce) toast.add({ title: next ? 'Item disponível' : 'Item esgotado', type: 'success' })
    })
  }

  function toggleVisibility() {
    const next = !item.isVisible
    run('visibility', () => updateItemAction(itemPayload(item, { isVisible: next })), next ? 'Item exibido no cardápio' : 'Item ocultado')
  }

  function moveTo(categoryId: string) {
    const target = categories.find((category) => category.id === categoryId)
    if (!target || target.id === item.categoryId) return
    run(
      'move',
      () => moveItemToCategory({
        restaurantId,
        item,
        categoryId,
        sourceIds: siblings.filter((entry) => entry.id !== item.id).map((entry) => entry.id),
        targetIds: [...target.items.map((entry) => entry.id), item.id],
      }),
      `Item movido para ${target.name}`,
    )
  }

  function reorder(direction: -1 | 1) {
    const target = index + direction
    if (index < 0 || target < 0 || target >= siblings.length) return
    const ids = siblings.map((entry) => entry.id)
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    run('reorder', () => saveItemOrder(restaurantId, ids), 'Ordem atualizada')
  }

  // O alerta de excluir fica aberto com o progresso e fecha ao terminar.
  function remove() {
    run('delete', () => deleteItemAction(item.id), 'Item excluído', () => setDeleteOpen(false))
  }

  return {
    pending,
    running: pending ? lastAction : null,
    available,
    toggleAvailability,
    toggleVisibility,
    moveTo,
    reorder,
    remove,
    editOpen,
    setEditOpen,
    deleteOpen,
    setDeleteOpen,
    isFirst: index <= 0,
    isLast: index === siblings.length - 1,
  }
}

export type ItemActions = ReturnType<typeof useItemActions>
