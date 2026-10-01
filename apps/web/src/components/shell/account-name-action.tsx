'use client'

import { useId, useState, type FormEvent } from 'react'
import { LuUserRound } from 'react-icons/lu'
import { toast } from '@/components/ui/toast'
import { updateDisplayNameAction } from '@/server/actions/profile'

// "Nome": o nome que a equipe vê. Fica logo abaixo da identificação nas três
// telas de conta (popover do desktop, Conta do console e Ajustes do painel),
// como "Notificações". A linha é o próprio campo; "Salvar" só aparece com
// mudança, e Enter também salva. Nada ganha foco sozinho: no celular o
// teclado só sobe quando a pessoa toca no campo.
export function AccountNameAction({
  name,
  variant,
  className,
}: {
  name: string | null
  variant: 'row' | 'popover'
  className?: string
}) {
  const inputId = useId()
  const [saved, setSaved] = useState(name ?? '')
  const [value, setValue] = useState(name ?? '')
  const [pending, setPending] = useState(false)
  const trimmed = value.trim()
  const dirty = trimmed !== saved
  const valid = trimmed.length >= 2 && trimmed.length <= 80

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!dirty || !valid || pending) return
    setPending(true)
    const result = await updateDisplayNameAction({ displayName: trimmed })
    setPending(false)
    if (!result.ok) {
      toast.add({ title: result.error, type: 'error' })
      return
    }
    setSaved(result.data.displayName)
    setValue(result.data.displayName)
    toast.add({ title: 'Nome salvo', type: 'success' })
  }

  const input = (
    <input
      id={inputId}
      name="name"
      type="text"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      maxLength={80}
      autoComplete="name"
      enterKeyHint="done"
      placeholder="Seu nome"
    />
  )
  const save = dirty ? (
    <button
      type="submit"
      className={variant === 'row' ? 'tv-mname-save' : 'tv-account-name-save'}
      disabled={!valid || pending}
      aria-busy={pending || undefined}
    >
      {pending ? <span className="tv-spinner" aria-label="Salvando" /> : 'Salvar'}
    </button>
  ) : null

  if (variant === 'popover') {
    return (
      <form className="tv-account-section" onSubmit={onSubmit} noValidate>
        <label className="tv-account-label" htmlFor={inputId}>Nome</label>
        <div className="tv-account-name">
          {input}
          {save}
        </div>
      </form>
    )
  }

  return (
    <form className={className ? `tv-group ${className}` : 'tv-group'} onSubmit={onSubmit} noValidate>
      <div className="tv-mname">
        <span className="tv-mlink-icon" aria-hidden="true"><LuUserRound /></span>
        <label className="tv-mname-copy" htmlFor={inputId}>
          <small>Nome</small>
          {input}
        </label>
        {save}
      </div>
    </form>
  )
}
