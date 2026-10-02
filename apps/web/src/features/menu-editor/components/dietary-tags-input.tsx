'use client'

import { useRef, useState, type KeyboardEvent } from 'react'
import { LuX } from 'react-icons/lu'

const suggestions = ['Vegetariano', 'Vegano', 'Sem glúten', 'Sem lactose', 'Picante', 'Contém castanhas']

// Destaques e restrições: pílulas goldSoft; Enter ou vírgula adiciona;
// Backspace no campo vazio tira a última; no máximo 10, até 30 caracteres.
export function DietaryTagsInput({ value, onChange, disabled = false }: { value: string[]; onChange: (tags: string[]) => void; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  function addTag(raw: string) {
    const tag = raw.trim()
    if (!tag) return
    if (tag.length > 30) { setError('Cada destaque pode ter até 30 caracteres.'); return }
    if (value.includes(tag)) { setDraft(''); setError(null); return }
    if (value.length >= 10) { setError('Use no máximo 10 destaques.'); return }
    onChange([...value, tag])
    setDraft('')
    setError(null)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addTag(draft)
    }
    if (event.key === 'Backspace' && draft === '' && value.length > 0) onChange(value.slice(0, -1))
  }

  return (
    <div className="tv-tags">
      <div className="tv-tags-box" onClick={() => { if (!disabled) inputRef.current?.focus() }}>
        {value.map((tag) => (
          <span key={tag} className="tv-tag">
            {tag}
            <button type="button" aria-label={`Remover ${tag}`} disabled={disabled} onClick={() => onChange(value.filter((entry) => entry !== tag))}><LuX aria-hidden="true" /></button>
          </span>
        ))}
        <input ref={inputRef} value={draft} maxLength={30} disabled={disabled} onChange={(event) => { setDraft(event.target.value); setError(null) }} onKeyDown={onKeyDown} placeholder="Adicionar destaque" aria-label="Adicionar destaque" />
      </div>
      <div className="tv-tags-suggest" aria-label="Sugestões de destaque">
        {suggestions.map((tag) => (
          <button key={tag} type="button" disabled={disabled || value.includes(tag) || value.length >= 10} onClick={() => addTag(tag)}>+ {tag}</button>
        ))}
      </div>
      {error ? <p role="alert" className="tv-pfield-error">{error}</p> : null}
    </div>
  )
}
