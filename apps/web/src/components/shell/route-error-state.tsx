'use client'

import Link from 'next/link'
import { RiErrorWarningLine, RiRefreshLine } from 'react-icons/ri'
import { Button, buttonVariants } from '@/components/ui/button'

export function RouteErrorState({
  retry,
  backHref = '/restaurantes',
}: {
  retry: () => void
  backHref?: string
}) {
  return (
    <main className="flex min-h-[70dvh] items-center justify-center px-4 py-12">
      <section className="tavvi-surface w-full max-w-lg p-7 text-center sm:p-9">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <RiErrorWarningLine className="size-6" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-xl font-semibold tracking-[-0.025em]">
          Não foi possível carregar esta página
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
          Pode ser uma instabilidade temporária de rede ou do serviço. Seus
          dados não foram alterados.
        </p>
        <div className="mt-6 flex flex-col-reverse justify-center gap-2 sm:flex-row">
          <Link href={backHref} className={buttonVariants({ variant: 'outline' })}>
            Voltar para restaurantes
          </Link>
          <Button onClick={retry}>
            <RiRefreshLine aria-hidden="true" />
            Tentar novamente
          </Button>
        </div>
      </section>
    </main>
  )
}
