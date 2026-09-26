import { Skeleton } from '@/components/ui/skeleton'

// O esqueleto ESPELHA o layout que vem depois: cabeçalho, card de estado da
// publicação, e duas seções de categoria com três linhas cada — com a mesma
// altura de linha do `ItemRow`, que tem miniatura de 48px.
//
// Até a Fase 5 isto era um par de retângulos genéricos de 160px, sem relação
// com a tela que carregava, e o efeito era um salto quando o conteúdo
// chegava. Esqueleto que não tem a forma do conteúdo não reduz a espera
// percebida — só avisa que algo vai mudar de lugar.
export default function Loading() {
  return (
    <main className="tv-menu-page">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-9 w-40" />
      </div>

      {/* O card de estado da publicação. */}
      <Skeleton className="mb-8 h-20 w-full rounded-[18px]" />

      <div className="mb-4 flex gap-2"><Skeleton className="h-11 w-72 rounded-[15px]" /><Skeleton className="h-11 w-64 rounded-[15px]" /></div>
      <div className="mb-5 flex gap-2"><Skeleton className="h-9 w-24 rounded-[13px]" /><Skeleton className="h-9 w-28 rounded-[13px]" /><Skeleton className="h-9 w-28 rounded-[13px]" /></div>

      <div className="space-y-6">
        {[0, 1].map((secao) => (
          <div
            key={secao}
            className="overflow-hidden rounded-[20px] border border-border/70 bg-card"
          >
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <div className="mr-auto space-y-2">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="size-8 rounded-md" />
              <Skeleton className="size-8 rounded-md" />
            </div>

            {[0, 1, 2].map((linha) => (
              <div
                key={linha}
                className="flex min-h-14 items-center gap-3 border-b border-border px-4 py-2 last:border-b-0"
              >
                {/* 48px: o mesmo da miniatura real. */}
                <Skeleton className="size-12 shrink-0 rounded-lg" />
                <div className="mr-auto space-y-2">
                  <Skeleton className="h-4 w-44" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-6 w-10 rounded-full" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </main>
  )
}
