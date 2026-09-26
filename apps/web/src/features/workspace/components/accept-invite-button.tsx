'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { redeemInviteAction } from '@/server/actions/invites'

export function AcceptInviteButton({ token }: { token: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function accept() {
    setPending(true)
    setError(null)

    const result = await redeemInviteAction(token)

    if (result.ok) {
      toast.add({ title: 'Convite aceito', type: 'success' })
      router.replace('/')
      return
    }

    setPending(false)
    setError(result.error)
  }

  // O resgate acontece NO CLIQUE, nunca ao carregar a página. O convite é
  // de uso único: um recarregamento acidental não pode consumi-lo.
  return (
    <div className="space-y-4">
      <Button className="w-full" onClick={accept} disabled={pending}>
        {pending ? <Spinner className="size-4" /> : null}
        Aceitar convite
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
