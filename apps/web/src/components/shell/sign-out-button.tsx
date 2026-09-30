'use client'

import { useTransition } from 'react'
import { RiLogoutBoxLine } from 'react-icons/ri'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { signOutAction } from '@/server/actions/auth'
import { cn } from 'cn'

export function SignOutButton({
  compact = false,
  className,
}: {
  compact?: boolean
  className?: string
}) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      variant="ghost"
      size={compact ? 'icon-lg' : 'lg'}
      disabled={pending}
      aria-label={compact ? (pending ? 'Saindo' : 'Sair') : undefined}
      className={cn(
        'relative text-muted-foreground hover:bg-destructive/10 hover:text-destructive',
        compact ? 'w-full' : 'w-full justify-start gap-3 px-3',
        className,
      )}
      onClick={() => startTransition(async () => {
        await signOutAction()
        window.location.replace('/entrar')
      })}
    >
      {pending ? <Spinner className="size-4" /> : <RiLogoutBoxLine className="size-[18px]" />}
      {!compact ? <span>{pending ? 'Saindo…' : 'Sair'}</span> : null}
    </Button>
  )
}
