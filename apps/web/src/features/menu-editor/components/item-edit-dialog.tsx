'use client'

import { useRef, useState } from 'react'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toast'
import type { OwnerMenuCategoryDTO, OwnerMenuItemDTO } from '@/domain/menu'
import { updateItemAction } from '@/server/actions/menu'
import { MediaEditor, type MediaEditorHandle } from './media-editor'
import { VariantsEditor } from './variants-editor'
import { DietaryTagsInput } from './dietary-tags-input'

export function ItemEditDialog({
  item,
  categories,
  open,
  onOpenChange,
}: {
  item: OwnerMenuItemDTO
  categories: OwnerMenuCategoryDTO[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [visible, setVisible] = useState(item.isVisible)
  const [available, setAvailable] = useState(item.isAvailable)
  const [dietaryTags, setDietaryTags] = useState(item.dietaryTags)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [discardAlertOpen, setDiscardAlertOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const gripTouchY = useRef<number | null>(null)
  const editorRef = useRef<MediaEditorHandle>(null)

  async function submit(formData: FormData) {
    setPending(true)
    setError(null)

    const cents = Math.round(
      Number(String(formData.get('price') ?? '').replace(',', '.')) * 100,
    )
    if (!Number.isFinite(cents) || cents < 0) {
      setPending(false)
      setError('Informe um preço válido, como 18,90.')
      return
    }

    const result = await updateItemAction({
      itemId: item.id,
      categoryId: formData.get('categoryId'),
      name: formData.get('name'),
      description: formData.get('description') || undefined,
      basePriceCents: cents,
      dietaryTags,
      isVisible: visible,
      isAvailable: available,
    })

    if (!result.ok) {
      setPending(false)
      setError(result.error)
      return
    }

    const mediaUploaded =
      (await editorRef.current?.uploadPending(item.id)) ?? true
    setPending(false)

    if (mediaUploaded) {
      toast.add({ title: 'Item salvo', type: 'success' })
      onOpenChange(false)
      return
    }

    setError(
      'O item foi salvo, mas alguma mídia não subiu. Veja o motivo em cada uma.',
    )
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      onOpenChange(true)
      return
    }

    const pendingCount = editorRef.current?.getPendingCount() ?? 0
    if (pendingCount > 0) {
      setDiscardAlertOpen(true)
      return
    }

    onOpenChange(false)
  }

  function discardPendingMedia() {
    setDiscardAlertOpen(false)
    onOpenChange(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className={`tv-item-sheet flex h-[min(860px,calc(100dvh-1.5rem))] max-h-[calc(100dvh-1.5rem)] w-[min(560px,calc(100vw-1.5rem))] max-w-[560px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[560px] max-sm:h-[calc(100dvh-1rem)] max-sm:max-h-[calc(100dvh-1rem)] max-sm:max-w-[calc(100%-1rem)]${expanded ? ' is-expanded' : ''}`}>
          <DialogHeader className="shrink-0 border-b border-border px-5 py-4 pr-14 sm:px-6">
            <div className="tv-sheet-grip" onTouchStart={(event) => { gripTouchY.current = event.touches[0]?.clientY ?? null }} onTouchEnd={(event) => { const start = gripTouchY.current; gripTouchY.current = null; if (start === null) return; const delta = start - event.changedTouches[0].clientY; if (delta > 70) setExpanded(true); else if (delta < -110) handleOpenChange(false) }}>
              <span aria-hidden="true" />
              <button type="button" onClick={() => setExpanded((value) => !value)}>{expanded ? 'Reduzir' : 'Expandir'}</button>
            </div>
            <DialogTitle>Editar item</DialogTitle>
            <DialogDescription>{item.name}</DialogDescription>
          </DialogHeader>

          <form action={submit} className="flex min-h-0 flex-1 flex-col">
            <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-1">
              <section className="order-2 border-b border-border p-5 sm:p-6">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold">Dados do item</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Nome, preço, descrição e estado no cardápio.
                  </p>
                </div>

                <FieldGroup className="gap-4">
                  <Field>
                    <FieldLabel htmlFor="edit-name">Nome</FieldLabel>
                    <Input id="edit-name" name="name" defaultValue={item.name} required />
                  </Field>

                  <Field>
                    <FieldLabel>Destaques e restrições</FieldLabel>
                    <DietaryTagsInput value={dietaryTags} onChange={setDietaryTags} />
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem] lg:grid-cols-1 xl:grid-cols-[minmax(0,1fr)_8rem]">
                    <Field>
                      <FieldLabel htmlFor="edit-category">Categoria</FieldLabel>
                      <NativeSelect
                        id="edit-category"
                        name="categoryId"
                        defaultValue={item.categoryId}
                        className="w-full"
                      >
                        {categories.map((category) => (
                          <NativeSelectOption key={category.id} value={category.id}>
                            {category.name}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="edit-price">Preço</FieldLabel>
                      <Input
                        id="edit-price"
                        name="price"
                        inputMode="decimal"
                        defaultValue={(item.basePriceCents / 100).toFixed(2).replace('.', ',')}
                        required
                      />
                    </Field>
                  </div>

                  <Field>
                    <FieldLabel htmlFor="edit-description">Descrição</FieldLabel>
                    <Textarea
                      id="edit-description"
                      name="description"
                      rows={3}
                      defaultValue={item.description ?? ''}
                      className="min-h-20 py-2"
                    />
                    <FieldDescription className="text-xs">
                      Texto simples; não aceita os caracteres menor e maior.
                    </FieldDescription>
                  </Field>

                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    <div className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border bg-surface-1 px-3 py-2">
                      <FieldLabel htmlFor="edit-visible">Visível</FieldLabel>
                      <Switch
                        id="edit-visible"
                        checked={visible}
                        onCheckedChange={(next) => setVisible(next)}
                      />
                    </div>
                    <div className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border bg-surface-1 px-3 py-2">
                      <FieldLabel htmlFor="edit-available">Disponível</FieldLabel>
                      <Switch
                        id="edit-available"
                        checked={available}
                        onCheckedChange={(next) => setAvailable(next)}
                      />
                    </div>
                  </div>
                </FieldGroup>
              </section>

              <section className="order-1 flex flex-col gap-6 bg-surface-1/45 p-5 sm:p-6">
                <div className="order-2">
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold">Variações</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Tamanhos ou opções com preços diferentes.
                    </p>
                  </div>
                  <VariantsEditor itemId={item.id} variants={item.variants} />
                </div>

                <div className="order-1 border-b border-border pb-5">
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold">Fotos e vídeos</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      A primeira mídia abre o prato; selecione uma foto para ajustar o enquadramento.
                    </p>
                  </div>
                  <MediaEditor ref={editorRef} itemId={item.id} media={item.media} />
                </div>
              </section>
            </div>

            <DialogFooter className="shrink-0 border-t border-border bg-popover px-5 py-3 sm:items-center sm:justify-between sm:px-6">
              <div className="min-h-5 flex-1">
                {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
                  Fechar
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? <Spinner className="size-4" /> : null}
                  Salvar item
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={discardAlertOpen} onOpenChange={setDiscardAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar mídia pendente?</AlertDialogTitle>
            <AlertDialogDescription>
              Os arquivos ainda não enviados serão descartados ao fechar este item.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={discardPendingMedia}>
              Descartar e fechar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
