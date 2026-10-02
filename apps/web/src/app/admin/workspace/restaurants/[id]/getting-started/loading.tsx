import { Skeleton } from '@/components/ui/skeleton'

// Espelha o assistente: barra de progresso, título, frase e os cartões do
// formulário (o passo 2 e o passo 3 têm a mesma forma).
export default function Loading() {
  return (
    <main className="tavvi-page" aria-busy="true">
      <div className="mb-8 space-y-3">
        <Skeleton className="h-2 w-[280px] max-w-full rounded-full" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          {[0, 1].map((card) => <Skeleton key={card} className="h-[220px] w-full rounded-[14px]" />)}
        </div>
        <Skeleton className="hidden h-[520px] w-[260px] rounded-[34px] lg:block" />
      </div>
    </main>
  )
}
