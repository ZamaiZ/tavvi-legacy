'use client'

import { useRef, useState } from 'react'
import { MediaEditor, type MediaEditorHandle } from '@/features/menu-editor/components/media-editor'
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
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { createItemAction } from '@/server/actions/menu'
import { DietaryTagsInput } from './dietary-tags-input'

export function ItemCreateDialog({
  restaurantId,
  categoryId,
  open,
  onOpenChange,
}: {
  restaurantId: string
  categoryId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dietaryTags, setDietaryTags] = useState<string[]>([])
  const [discardAlertOpen, setDiscardAlertOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const gripTouchY = useRef<number | null>(null)
  const editorRef = useRef<MediaEditorHandle>(null)

  async function submit(formData: FormData) {
    setPending(true)
    setError(null)

    const normalizedPrice = String(formData.get('price') ?? '').replace(',', '.')
    const cents = Math.round(Number(normalizedPrice) * 100)

    if (!Number.isFinite(cents) || cents < 0) {
      setPending(false)
      setError('Informe um preço válido, como 18,90.')
      return
    }

    const result = await createItemAction({
      restaurantId,
      categoryId,
      name: formData.get('name'),
      description: formData.get('description') || undefined,
      basePriceCents: cents,
      dietaryTags,
    })

    if (!result.ok) {
      setPending(false)
      setError(result.error)
      return
    }

    const mediaUploaded =
      (await editorRef.current?.uploadPending(result.data.id)) ?? true

    setPending(false)

    if (mediaUploaded) {
      toast.add({ title: 'Item criado', type: 'success' })
      onOpenChange(false)
      return
    }

    setError(
      'O item foi criado, mas alguma mídia não subiu. Veja o motivo em cada uma.',
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
        <DialogContent className={`tv-item-sheet flex h-[min(720px,calc(100dvh-1.5rem))] max-h-[calc(100dvh-1.5rem)] w-[min(560px,calc(100vw-1.5rem))] max-w-[560px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[560px] max-sm:h-[calc(100dvh-1rem)] max-sm:max-h-[calc(100dvh-1rem)] max-sm:max-w-[calc(100%-1rem)]${expanded ? ' is-expanded' : ''}`}>
          <DialogHeader className="shrink-0 border-b border-border px-5 py-4 pr-14 sm:px-6">
            <div className="tv-sheet-grip" onTouchStart={(event) => { gripTouchY.current = event.touches[0]?.clientY ?? null }} onTouchEnd={(event) => { const start = gripTouchY.current; gripTouchY.current = null; if (start === null) return; const delta = start - event.changedTouches[0].clientY; if (delta > 70) setExpanded(true); else if (delta < -110) handleOpenChange(false) }}>
              <span aria-hidden="true" />
              <button type="button" onClick={() => setExpanded((value) => !value)}>{expanded ? 'Reduzir' : 'Expandir'}</button>
            </div>
            <DialogTitle>Novo item</DialogTitle>
            <DialogDescription>
              Escolha as fotos e os vídeos agora; o envio começa ao criar o item.
            </DialogDescription>
          </DialogHeader>

          <form action={submit} className="flex min-h-0 flex-1 flex-col">
            <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-1">
              <section className="order-2 border-b border-border p-5 sm:p-6">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold">Dados básicos</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    A descrição e as variações podem ser completadas depois.
                  </p>
                </div>
                <FieldGroup className="gap-4">
                  <Field>
                    <FieldLabel htmlFor="item-name">Nome</FieldLabel>
                    <Input
                      id="item-name"
                      name="name"
                      placeholder="Pão de alho"
                      autoFocus
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="item-description">Descrição</FieldLabel>
                    <textarea id="item-description" name="description" maxLength={600} rows={3} className="tv-menu-textarea" />
                    <FieldDescription className="text-xs">Até 600 caracteres.</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel>Destaques e restrições</FieldLabel>
                    <DietaryTagsInput value={dietaryTags} onChange={setDietaryTags} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="item-price">Preço</FieldLabel>
                    <Input
                      id="item-price"
                      name="price"
                      inputMode="decimal"
                      placeholder="18,90"
                      required
                    />
                    <FieldDescription className="text-xs">Em reais, como 18,90.</FieldDescription>
                  </Field>
                </FieldGroup>
              </section>

              <section className="order-1 bg-surface-1/45 p-5 sm:p-6">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold">Fotos e vídeos</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Arraste, cole ou selecione arquivos e defina a ordem.
                  </p>
                </div>
                <MediaEditor ref={editorRef} itemId={null} media={[]} />
              </section>
            </div>

            <DialogFooter className="shrink-0 border-t border-border bg-popover px-5 py-3 sm:items-center sm:justify-between sm:px-6">
              <div className="min-h-5 flex-1">
                {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? <Spinner className="size-4" /> : null}
                  Criar item
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
              Os arquivos selecionados serão descartados e o item não será criado.
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
