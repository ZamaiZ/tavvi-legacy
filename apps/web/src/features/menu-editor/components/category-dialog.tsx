'use client'

import { useEffect, useRef, useState, useTransition, type ClipboardEvent, type KeyboardEvent } from 'react'
import { LuPlus, LuX } from 'react-icons/lu'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toast'
import { MAX_CATEGORIES_PER_BATCH } from '@/domain/menu'
import { createCategoriesAction, updateCategoryAction } from '@/server/actions/menu'
import {
  insertPastedNames,
  newCategoryRow,
  splitPastedNames,
  validateCategoryRows,
  type CategoryRowDraft,
} from '../lib/category-batch'

export type CategoryDialogData = {
  id: string
  name: string
  description: string | null
  isVisible: boolean
}

// Controlado de fora, de proposito. Um dialogo montado DENTRO de um menu
// suspenso desaparece junto com o menu quando o item e selecionado -- e o
// dialogo nunca chega a aparecer. Deixando os dois como irmaos, o menu
// fecha e o dialogo sobrevive.
export function CategoryDialog({
  restaurantId,
  category,
  initialName,
  open,
  onOpenChange,
}: {
  restaurantId: string
  category?: CategoryDialogData
  initialName?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [pending, setPending] = useState(false)

  // Enquanto grava, nada fecha o diálogo: nem Esc, nem clique fora, nem o X.
  // Fechar esconderia o resultado, e a pessoa não saberia se criou ou não.
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!pending) onOpenChange(next) }} disablePointerDismissal={pending}>
      <DialogContent className="tv-bottom-sheet-dialog" showCloseButton={!pending}>
        {category ? (
          <EditCategoryBody category={category} onPendingChange={setPending} onDone={() => onOpenChange(false)} />
        ) : (
          <CreateCategoriesBody
            restaurantId={restaurantId}
            initialName={initialName}
            onPendingChange={setPending}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function EditCategoryBody({
  category,
  onPendingChange,
  onDone,
}: {
  category: CategoryDialogData
  onPendingChange: (pending: boolean) => void
  onDone: () => void
}) {
  const [visible, setVisible] = useState(category.isVisible)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { onPendingChange(pending) }, [pending, onPendingChange])

  function submit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await updateCategoryAction({
        categoryId: category.id,
        name: formData.get('name'),
        description: formData.get('description') || undefined,
        isVisible: visible,
      })
      if (result.ok) {
        toast.add({ title: 'Categoria salva', type: 'success' })
        onDone()
        return
      }
      setError(result.error)
    })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Editar categoria</DialogTitle>
        <DialogDescription>Categorias agrupam os pratos no cardápio.</DialogDescription>
      </DialogHeader>
      <form action={submit} className="space-y-5" aria-busy={pending || undefined}>
        <fieldset disabled={pending} className="tv-catbatch-fieldset">
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="cat-name">Nome</FieldLabel>
              <Input id="cat-name" name="name" defaultValue={category.name} placeholder="Entradas" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="cat-description">Descrição</FieldLabel>
              <Textarea id="cat-description" name="description" rows={2} defaultValue={category.description ?? ''} />
            </Field>
            <Field>
              <div className="flex items-center justify-between gap-4">
                <FieldLabel htmlFor="cat-visible">Visível no cardápio</FieldLabel>
                <Switch id="cat-visible" checked={visible} disabled={pending} onCheckedChange={(next) => setVisible(next)} />
              </div>
            </Field>
          </FieldGroup>
        </fieldset>

        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter>
          <Button type="button" variant="ghost" disabled={pending} onClick={onDone}>Cancelar</Button>
          <Button type="submit" disabled={pending} aria-busy={pending || undefined}>
            {pending ? <Spinner className="size-4" aria-hidden="true" /> : null}
            {pending ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

function CreateCategoriesBody({
  restaurantId,
  initialName,
  onPendingChange,
  onDone,
}: {
  restaurantId: string
  initialName?: string
  onPendingChange: (pending: boolean) => void
  onDone: () => void
}) {
  const [rows, setRows] = useState<CategoryRowDraft[]>(() => [newCategoryRow(initialName ?? '')])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const nameRefs = useRef(new Map<string, HTMLInputElement>())
  const focusKey = useRef<string | null>(null)
  const { valid } = validateCategoryRows(rows)
  const count = valid.length

  useEffect(() => { onPendingChange(pending) }, [pending, onPendingChange])

  // Foco na linha nova só com mouse e teclado: no celular abriria o teclado
  // sem a pessoa pedir.
  useEffect(() => {
    const key = focusKey.current
    if (!key) return
    focusKey.current = null
    if (window.matchMedia('(pointer: fine)').matches) nameRefs.current.get(key)?.focus()
  }, [rows])

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
    const row = newCategoryRow()
    focusKey.current = row.key
    setRows((current) => [...current, row])
  }

  function removeRow(key: string) {
    setRows((current) => (current.length > 1 ? current.filter((row) => row.key !== key) : current))
    setNotice(null)
  }

  function onNameKeyDown(event: KeyboardEvent<HTMLInputElement>, key: string) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    if (rows[rows.length - 1]?.key === key) addRow()
    else {
      const index = rows.findIndex((row) => row.key === key)
      nameRefs.current.get(rows[index + 1]?.key ?? '')?.focus()
    }
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

  function submit() {
    setError(null)
    const checked = validateCategoryRows(rows)
    setErrors(checked.errors)
    if (Object.keys(checked.errors).length > 0) {
      setError('Revise as linhas destacadas.')
      return
    }
    if (checked.valid.length === 0) {
      setError('Informe o nome de ao menos uma categoria.')
      return
    }
    startTransition(async () => {
      const result = await createCategoriesAction({ restaurantId, categories: checked.valid })
      if (result.ok) {
        const total = result.data.ids.length
        toast.add({ title: total === 1 ? 'Categoria criada' : `${total} categorias criadas`, type: 'success' })
        onDone()
        return
      }
      setError(result.error)
    })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Nova categoria</DialogTitle>
        <DialogDescription>Crie uma ou várias. Colar uma lista cria uma categoria por linha.</DialogDescription>
      </DialogHeader>
      <form action={submit} className="space-y-5" aria-busy={pending || undefined}>
        <fieldset disabled={pending} className="tv-catbatch-fieldset">
          <ol className="tv-catbatch">
            {rows.map((row, index) => (
              <li key={row.key} className="tv-catbatch-row" data-invalid={errors[row.key] ? '' : undefined}>
                <span className="tv-catbatch-index" aria-hidden="true">{index + 1}</span>
                <div className="tv-catbatch-fields">
                  <input
                    ref={(node) => {
                      if (node) nameRefs.current.set(row.key, node)
                      else nameRefs.current.delete(row.key)
                    }}
                    className="tv-pinput"
                    value={row.name}
                    maxLength={80}
                    placeholder={index === 0 ? 'Entradas' : 'Nome da categoria'}
                    aria-label={`Nome da categoria ${index + 1}`}
                    aria-invalid={errors[row.key] ? true : undefined}
                    autoFocus={index === 0}
                    onChange={(event) => updateRow(row.key, { name: event.target.value })}
                    onKeyDown={(event) => onNameKeyDown(event, row.key)}
                    onPaste={(event) => onNamePaste(event, row.key)}
                  />
                  <textarea
                    className="tv-pinput tv-catbatch-desc"
                    rows={1}
                    maxLength={300}
                    value={row.description}
                    placeholder="Descrição (opcional)"
                    aria-label={`Descrição da categoria ${index + 1}`}
                    onChange={(event) => updateRow(row.key, { description: event.target.value })}
                  />
                  {errors[row.key] ? <p role="alert" className="tv-catbatch-error">{errors[row.key]}</p> : null}
                </div>
                {rows.length > 1 ? (
                  <button
                    type="button"
                    className="tv-catbatch-remove"
                    aria-label={`Remover categoria ${index + 1}`}
                    onClick={() => removeRow(row.key)}
                  >
                    <LuX aria-hidden="true" />
                  </button>
                ) : <span aria-hidden="true" />}
              </li>
            ))}
          </ol>
          <button type="button" className="tv-catbatch-add" onClick={addRow} disabled={rows.length >= MAX_CATEGORIES_PER_BATCH}>
            <LuPlus aria-hidden="true" />Adicionar outra categoria
          </button>
          {notice ? <p role="status" className="tv-catbatch-notice">{notice}</p> : null}
        </fieldset>

        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter>
          <Button type="button" variant="ghost" disabled={pending} onClick={onDone}>Cancelar</Button>
          <Button type="submit" disabled={pending || count === 0} aria-busy={pending || undefined}>
            {pending ? <Spinner className="size-4" aria-hidden="true" /> : null}
            {pending ? 'Criando…' : count > 1 ? `Criar ${count} categorias` : 'Criar categoria'}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}
