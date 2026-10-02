'use client'

import { useId, useState, useTransition, type ClipboardEvent, type FormEvent } from 'react'
import { LuPlus, LuTrash2 } from 'react-icons/lu'
import { MobileSheet, MobileSheetNav, useMobileSheet, useSheetBusy } from '@/components/shell/mobile-sheet'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/toast'
import { MAX_CATEGORIES_PER_BATCH, type OwnerMenuCategoryDTO } from '@/domain/menu'
import {
  insertPastedNames,
  newCategoryRow,
  splitPastedNames,
  validateCategoryRows,
  type CategoryRowDraft,
} from '@/features/menu-editor/lib/category-batch'
import { createCategoriesAction, deleteCategoryAction, updateCategoryAction } from '@/server/actions/menu'
import { PanelConfirm } from '../panel-confirm'

// Nova categoria (em lote) e Editar categoria no celular. Mesma lógica do
// CategoryDialog do desktop; na edição, Visível e Excluir.
export function CategorySheet({
  restaurantId,
  category,
  initialName,
  open,
  onOpenChange,
}: {
  restaurantId: string
  /** Sem categoria, o sheet cria uma ou várias. */
  category?: OwnerMenuCategoryDTO
  initialName?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <MobileSheet open={open} onOpenChange={onOpenChange}>
      {category ? (
        <EditCategoryBody category={category} />
      ) : (
        <CreateCategoriesBody restaurantId={restaurantId} initialName={initialName} />
      )}
    </MobileSheet>
  )
}

function EditCategoryBody({ category: openedWith }: { category: OwnerMenuCategoryDTO }) {
  const { forceClose } = useMobileSheet()
  const formId = useId()
  // A categoria da abertura. Se ela sair da lista (excluída), o sheet não
  // muda de conteúdo durante a animação de saída.
  const [category] = useState(openedWith)
  const [name, setName] = useState(category.name)
  const [description, setDescription] = useState(category.description ?? '')
  const [visible, setVisible] = useState(category.isVisible)
  const [error, setError] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [saving, startSave] = useTransition()
  const [deleting, startDelete] = useTransition()
  const busy = saving || deleting
  useSheetBusy(busy)

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    startSave(async () => {
      const result = await updateCategoryAction({
        categoryId: category.id,
        name,
        description: description || undefined,
        isVisible: visible,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      toast.add({ title: 'Categoria salva', type: 'success' })
      forceClose()
    })
  }

  function remove() {
    startDelete(async () => {
      const result = await deleteCategoryAction(category.id)
      if (!result.ok) {
        setDeleteOpen(false)
        toast.add({ title: result.error, type: 'error' })
        return
      }
      toast.add({ title: 'Categoria excluída', type: 'success' })
      setDeleteOpen(false)
      forceClose()
    })
  }

  // O banco apaga os itens em cascata: a confirmação diz quantos.
  const total = category.items.length

  return (
    <>
      <MobileSheetNav
        title="Editar categoria"
        action={{ label: 'Salvar', pendingLabel: 'Salvando…', form: formId, pending: saving, disabled: deleting || name.trim().length < 2 }}
      />
      <form id={formId} className="tv-msheet-screen" onSubmit={onSubmit} noValidate aria-busy={busy || undefined}>
        <p className="tv-sheet-m-lead">Categorias agrupam os pratos no cardápio.</p>
        {error ? <p role="alert" className="tv-sheet-m-error">{error}</p> : null}
        <fieldset disabled={busy} className="tv-msheet-fieldset">
          <div className="tv-group">
            <label className="tv-frow">
              <span>Nome</span>
              <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} autoComplete="off" placeholder="Entradas" />
            </label>
          </div>
          <div className="tv-group">
            <textarea className="tv-farea" rows={3} maxLength={300} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Descrição (opcional)" aria-label="Descrição" />
          </div>
          <div className="tv-group">
            <label className="tv-frow is-toggle">
              <span>Visível no cardápio</span>
              <Switch size="lg" checked={visible} disabled={busy} onCheckedChange={(next) => setVisible(next)} />
            </label>
          </div>
          <div className="tv-group">
            <button type="button" className="tv-group-danger" onClick={() => setDeleteOpen(true)}>
              <LuTrash2 aria-hidden="true" />{deleting ? 'Excluindo…' : 'Excluir categoria'}
            </button>
          </div>
        </fieldset>
      </form>
      <PanelConfirm
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        icon={<LuTrash2 />}
        title={`Excluir a categoria ${category.name}?`}
        description={total > 0 ? `Os ${total} itens dentro dela também serão excluídos. Isto não pode ser desfeito.` : 'Isto não pode ser desfeito.'}
        confirmLabel="Excluir"
        pendingLabel="Excluindo…"
        pending={deleting}
        destructive
        onConfirm={remove}
      />
    </>
  )
}

