'use client'

import { useState, useTransition, type KeyboardEvent } from 'react'
import { LuCheck, LuChevronRight, LuPlus, LuTrash2 } from 'react-icons/lu'
import { Combobox } from '@/components/ui/combobox'
import { CurrencyInput } from '@/components/ui/currency-input'
import { toast } from '@/components/ui/toast'
import type { OwnerMenuCategoryDTO, OwnerMenuItemDTO } from '@/domain/menu'
import { formatCents, formatCentsInput } from '@/lib/money'
import { createVariantAction, deleteVariantAction } from '@/server/actions/menu'

const TAG_SUGGESTIONS = ['Vegetariano', 'Vegano', 'Sem glúten', 'Sem lactose', 'Picante', 'Contém castanhas']

// Linha "Preço": "R$" colado ao valor, alinhado à direita. O campo cresce
// com o texto da máscara.
export function PriceRow({
  valueCents,
  onValueChange,
  onKeyDown,
}: {
  valueCents: number | null
  onValueChange: (cents: number | null) => void
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void
}) {
  const shown = valueCents === null ? '0,00' : formatCentsInput(valueCents)
  return (
    <label className="tv-frow">
      <span>Preço</span>
      <span className="tv-frow-price">
        <span aria-hidden="true">R$</span>
        <CurrencyInput
          valueCents={valueCents}
          onValueChange={onValueChange}
          onKeyDown={onKeyDown}
          aria-label="Preço"
          enterKeyHint="done"
          style={{ width: `${shown.length + 1}ch` }}
        />
      </span>
    </label>
  )
}

// Linha "Categoria": abre o sheet de escolha com busca (Combobox do
// celular), sem seletor nativo.
export function CategoryRow({
  categories,
  value,
  onChange,
}: {
  categories: OwnerMenuCategoryDTO[]
  value: string
  onChange: (categoryId: string) => void
}) {
  return (
    <Combobox
      variant="row"
      label="Categoria"
      options={categories.map((category) => ({ value: category.id, label: category.name }))}
      value={value}
      onValueChange={onChange}
    />
  )
}

// Linha que abre uma subtela ("Variações ›", "Destaques e restrições ›").
export function NavRow({ label, value, onClick }: { label: string; value?: string | null; onClick: () => void }) {
  return (
    <button type="button" className="tv-frow is-nav" onClick={onClick}>
      <span>{label}</span>
      <span className="tv-frow-value">{value}<LuChevronRight aria-hidden="true" /></span>
    </button>
  )
}

export function variantsLabel(count: number) {
  return count === 0 ? 'Adicionar' : `${count} ${count === 1 ? 'variação' : 'variações'}`
}

// Subtela Variações: cada variação é salva na hora, como no desktop.
export function VariantsScreen({ itemId, variants }: { itemId: string; variants: OwnerMenuItemDTO['variants'] }) {
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [priceCents, setPriceCents] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  function add() {
    if (!name.trim()) {
      setError('Informe o nome da variação.')
      return
    }
    if (priceCents === null) {
      setError('Informe o preço.')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await createVariantAction({ itemId, name: name.trim(), priceCents })
      if (result.ok) {
        setName('')
        setPriceCents(null)
        toast.add({ title: 'Variação adicionada', type: 'success' })
      } else {
        setError(result.error)
      }
    })
  }

  function remove(variantId: string) {
    startTransition(async () => {
      const result = await deleteVariantAction(variantId)
      if (!result.ok) toast.add({ title: result.error, type: 'error' })
    })
  }

  function onEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    add()
  }

  return (
    <>
      {variants.length > 0 ? (
        <div className="tv-group">
          {variants.map((variant) => (
            <div key={variant.id} className="tv-frow">
              <span>{variant.name}</span>
              <span className="tv-frow-trail">
                {formatCents(variant.priceCents)}
                <button type="button" className="tv-frow-icon" disabled={pending} aria-label={`Remover variação ${variant.name}`} onClick={() => remove(variant.id)}>
                  <LuTrash2 aria-hidden="true" />
                </button>
              </span>
            </div>
          ))}
        </div>
      ) : null}
      <h3 className="tv-msheet-label">Nova variação</h3>
      <div className="tv-group">
        <label className="tv-frow">
          <span>Nome</span>
          <input value={name} onChange={(event) => setName(event.target.value)} onKeyDown={onEnter} maxLength={60} autoComplete="off" enterKeyHint="next" placeholder="Tamanho G" />
        </label>
        <PriceRow valueCents={priceCents} onValueChange={setPriceCents} onKeyDown={onEnter} />
      </div>
      {error ? <p role="alert" className="tv-sheet-m-error">{error}</p> : null}
      <button type="button" className="tv-m-pill is-secondary" disabled={pending} onClick={add}>
        {pending ? <span className="tv-spinner" aria-hidden="true" /> : <LuPlus aria-hidden="true" />}Adicionar variação
      </button>
      <p className="tv-sheet-m-note">Tamanhos ou opções com preços diferentes. Cada variação é salva na hora.</p>
    </>
  )
}

// Subtela Destaques e restrições: marca as sugestões e os destaques próprios.
// O estado é do sheet e vai junto no "Salvar"/"Criar".
export function TagsScreen({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const options = [...TAG_SUGGESTIONS, ...value.filter((tag) => !TAG_SUGGESTIONS.includes(tag))]

  function toggle(tag: string) {
    if (value.includes(tag)) {
      onChange(value.filter((entry) => entry !== tag))
      setError(null)
      return
    }
    if (value.length >= 10) {
      setError('Use no máximo 10 destaques.')
      return
    }
    onChange([...value, tag])
    setError(null)
  }

  function addDraft() {
    const tag = draft.trim()
    if (!tag) return
    if (tag.length > 30) {
      setError('Cada destaque pode ter até 30 caracteres.')
      return
    }
    if (value.includes(tag)) {
      setDraft('')
      setError(null)
      return
    }
    if (value.length >= 10) {
      setError('Use no máximo 10 destaques.')
      return
    }
    onChange([...value, tag])
    setDraft('')
    setError(null)
  }

  return (
    <>
      <div className="tv-group" role="group" aria-label="Destaques e restrições">
        {options.map((tag) => {
          const checked = value.includes(tag)
          return (
            <button key={tag} type="button" role="checkbox" aria-checked={checked} className="tv-choice" onClick={() => toggle(tag)}>
              <span><strong>{tag}</strong></span>
              {checked ? <LuCheck aria-hidden="true" /> : null}
            </button>
          )
        })}
      </div>
      <h3 className="tv-msheet-label">Outro destaque</h3>
      <div className="tv-group">
        <label className="tv-frow is-left">
          <span className="sr-only">Outro destaque</span>
          <input
            value={draft}
            onChange={(event) => { setDraft(event.target.value); setError(null) }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              addDraft()
            }}
            maxLength={30}
            autoComplete="off"
            enterKeyHint="done"
            placeholder="Ex.: Sem açúcar"
          />
          {draft.trim() ? <button type="button" className="tv-frow-link" onClick={addDraft}>Adicionar</button> : null}
        </label>
      </div>
      {error ? <p role="alert" className="tv-sheet-m-error">{error}</p> : null}
      <p className="tv-sheet-m-note">Até 10 destaques, com até 30 caracteres cada.</p>
    </>
  )
}
