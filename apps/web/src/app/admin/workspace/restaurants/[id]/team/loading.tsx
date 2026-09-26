import { Skeleton } from '@/components/ui/skeleton'

// Espelha a tela de equipe: o cabeçalho com o botão de convidar, a lista de
// membros com avatar, e a seção de convites em aberto.
export default function Loading() {
  return (
    <main className="tavvi-page">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-36 rounded-4xl" />
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((role) => <div key={role} className="tavvi-surface space-y-3 p-4"><Skeleton className="h-4 w-28" /><Skeleton className="h-8 w-full" /><Skeleton className="h-6 w-20 rounded-full" /></div>)}
      </div>

      <div className="tavvi-surface space-y-2 p-3">
        {[0, 1, 2].map((membro) => (
          <div
            key={membro}
            className="flex items-center gap-3 rounded-xl px-4 py-3"
          >
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="mr-auto space-y-2">
              <Skeleton className="h-4 w-52" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-7 w-24 rounded-md" />
          </div>
        ))}
      </div>

      <Skeleton className="mb-4 mt-10 h-6 w-48" />
      <div className="space-y-2">
        {[0, 1].map((convite) => (
          <Skeleton key={convite} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    </main>
  )
}
