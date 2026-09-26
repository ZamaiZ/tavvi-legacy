import Link from 'next/link'
import { RiStore2Line } from 'react-icons/ri'
import { buttonVariants } from '@/components/ui/button'

export default function WorkspaceNotFound() {
  return (
    <main className="flex min-h-[70dvh] items-center justify-center px-4 py-12 text-center">
      <section className="tavvi-surface w-full max-w-lg p-7 sm:p-9">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <RiStore2Line className="size-6" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-xl font-semibold tracking-[-0.025em]">
          Restaurante não encontrado
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
          O endereço pode estar incorreto ou sua conta não tem acesso a este restaurante.
        </p>
        <Link href="/restaurantes" className={`${buttonVariants()} mt-6`}>
          Ver meus restaurantes
        </Link>
      </section>
    </main>
  )
}