function CreateCategoriesBody({ restaurantId, initialName }: { restaurantId: string; initialName?: string }) {
  const { forceClose } = useMobileSheet()
  const formId = useId()
  const [rows, setRows] = useState<CategoryRowDraft[]>(() => [newCategoryRow(initialName ?? '')])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  useSheetBusy(pending)
  const count = validateCategoryRows(rows).valid.length

  function updateRow(key: string, change: Partial<CategoryRowDraft>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...change } : row)))
    setErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  function addRow() {
    if (rows.length >= MAX_CATEGORIES_PER_BATCH) {
      setNotice(`Só cabem ${MAX_CATEGORIES_PER_BATCH} categorias por vez.`)
      return
    }
    // Sem foco automático: no celular ele abriria o teclado sem pedir.
    setRows((current) => [...current, newCategoryRow()])
  }

  function onNamePaste(event: ClipboardEvent<HTMLInputElement>, key: string) {
    const names = splitPastedNames(event.clipboardData.getData('text'))
    if (names.length < 2) return
    event.preventDefault()
    const result = insertPastedNames(rows, key, names)
    setRows(result.rows)
    setNotice(
      result.dropped > 0
        ? `Só cabem ${MAX_CATEGORIES_PER_BATCH} categorias por vez; ${result.dropped} ${result.dropped === 1 ? 'linha ficou' : 'linhas ficaram'} de fora.`
        : null,
    )
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const checked = validateCategoryRows(rows)
    setErrors(checked.errors)
    if (Object.keys(checked.errors).length > 0) {
      setError('Revise as categorias destacadas.')
      return
    }
    if (checked.valid.length === 0) {
      setError('Informe o nome de ao menos uma categoria.')
      return
    }
    startTransition(async () => {
      const result = await createCategoriesAction({ restaurantId, categories: checked.valid })
      if (!result.ok) {
        setError(result.error)
        return
      }
      const total = result.data.ids.length
      toast.add({ title: total === 1 ? 'Categoria criada' : `${total} categorias criadas`, type: 'success' })
      forceClose()
    })
  }

  return (
    <>
      <MobileSheetNav
        title="Nova categoria"
        action={{ label: count > 1 ? `Criar (${count})` : 'Criar', pendingLabel: 'Criando…', form: formId, pending, disabled: count === 0 }}
      />
      <form id={formId} className="tv-msheet-screen" onSubmit={onSubmit} noValidate aria-busy={pending || undefined}>
        <p className="tv-sheet-m-lead">Crie uma ou várias. Colar uma lista cria uma categoria por linha.</p>
        {error ? <p role="alert" className="tv-sheet-m-error">{error}</p> : null}
        <fieldset disabled={pending} className="tv-msheet-fieldset">
          {rows.map((row, index) => (
            <div key={row.key} className="tv-catbatch-m">
              <div className="tv-catbatch-m-head">
                <h3 className="tv-msheet-label">Categoria {index + 1}</h3>
                {rows.length > 1 ? (
                  <button type="button" className="tv-catbatch-m-remove" onClick={() => setRows((current) => current.filter((entry) => entry.key !== row.key))}>
                    Remover
                  </button>
                ) : null}
              </div>
              <div className="tv-group">
                <label className="tv-frow">
                  <span>Nome</span>
                  <input
                    value={row.name}
                    maxLength={80}
                    autoComplete="off"
                    enterKeyHint="next"
                    placeholder="Entradas"
                    aria-invalid={errors[row.key] ? true : undefined}
                    onChange={(event) => updateRow(row.key, { name: event.target.value })}
                    onPaste={(event) => onNamePaste(event, row.key)}
                  />
                </label>
                <textarea
                  className="tv-farea is-compact"
                  rows={1}
                  maxLength={300}
                  value={row.description}
                  placeholder="Descrição (opcional)"
                  aria-label={`Descrição da categoria ${index + 1}`}
                  onChange={(event) => updateRow(row.key, { description: event.target.value })}
                />
              </div>
              {errors[row.key] ? <p role="alert" className="tv-sheet-m-error">{errors[row.key]}</p> : null}
            </div>
          ))}
          <button type="button" className="tv-m-pill is-secondary" onClick={addRow} disabled={rows.length >= MAX_CATEGORIES_PER_BATCH}>
            <LuPlus aria-hidden="true" />Adicionar outra categoria
          </button>
          {notice ? <p role="status" className="tv-sheet-m-note">{notice}</p> : null}
        </fieldset>
      </form>
    </>
  )
}
