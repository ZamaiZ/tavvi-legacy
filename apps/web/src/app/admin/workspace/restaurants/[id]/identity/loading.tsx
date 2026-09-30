import { Skeleton } from '@/components/ui/skeleton'

// O esqueleto repete a grade da página — os dois cartões à esquerda e a
// prévia de 300 px à direita —, para nada pular quando o conteúdo chega.
export default function Loading() {
  return (
    <main className="tv-identity-page">
      <div className="mb-[18px] space-y-2">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="tv-identity-layout">
        <div className="tv-identity-main">
          {/* Logo e capa. */}
          <div className="tv-identity-card">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-48" />
            </div>
            <div className="tv-brand-tiles">
              <Skeleton className="aspect-square rounded-xl" />
              <Skeleton className="rounded-xl" />
            </div>
          </div>

          {/* Tipo, temas, cores e densidade. */}
          <div className="tv-identity-card is-theme">
            <div className="max-w-[320px] space-y-1.5">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-8 w-full rounded-lg" />
            </div>
            <div className="tv-identity-themes">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((tema) => (
                <Skeleton key={tema} className="h-[88px] rounded-[11px]" />
              ))}
            </div>
            <div className="tv-identity-colors">
              {[0, 1].map((cor) => (
                <div key={cor} className="space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-[26px] w-[166px] rounded-full" />
                </div>
              ))}
            </div>
            <Skeleton className="h-[30px] w-[190px] rounded-[9px]" />
          </div>
        </div>

        <div className="tv-identity-aside">
          <Skeleton className="h-3 w-28 self-start" />
          <Skeleton className="h-[520px] w-[260px] rounded-[34px]" />
        </div>
      </div>
    </main>
  )
}
