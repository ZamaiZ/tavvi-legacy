'use client'

import { useState, useTransition } from 'react'
import { LuEllipsis, LuEye, LuEyeOff, LuPencil, LuTrash2 } from 'react-icons/lu'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from '@/components/ui/toast'
import type { OwnerMenuCategoryDTO } from '@/domain/menu'
import { PanelConfirm } from '@/features/workspace/components/panel-confirm'
import { deleteCategoryAction, reorderCategoriesAction, updateCategoryAction } from '@/server/actions/menu'
import type { ActionResult } from '@/server/actions/result'
import { CategoryDialog } from './category-dialog'
import { ReorderButtons } from './reorder-buttons'

// Cartão da categoria (README §7.5, item 5): nome, "Oculta", contagem, setas
// só com Ordenar ligado e o menu Editar · Ocultar · Excluir.
export function CategorySection({
  restaurantId,
  category,
  shownCount,
  index,
  all,
  canEdit,
  reorderMode,
  children,
}: {
  restaurantId: string
  /** A categoria inteira, do servidor. */
  category: OwnerMenuCategoryDTO
  /** Quantos itens aparecem agora (depois de busca e filtro). */
  shownCount: number
  index: number
  all: OwnerMenuCategoryDTO[]
  /** Só administrador edita. Esconder o controle é cortesia: a DAL e a RLS
      barram quem chamar a action na mão. */
  canEdit: boolean
  reorderMode: boolean
  children: React.ReactNode
}) {
  const [pending, startTransition] = useTransition()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const titleId = `categoria-${category.id}-titulo`

  function run(action: () => Promise<ActionResult>, done: string) {
    startTransition(async () => {
      const result = await action()
      toast.add(result.ok ? { title: done, type: 'success' } : { title: result.error, type: 'error' })
    })
  }

  // Troca de lugar com a vizinha e reenvia a lista inteira na nova ordem.
  function move(direction: -1 | 1) {
    const order = [...all]
    const target = index + direction
    ;[order[index], order[target]] = [order[target], order[index]]
    run(() => reorderCategoriesAction({ restaurantId, order: order.map((entry, position) => ({ id: entry.id, position })) }), 'Ordem atualizada')
  }

  // Um clique, sem diálogo: ocultar é decisão tomada com o serviço andando.
  // O schema exige o registro inteiro, então nome e descrição vão como estão.
  function toggleVisibility() {
    const next = !category.isVisible
    run(
      () => updateCategoryAction({ categoryId: category.id, name: category.name, description: category.description ?? undefined, isVisible: next }),
      next ? 'Categoria visível no cardápio' : 'Categoria oculta',
    )
  }

  // O "…" e o botão direito oferecem as mesmas ações (spec de componentes §4.2).
  const entries = [
    { key: 'edit', label: 'Editar', icon: LuPencil, run: () => setEditOpen(true) },
    { key: 'visibility', label: category.isVisible ? 'Ocultar' : 'Mostrar', icon: category.isVisible ? LuEyeOff : LuEye, run: toggleVisibility },
  ]

  const total = category.items.length

  return (
    <section id={`categoria-${category.id}`} className="tv-cat" aria-labelledby={titleId}>
      <ContextMenu disabled={!canEdit}>
        <ContextMenuTrigger render={<header className="tv-cat-head" />}>
          <div className="tv-cat-title">
            <h3 id={titleId}>{category.name}</h3>
            {!category.isVisible ? <span>Oculta</span> : null}
            <span>{shownCount} {shownCount === 1 ? 'item' : 'itens'}</span>
          </div>
          {canEdit && reorderMode ? (
            <ReorderButtons
              label={`categoria ${category.name}`}
              isFirst={index === 0}
              isLast={index === all.length - 1}
              disabled={pending}
              onUp={() => move(-1)}
              onDown={() => move(1)}
            />
          ) : null}
          {canEdit ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="tv-picon is-more" aria-label={`Ações da categoria ${category.name}`}>
                <LuEllipsis aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={4} className="is-category">
                {entries.map((entry) => <DropdownMenuItem key={entry.key} onClick={entry.run}><entry.icon />{entry.label}</DropdownMenuItem>)}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}><LuTrash2 />Excluir</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </ContextMenuTrigger>
        <ContextMenuContent width="sm" aria-label={`Ações da categoria ${category.name}`}>
          {entries.map((entry) => (
            <ContextMenuItem key={entry.key} onClick={entry.run}><entry.icon aria-hidden="true" /><span>{entry.label}</span></ContextMenuItem>
          ))}
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}><LuTrash2 aria-hidden="true" /><span>Excluir</span></ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {children}

      {/* Irmãos do menu, não filhos: ver o comentário em CategoryDialog. */}
      {canEdit ? (
        <>
          <CategoryDialog
            restaurantId={restaurantId}
            category={{ id: category.id, name: category.name, description: category.description, isVisible: category.isVisible }}
            open={editOpen}
            onOpenChange={setEditOpen}
          />
          {/* Conta quantos itens vão junto: o banco apaga em cascata. */}
          <PanelConfirm
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            icon={<LuTrash2 />}
            title={`Excluir a categoria ${category.name}?`}
            description={total > 0 ? `Os ${total} itens dentro dela também serão excluídos. Isto não pode ser desfeito.` : 'Isto não pode ser desfeito.'}
            confirmLabel="Excluir"
            destructive
            onConfirm={() => run(() => deleteCategoryAction(category.id), 'Categoria excluída')}
          />
        </>
      ) : null}
    </section>
  )
}
