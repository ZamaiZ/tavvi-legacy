'use client'

import { useId, useState, useTransition, type FormEvent } from 'react'
import { LuTrash2 } from 'react-icons/lu'
import { MobileSheet, MobileSheetNav, useMobileSheet } from '@/components/shell/mobile-sheet'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/toast'
import type { OwnerMenuCategoryDTO } from '@/domain/menu'
import { createCategoryAction, deleteCategoryAction, updateCategoryAction } from '@/server/actions/menu'
import { PanelConfirm } from '../panel-confirm'

// Nova categoria e Editar categoria no celular. Mesma lógica do
// CategoryDialog do desktop; na edição, Visível e Excluir.
export function CategorySheet({
  restaurantId,
  category,
  initialName,
  open,
  onOpenChange,
}: {
  restaurantId: string
  /** Sem categoria, o sheet cria uma. */
  category?: OwnerMenuCategoryDTO
  initialName?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <MobileSheet open={open} onOpenChange={onOpenChange}>
      <CategoryBody restaurantId={restaurantId} category={category} initialName={initialName} />
    </MobileSheet>
  )
}

function CategoryBody({
  restaurantId,
  category: openedWith,
  initialName,
}: {
  restaurantId: string
  category?: OwnerMenuCategoryDTO
  initialName?: string
}) {
  const { forceClose } = useMobileSheet()
  const formId = useId()
  // A categoria da abertura. Se ela sair da lista (excluída), o sheet não
  // vira "Nova categoria" durante a animação de saída.
  const [category] = useState(openedWith)
  const [name, setName] = useState(category?.name ?? initialName ?? '')
  const [visible, setVisible] = useState(category?.isVisible ?? true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, startDelete] = useTransition()

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const description = String(new FormData(event.currentTarget).get('description') ?? '') || undefined
    setPending(true)
    setError(null)
    const result = category
      ? await updateCategoryAction({ categoryId: category.id, name, description, isVisible: visible })
      : await createCategoryAction({ restaurantId, name, description })
    setPending(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    toast.add({ title: category ? 'Categoria salva' : 'Categoria criada', type: 'success' })
    forceClose()
  }

  function remove() {
    if (!category) return
    startDelete(async () => {
      const result = await deleteCategoryAction(category.id)
      toast.add(result.ok ? { title: 'Categoria excluída', type: 'success' } : { title: result.error, type: 'error' })
      if (result.ok) forceClose()
    })
  }

  // O banco apaga os itens em cascata: a confirmação diz quantos.
  const total = category?.items.length ?? 0

  return (
    <>
      <MobileSheetNav
        title={category ? 'Editar categoria' : 'Nova categoria'}
        action={{ label: category ? 'Salvar' : 'Criar', form: formId, pending, disabled: name.trim().length < 2 }}
      />
      <form id={formId} className="tv-msheet-screen" onSubmit={onSubmit} noValidate>
        <p className="tv-sheet-m-lead">Categorias agrupam os pratos no cardápio.</p>
        {error ? <p role="alert" className="tv-sheet-m-error">{error}</p> : null}
        <div className="tv-group">
          <label className="tv-frow">
            <span>Nome</span>
            <input name="name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} autoComplete="off" placeholder="Entradas" />
          </label>
        </div>
        <div className="tv-group">
          <textarea name="description" className="tv-farea" rows={3} maxLength={300} defaultValue={category?.description ?? ''} placeholder="Descrição (opcional)" aria-label="Descrição" />
        </div>
        {category ? (
          <>
            <div className="tv-group">
              <label className="tv-frow is-toggle">
                <span>Visível no cardápio</span>
                <Switch size="lg" checked={visible} onCheckedChange={(next) => setVisible(next)} />
              </label>
            </div>
            <div className="tv-group">
              <button type="button" className="tv-group-danger" disabled={deleting} onClick={() => setDeleteOpen(true)}>
                <LuTrash2 aria-hidden="true" />Excluir categoria
              </button>
            </div>
          </>
        ) : null}
      </form>
      {category ? (
        <PanelConfirm
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          icon={<LuTrash2 />}
          title={`Excluir a categoria ${category.name}?`}
          description={total > 0 ? `Os ${total} itens dentro dela também serão excluídos. Isto não pode ser desfeito.` : 'Isto não pode ser desfeito.'}
          confirmLabel="Excluir"
          destructive
          onConfirm={remove}
        />
      ) : null}
    </>
  )
}
