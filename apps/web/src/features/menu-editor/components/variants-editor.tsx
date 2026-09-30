'use client'

import { useState, useTransition, type KeyboardEvent } from 'react'
import { LuPlus, LuTrash2 } from 'react-icons/lu'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import type { OwnerMenuItemDTO } from '@/domain/menu'
import { formatCents } from '@/lib/money'
import { createVariantAction, deleteVariantAction } from '@/server/actions/menu'

// As variações são salvas NA HORA, uma a uma, e não junto com o formulário
// do item: são entidades próprias no banco, e fingir que fazem parte do
// formulário criaria duas fontes de verdade dentro do painel.
export function VariantsEditor({ itemId, variants }: { itemId: string; variants: OwnerMenuItemDTO['variants'] }) {
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [price, setPrice] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  function add() {
    const cents = price
    if (!name.trim()) { setError('Informe o nome da variação.'); return }
    if (cents === null) { setError('Informe o preço.'); return }
    setError(null)
    startTransition(async () => {
      const result = await createVariantAction({ itemId, name: name.trim(), priceCents: cents })
      if (result.ok) {
        setName('')
        setPrice(null)
        toast.add({ title: 'Variação adicionada', type: 'success' })
      } else {
        setError(result.error)
      }
    })
  }

  // Enter adiciona a variação em vez de enviar o formulário do item, que
  // envolve estes campos.
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    add()
  }

  return (
    <div className="tv-variants">
      {variants.length > 0 ? (
        <ul className="tv-variant-list">
          {variants.map((variant) => (
            <li key={variant.id} className="tv-variant">
              <span>{variant.name}</span>
              <span className="tv-variant-price">{formatCents(variant.priceCents)}</span>
              <button
                type="button"
                className="tv-variant-remove"
                disabled={pending}
                aria-label={`Remover variação ${variant.name}`}
                onClick={() => startTransition(async () => {
                  const result = await deleteVariantAction(variant.id)
                  if (!result.ok) toast.add({ title: result.error, type: 'error' })
                })}
              >
                <LuTrash2 aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="tv-variant-new">
        <input className="tv-pinput is-sm" value={name} onChange={(event) => setName(event.target.value)} onKeyDown={onKeyDown} placeholder="Tamanho G" aria-label="Nome da variação" />
        <CurrencyInput className="tv-pinput is-sm" valueCents={price} onValueChange={setPrice} onKeyDown={onKeyDown} aria-label="Preço da variação" />
        <button type="button" className="tv-pbtn" disabled={pending} onClick={add}>
          {pending ? <Spinner className="size-3.5" /> : <LuPlus aria-hidden="true" />}Adicionar
        </button>
      </div>
      {error ? <p role="alert" className="tv-pfield-error">{error}</p> : null}
    </div>
  )
}
