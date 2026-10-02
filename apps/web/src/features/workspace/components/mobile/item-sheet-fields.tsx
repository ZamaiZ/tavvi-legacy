'use client'

import { useState, type KeyboardEvent } from 'react'
import { LuCheck, LuChevronRight } from 'react-icons/lu'
import { Combobox } from '@/components/ui/combobox'
import { CurrencyInput } from '@/components/ui/currency-input'
import type { OwnerMenuCategoryDTO } from '@/domain/menu'
import { formatCentsInput } from '@/lib/money'

const TAG_SUGGESTIONS = ['Vegetariano', 'Vegano', 'Sem glúten', 'Sem lactose', 'Picante', 'Contém castanhas']

// Linha "Preço": "R$" colado ao valor, alinhado à direita. O campo cresce
// com o texto da máscara.
export function PriceRow({
  valueCents,
  onValueChange,
  onKeyDown,
  disabled,
}: {
  valueCents: number | null
  onValueChange: (cents: number | null) => void
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void
  disabled?: boolean
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
          disabled={disabled}
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
  disabled,
}: {
  categories: OwnerMenuCategoryDTO[]
  value: string
  onChange: (categoryId: string) => void
  disabled?: boolean
}) {
  return (
    <Combobox
      variant="row"
      label="Categoria"
      options={categories.map((category) => ({ value: category.id, label: category.name }))}
      value={value}
      onValueChange={onChange}
      disabled={disabled}
    />
  )
}

// Linha que abre uma subtela ("Variações ›", "Destaques e restrições ›").
export function NavRow({ label, value, onClick, disabled }: { label: string; value?: string | null; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="tv-frow is-nav" disabled={disabled} onClick={onClick}>
      <span>{label}</span>
      <span className="tv-frow-value">{value}<LuChevronRight aria-hidden="true" /></span>
    </button>
  )
}

// Subtela Destaques e restrições: marca as sugestões e os destaques próprios.
// O estado é do sheet e vai junto no "Salvar"/"Criar".
export function TagsScreen({ value, onChange, disabled }: { value: string[]; onChange: (tags: string[]) => void; disabled?: boolean }) {
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
            <button key={tag} type="button" role="checkbox" aria-checked={checked} className="tv-choice" disabled={disabled} onClick={() => toggle(tag)}>
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
            disabled={disabled}
          />
          {draft.trim() ? <button type="button" className="tv-frow-link" disabled={disabled} onClick={addDraft}>Adicionar</button> : null}
        </label>
      </div>
      {error ? <p role="alert" className="tv-sheet-m-error">{error}</p> : null}
      <p className="tv-sheet-m-note">Até 10 destaques, com até 30 caracteres cada.</p>
    </>
  )
}
