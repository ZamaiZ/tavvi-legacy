'use client'

import { useState, useTransition } from 'react'
import { RiAddLine, RiDeleteBinLine, RiPriceTag3Line } from 'react-icons/ri'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PanelEmptyState } from '@/features/workspace/components/panel-empty-state'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import type { OwnerMenuItemDTO } from '@/domain/menu'
import { formatPriceBRL } from '@/lib/format'
import { createVariantAction, deleteVariantAction } from '@/server/actions/menu'

// As variações são salvas NA HORA, uma a uma, e não junto com o formulário
// do item. São entidades próprias no banco, e fingir que fazem parte do
// formulário criaria o problema de sincronizar duas fontes de verdade
// dentro de um diálogo.
export function VariantsEditor({
  itemId,
  variants,
}: {
  itemId: string
  variants: OwnerMenuItemDTO['variants']
}) {
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [error, setError] = useState<string | null>(null)

  function add() {
    const cents = Math.round(Number(price.replace(',', '.')) * 100)

    if (!name.trim()) {
      setError('Informe o nome da variação.')
      return
    }
    if (!Number.isFinite(cents) || cents < 0) {
      setError('Informe um preço válido, como 24,90.')
      return
    }
    setError(null)

    startTransition(async () => {
      const result = await createVariantAction({
        itemId,
        name: name.trim(),
        priceCents: cents,
      })
      if (result.ok) {
        setName('')
        setPrice('')
        toast.add({ title: 'Variação adicionada', type: 'success' })
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className="space-y-3">
      {variants.length === 0 ? (
        <PanelEmptyState
          density="compact"
          icon={<RiPriceTag3Line />}
          title="Sem variações por enquanto"
          description="Cadastre tamanhos ou opções com preços próprios, como Pizza P, M e G."
        />
      ) : (
        <ul className="space-y-1.5">
          {variants.map((variant) => (
            <li
              key={variant.id}
              className="flex min-h-10 items-center gap-2 rounded-lg border border-border bg-popover px-3 py-1.5 text-sm"
            >
              <span className="mr-auto">{variant.name}</span>
              <span className="text-muted-foreground">
                {formatPriceBRL(variant.priceCents)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={pending}
                aria-label={`Remover variação ${variant.name}`}
                onClick={() =>
                  startTransition(async () => {
                    const result = await deleteVariantAction(variant.id)
                    if (!result.ok) {
                      toast.add({ title: result.error, type: 'error' })
                    }
                  })
                }
              >
                <RiDeleteBinLine className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_auto]">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Tamanho G"
          aria-label="Nome da variação"
          className="min-w-0"
        />
        <Input
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          inputMode="decimal"
          placeholder="24,90"
          aria-label="Preço da variação"
          className="w-full"
        />
        <Button type="button" variant="outline" disabled={pending} onClick={add}>
          {pending ? (
            <Spinner className="size-4" />
          ) : (
            <RiAddLine className="size-4" />
          )}
          Adicionar
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
