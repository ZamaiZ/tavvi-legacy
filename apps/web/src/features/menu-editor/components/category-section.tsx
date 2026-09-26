'use client'

import { useState, useTransition } from 'react'
import {
  RiDeleteBinLine,
  RiEyeLine,
  RiEyeOffLine,
  RiMore2Line,
  RiPencilLine,
} from 'react-icons/ri'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from '@/components/ui/toast'
import type { OwnerMenuCategoryDTO } from '@/domain/menu'
import {
  deleteCategoryAction,
  reorderCategoriesAction,
  updateCategoryAction,
} from '@/server/actions/menu'
import type { ActionResult } from '@/server/actions/result'
import { CategoryDialog } from './category-dialog'
import { ReorderButtons } from './reorder-buttons'

export function CategorySection({
  restaurantId,
  category,
  index,
  all,
  canEdit,
  canReorder = true,
  children,
}: {
  restaurantId: string
  category: OwnerMenuCategoryDTO
  index: number
  all: OwnerMenuCategoryDTO[]
  /** Só administrador edita. Esconder o controle é cortesia: a DAL e a RLS
      barram quem chamar a action na mão. */
  canEdit: boolean
  canReorder?: boolean
  children: React.ReactNode
}) {
  const [pending, startTransition] = useTransition()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  function run(action: () => Promise<ActionResult>, done: string) {
    startTransition(async () => {
      const result = await action()
      toast.add(
        result.ok
          ? { title: done, type: 'success' }
          : { title: result.error, type: 'error' },
      )
    })
  }

  function move(direction: -1 | 1) {
    // Troca de lugar com o vizinho e reenvia a lista inteira na nova ordem.
    // Reordenação é rara e barata; não vale otimizar para enviar só o par.
    const reordered = [...all]
    const target = index + direction
    ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]

    run(
      () =>
        reorderCategoriesAction({
          restaurantId,
          order: reordered.map((item, position) => ({
            id: item.id,
            position,
          })),
        }),
      'Ordem atualizada',
    )
  }

  // Um clique, sem diálogo. Ocultar uma categoria é decisão que se toma com o
  // serviço andando — a mesma razão pela qual o interruptor do item não pede
  // confirmação. O schema de atualização exige o registro inteiro de volta,
  // então o nome e a descrição são reenviados como estão.
  function toggleVisibility() {
    const next = !category.isVisible
    run(
      () =>
        updateCategoryAction({
          categoryId: category.id,
          name: category.name,
          description: category.description ?? undefined,
          isVisible: next,
        }),
      next ? 'Categoria visível no cardápio' : 'Categoria oculta',
    )
  }

  return (
    // `Card` com `CardHeader`, no lugar de `rounded-lg border` montado à mão.
    // O fio interno fica só ENTRE os itens — conteúdos de mesmo peso —, que é
    // a regra da Fase 5: fio de 1px em tudo achata, e nada parece estar acima
    // de nada.
    <Card id={`categoria-${category.id}`} className="tv-menu-category gap-0 overflow-hidden rounded-[22px] border-border/70 p-0 shadow-[var(--shadow-1)]">
      <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/70 bg-muted/15 px-4 py-3">
        <div className="min-w-0">
          <CardTitle className="text-base font-semibold tracking-[-0.015em]">
            {category.name}
            {/* Oculta é dito por escrito, não só pelo esmaecimento. */}
            {!category.isVisible ? (
              <span className="ml-2 align-middle text-xs font-normal text-muted-foreground">
                Oculta
              </span>
            ) : null}
          </CardTitle>
          <CardDescription className="mt-0.5 text-xs">
            {category.items.length}{' '}
            {category.items.length === 1 ? 'item' : 'itens'}
          </CardDescription>
        </div>

        {canEdit ? (
          <div className="flex shrink-0 items-center gap-2">
            {canReorder ? <ReorderButtons
              label={`categoria ${category.name}`}
              isFirst={index === 0}
              isLast={index === all.length - 1}
              disabled={pending}
              onUp={() => move(-1)}
              onDown={() => move(1)}
            /> : null}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Ações da categoria ${category.name}`}
                  />
                }
              >
                <RiMore2Line className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  <RiPencilLine className="size-4" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={toggleVisibility}>
                  {category.isVisible ? (
                    <RiEyeOffLine className="size-4" />
                  ) : (
                    <RiEyeLine className="size-4" />
                  )}
                  {category.isVisible ? 'Ocultar' : 'Mostrar'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDeleteOpen(true)}>
                  <RiDeleteBinLine className="size-4" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="p-0">{children}</CardContent>

      {/* Irmãos do menu, não filhos: ver o comentário em CategoryDialog. E
          montados só para quem edita — diálogo que ninguém consegue abrir é
          estado a mais na árvore, sem uso. */}
      {canEdit ? (
        <>
      <CategoryDialog
        restaurantId={restaurantId}
        category={{
          id: category.id,
          name: category.name,
          description: category.description,
          isVisible: category.isVisible,
        }}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir a categoria {category.name}?
            </AlertDialogTitle>
            {/* Conta quantos itens vão junto. O banco apaga em cascata;
                dizer só "não pode ser desfeito" esconderia o tamanho real
                do estrago. */}
            <AlertDialogDescription>
              {category.items.length > 0
                ? `Os ${category.items.length} itens dentro dela também serão excluídos. Isto não pode ser desfeito.`
                : 'Isto não pode ser desfeito.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                run(() => deleteCategoryAction(category.id), 'Categoria excluída')
              }
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
        </>
      ) : null}
    </Card>
  )
}
