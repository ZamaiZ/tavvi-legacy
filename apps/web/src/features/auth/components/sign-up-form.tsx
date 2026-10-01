'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { RiErrorWarningLine, RiMailCheckLine } from 'react-icons/ri'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { signUpAction } from '@/server/actions/auth'

export function SignUpForm() {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(signUpAction, undefined)

  useEffect(() => {
    // O cadastro não redireciona: a pessoa precisa continuar NESTA página,
    // agora autenticada, para clicar em aceitar. O refresh faz o servidor
    // renderizar de novo e enxergar a sessão recém-criada. Sem sessão (a
    // confirmação de e-mail ligada no Supabase), não há o que recarregar.
    if (state?.ok && !state.data.confirmEmail) router.refresh()
  }, [state, router])

  return (
    <form action={formAction} className="space-y-6">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="signup-name">Nome</FieldLabel>
          <Input
            id="signup-name"
            name="name"
            type="text"
            autoComplete="name"
            maxLength={80}
            required
          />
          <FieldDescription>É como a equipe vai ver você.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="signup-email">E-mail</FieldLabel>
          <Input
            id="signup-email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="signup-password">Senha</FieldLabel>
          <Input
            id="signup-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
          />
          <FieldDescription>Ao menos 8 caracteres.</FieldDescription>
        </Field>
      </FieldGroup>

      {/* `Alert` porque esta é tela de entrada, não diálogo: aqui o erro
          precisa ter forma reconhecível. Ver o comentário em
          `sign-in-form.tsx`. */}
      {state && !state.ok ? (
        <Alert variant="destructive" role="alert">
          <RiErrorWarningLine aria-hidden="true" />
          <AlertTitle>Não foi possível criar a conta</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {state?.ok && state.data.confirmEmail ? (
        <Alert role="status">
          <RiMailCheckLine aria-hidden="true" />
          <AlertTitle>Confirme seu e-mail</AlertTitle>
          <AlertDescription>
            Conta criada. Abra o link que enviamos para o seu e-mail e volte a
            este convite para continuar.
          </AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" className="h-11 w-full" disabled={pending}>
        {pending ? <Spinner className="size-4" /> : null}
        {pending ? 'Criando conta…' : 'Criar conta'}
      </Button>
    </form>
  )
}
