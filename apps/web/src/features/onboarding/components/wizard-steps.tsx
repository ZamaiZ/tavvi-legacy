'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition, type ComponentProps } from 'react'
import { useFormStatus } from 'react-dom'
import { LinkPendingHint } from '@/components/ui/link-pending'
import { Spinner } from '@/components/ui/spinner'
import { buttonVariants } from '@/components/ui/button'
import { IdentityForm } from '@/features/workspace/components/identity-form'
import { ProfileForm } from '@/features/workspace/components/profile-form'
import { completeOnboardingAction } from '@/server/actions/restaurants'

type IdentityProps = Omit<ComponentProps<typeof IdentityForm>, 'onSaved' | 'continueLabel' | 'busy'>
type ProfileProps = Omit<ComponentProps<typeof ProfileForm>, 'onSaved' | 'continueLabel' | 'busy'>

// Passo 2: salvar leva ao passo 3. Sem mudanças, o mesmo botão só continua.
export function WizardIdentityStep(props: IdentityProps) {
  const router = useRouter()
  const [navigating, startNavigation] = useTransition()
  return (
    <IdentityForm
      {...props}
      busy={navigating}
      continueLabel={navigating ? 'Abrindo o contato…' : 'Salvar e continuar'}
      onSaved={() => startNavigation(() => router.push(`/restaurantes/${props.restaurantId}/comecar?passo=contato`))}
    />
  )
}

// Passo 3: salvar conclui o assistente, como o "Ir para o cardápio".
export function WizardContactStep(props: ProfileProps) {
  const [finishing, startFinish] = useTransition()
  return (
    <ProfileForm
      {...props}
      busy={finishing}
      continueLabel={finishing ? 'Abrindo o cardápio…' : 'Salvar e continuar'}
      onSaved={() =>
        startFinish(async () => {
          const data = new FormData()
          data.set('restaurantId', props.restaurantId)
          // A action grava a marca e redireciona ao cardápio.
          await completeOnboardingAction(data)
        })
      }
    />
  )
}

function ExitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className={buttonVariants({ variant: 'ghost' })} disabled={pending} aria-busy={pending || undefined}>
      {pending ? <Spinner className="size-4" aria-hidden="true" /> : null}
      {pending ? 'Abrindo o cardápio…' : label}
    </button>
  )
}

// "Pular e montar o cardápio" / "Ir para o cardápio": formulário, e não
// link, porque sair do assistente grava a marca que esconde "Primeiros
// passos" do cabeçalho do cardápio.
export function CompleteOnboardingButton({ restaurantId, label }: { restaurantId: string; label: string }) {
  return (
    <form action={completeOnboardingAction}>
      <input type="hidden" name="restaurantId" value={restaurantId} />
      <ExitButton label={label} />
    </form>
  )
}

export function ContinueToContactLink({ restaurantId }: { restaurantId: string }) {
  return (
    <Link href={`/restaurantes/${restaurantId}/comecar?passo=contato`} className={buttonVariants({ variant: 'outline' })}>
      Continuar para o contato
      <LinkPendingHint />
    </Link>
  )
}
