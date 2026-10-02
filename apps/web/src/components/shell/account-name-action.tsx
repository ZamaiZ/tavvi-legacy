'use client'

import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from 'react'
import { LuUserRound } from 'react-icons/lu'
import { SpinnerRing } from '@/components/ui/spinner'
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
  disabled = false,
  onSaved,
}: {
  name: string | null
  variant: 'row' | 'popover'
  className?: string
  /** Outra ação da tela está rodando (sair da conta). */
  disabled?: boolean
  /** O cabeçalho do popover mostra o nome salvo sem esperar o servidor. */
  onSaved?: (name: string) => void
}) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [saved, setSaved] = useState(name ?? '')
  const [value, setValue] = useState(name ?? '')
  const [pending, startTransition] = useTransition()
  const trimmed = value.trim()
  const dirty = trimmed !== saved
  const valid = trimmed.length >= 2 && trimmed.length <= 80

  // No popover, campo e "Salvar" ficam desabilitados enquanto salva e o foco
  // cai no <body>; depois, volta ao campo para o Tab seguir preso no
  // diálogo. Só no desktop: no celular, focar o campo subiria o teclado.
  const wasPending = useRef(false)
  useEffect(() => {
    if (pending) {
      wasPending.current = true
      return
    }
    if (!wasPending.current) return
    wasPending.current = false
    if (variant === 'popover' && document.activeElement === document.body) inputRef.current?.focus()
  }, [pending, variant])

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!dirty || !valid || pending || disabled) return
    // Dentro de transição: é o contrato do Next 16.3.5 para action vinda de evento.
    startTransition(async () => {
      const result = await updateDisplayNameAction({ displayName: trimmed })
      if (!result.ok) {
        toast.add({ title: result.error, type: 'error' })
        return
      }
      setSaved(result.data.displayName)
      setValue(result.data.displayName)
      onSaved?.(result.data.displayName)
      toast.add({ title: 'Nome salvo', type: 'success' })
    })
  }

  const input = (
    <input
      ref={inputRef}
      id={inputId}
      name="name"
      type="text"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      maxLength={80}
      autoComplete="name"
      enterKeyHint="done"
      placeholder="Seu nome"
      disabled={pending || disabled}
    />
  )
  const save = dirty ? (
    <button
      type="submit"
      className={variant === 'row' ? 'tv-mname-save' : 'tv-account-name-save'}
      disabled={!valid || pending || disabled}
      aria-busy={pending || undefined}
    >
      {pending ? <><SpinnerRing decorative />Salvando…</> : 'Salvar'}
    </button>
  ) : null

  // No popover, primeira linha do grupo de Nome e Tema: rótulo à esquerda,
  // campo sem borda alinhado à direita.
  if (variant === 'popover') {
    return (
      <form className="tv-account-name" onSubmit={onSubmit} noValidate>
        <label className="tv-account-label" htmlFor={inputId}>Nome</label>
        {input}
        {save}
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
