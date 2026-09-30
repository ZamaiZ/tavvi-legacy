'use client'

import { useRef, useState } from 'react'
import { toast } from '@/components/ui/toast'
import type { OwnerMenuItemDTO } from '@/domain/menu'
import { createItemAction, updateItemAction } from '@/server/actions/menu'
import type { MediaEditorHandle } from './media-editor'

export type ItemFields = {
  name: string
  categoryId: string
  description: string
  /** Centavos, do CurrencyInput. `null` é campo vazio. */
  basePriceCents: number | null
  dietaryTags: string[]
}

// Salvar um item: confere o preço, grava e só então sobe a mídia em espera.
// Hoje é usado pelos sheets do celular; o painel lateral do desktop pode
// adotar o mesmo hook quando trocar o preço para o CurrencyInput.
export function useItemEditSubmit({ item, onDone }: { item: OwnerMenuItemDTO; onDone: () => void }) {
  const editorRef = useRef<MediaEditorHandle>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(fields: ItemFields & { isVisible: boolean; isAvailable: boolean }) {
    setError(null)
    if (fields.basePriceCents === null) {
      setError('Informe o preço.')
      return
    }
    setPending(true)
    const result = await updateItemAction({
      itemId: item.id,
      categoryId: fields.categoryId,
      name: fields.name,
      description: fields.description || undefined,
      basePriceCents: fields.basePriceCents,
      dietaryTags: fields.dietaryTags,
      isVisible: fields.isVisible,
      isAvailable: fields.isAvailable,
    })
    if (!result.ok) {
      setPending(false)
      setError(result.error)
      return
    }
    const mediaUploaded = (await editorRef.current?.uploadPending(item.id)) ?? true
    setPending(false)
    if (mediaUploaded) {
      toast.add({ title: 'Item salvo', type: 'success' })
      onDone()
      return
    }
    setError('O item foi salvo, mas alguma mídia não subiu. Veja o motivo em cada uma.')
  }

  return { editorRef, pending, error, submit }
}

// Criar um item: mesmo fluxo; a mídia sobe com o id que acabou de nascer.
export function useItemCreateSubmit({ restaurantId, onDone }: { restaurantId: string; onDone: () => void }) {
  const editorRef = useRef<MediaEditorHandle>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(fields: ItemFields) {
    setError(null)
    if (fields.basePriceCents === null) {
      setError('Informe o preço.')
      return
    }
    setPending(true)
    const result = await createItemAction({
      restaurantId,
      categoryId: fields.categoryId,
      name: fields.name,
      description: fields.description || undefined,
      basePriceCents: fields.basePriceCents,
      dietaryTags: fields.dietaryTags,
    })
    if (!result.ok) {
      setPending(false)
      setError(result.error)
      return
    }
    const mediaUploaded = (await editorRef.current?.uploadPending(result.data.id)) ?? true
    setPending(false)
    if (mediaUploaded) {
      toast.add({ title: 'Item criado', type: 'success' })
      onDone()
      return
    }
    setError('O item foi criado, mas alguma mídia não subiu. Veja o motivo em cada uma.')
  }

  return { editorRef, pending, error, submit }
}
