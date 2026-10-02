'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { redeemInviteAction } from '@/server/actions/invites'

export function AcceptInviteButton({ token }: { token: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // O resgate acontece NO CLIQUE, nunca ao carregar a página. O convite é
  // de uso único: um recarregamento acidental não pode consumi-lo.
  // Dentro de transição, o `pending` dura até a navegação terminar.
  function accept() {
    setError(null)
    startTransition(async () => {
      const result = await redeemInviteAction(token)
      if (result.ok) {
        toast.add({ title: 'Convite aceito', type: 'success' })
        router.replace('/')
        return
      }
      setError(result.error)
    })
  }

  return (
    <div className="space-y-4">
      <Button className="w-full" onClick={accept} disabled={pending} aria-busy={pending || undefined}>
        {pending ? <Spinner className="size-4" aria-hidden="true" /> : null}
        {pending ? 'Entrando no restaurante…' : 'Aceitar convite'}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
