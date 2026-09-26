'use client'

import { useState } from 'react'
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
import { createCategoryAction, updateCategoryAction } from '@/server/actions/menu'

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
  const [visible, setVisible] = useState(category?.isVisible ?? true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(formData: FormData) {
    setPending(true)
    setError(null)

    const name = formData.get('name')
    const description = formData.get('description') || undefined

    const result = category
      ? await updateCategoryAction({
          categoryId: category.id,
          name,
          description,
          isVisible: visible,
        })
      : await createCategoryAction({ restaurantId, name, description })

    setPending(false)

    if (result.ok) {
      toast.add({
        title: category ? 'Categoria salva' : 'Categoria criada',
        type: 'success',
      })
      onOpenChange(false)
      return
    }
    setError(result.error)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="tv-bottom-sheet-dialog">
        <DialogHeader>
          <DialogTitle>
            {category ? 'Editar categoria' : 'Nova categoria'}
          </DialogTitle>
          <DialogDescription>
            Categorias agrupam os pratos no cardápio.
          </DialogDescription>
        </DialogHeader>

        <form action={submit} className="space-y-5">
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="cat-name">Nome</FieldLabel>
              <Input
                id="cat-name"
                name="name"
                defaultValue={category?.name ?? initialName}
                placeholder="Entradas"
                autoFocus
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="cat-description">Descrição</FieldLabel>
              <Textarea
                id="cat-description"
                name="description"
                rows={2}
                defaultValue={category?.description ?? ''}
              />
            </Field>

            {/* Visibilidade só na edição: uma categoria recém-criada sempre
                nasce visível, e perguntar isso na criação é uma decisão a
                mais num momento em que a pessoa só quer digitar um nome. */}
            {category ? (
              <Field>
                <div className="flex items-center justify-between gap-4">
                  <FieldLabel htmlFor="cat-visible">
                    Visível no cardápio
                  </FieldLabel>
                  <Switch
                    id="cat-visible"
                    checked={visible}
                    onCheckedChange={(next) => setVisible(next)}
                  />
                </div>
              </Field>
            ) : null}
          </FieldGroup>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Spinner className="size-4" /> : null}
              {category ? 'Salvar' : 'Criar categoria'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
