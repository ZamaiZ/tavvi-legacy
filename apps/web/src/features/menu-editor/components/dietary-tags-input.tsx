'use client'

import { useState, type KeyboardEvent } from 'react'
import { LuPlus, LuX } from 'react-icons/lu'
import { Input } from '@/components/ui/input'

const suggestions = ['Vegetariano', 'Vegano', 'Sem glúten', 'Sem lactose', 'Picante', 'Contém castanhas']

export function DietaryTagsInput({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) {
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
  }

  return <div className="tv-tag-editor">
    <div className="tv-tag-list">{value.map((tag) => <span key={tag}>{tag}<button type="button" aria-label={`Remover ${tag}`} onClick={() => onChange(value.filter((entry) => entry !== tag))}><LuX /></button></span>)}</div>
    <div className="tv-tag-add"><Input value={draft} maxLength={30} onChange={(event) => { setDraft(event.target.value); setError(null) }} onKeyDown={onKeyDown} placeholder="Adicionar destaque" aria-label="Adicionar destaque" /><button type="button" onClick={() => addTag(draft)} aria-label="Adicionar destaque"><LuPlus /></button></div>
    <div className="tv-tag-suggestions" aria-label="Sugestões de destaque">{suggestions.map((tag) => <button key={tag} type="button" disabled={value.includes(tag) || value.length >= 10} onClick={() => addTag(tag)}>{tag}</button>)}</div>
    {error ? <p role="alert">{error}</p> : null}
  </div>
}
