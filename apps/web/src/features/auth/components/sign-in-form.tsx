'use client'

import { useActionState, useEffect } from 'react'
import { RiErrorWarningLine } from 'react-icons/ri'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { signInAction } from '@/server/actions/auth'

export function SignInForm({ next, onPendingChange }: { next: string; onPendingChange?: (pending: boolean) => void }) {
  const [state, formAction, pending] = useActionState(signInAction, undefined)

  // Navegação de documento inteiro depois do sucesso (ver signInAction).
  useEffect(() => {
    if (state?.ok) window.location.replace(state.data.next)
  }, [state])
  const busy = pending || state?.ok === true

  // As abas do convite travam junto (InviteAuthTabs).
  useEffect(() => {
    onPendingChange?.(busy)
  }, [busy, onPendingChange])

  return (
    <form action={formAction} className="space-y-6" aria-busy={busy || undefined}>
      <input type="hidden" name="next" value={next} />

      <fieldset disabled={busy} className="contents">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">E-mail</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            autoFocus
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Senha</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>
      </FieldGroup>
      </fieldset>

      {/* `Alert` na tela de entrada, e não um parágrafo vermelho: é a
          primeira superfície que o dono vê, e "e-mail ou senha incorretos"
          numa linha solta é fácil de não notar depois de um envio.

          Dentro de DIÁLOGO o parágrafo compacto fica — uma caixa com borda
          dentro de outra caixa com borda contraria a regra de "menos borda,
          mais superfície" da própria Fase 5. */}
      {state && !state.ok ? (
        <Alert variant="destructive" role="alert">
          <RiErrorWarningLine aria-hidden="true" />
          <AlertTitle>Não foi possível entrar</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" className="h-11 w-full" disabled={busy}>
        {busy ? <Spinner className="size-4" aria-hidden="true" /> : null}
        {busy ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  )
}
