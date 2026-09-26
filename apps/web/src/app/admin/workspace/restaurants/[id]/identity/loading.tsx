import { Skeleton } from '@/components/ui/skeleton'

// A tela de identidade é a mais pesada do painel: ela carrega as nove fontes
// de tema. A pré-visualização agora flutua fora do fluxo, então o esqueleto
// mantém apenas a coluna de edição estável.
export default function Loading() {
  return (
    <main className="tavvi-page">
      <div className="mb-8 space-y-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>

      <div className="tv-identity-layout">
      <div className="tavvi-surface space-y-6 p-5 sm:p-6">
          {/* Logo e capa. */}
          <div className="grid gap-6 sm:grid-cols-[auto_minmax(0,1fr)]">
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="size-24 rounded-lg" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          </div>

          {/* Segmento. */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>

          {/* Os oito temas. */}
          <div className="space-y-3">
            <Skeleton className="h-4 w-36" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((tema) => (
                <Skeleton key={tema} className="h-20 rounded-lg" />
              ))}
            </div>
          </div>

          {/* As duas cores. */}
          <div className="grid gap-6 sm:grid-cols-2">
            {[0, 1].map((cor) => (
              <div key={cor} className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-11 w-full rounded-md" />
              </div>
            ))}
          </div>
      </div>
      </div>
    </main>
  )
}
