import { Skeleton } from '@/components/ui/skeleton'

// O esqueleto ESPELHA o layout que vem depois: cabeçalho, cartão dourado de
// publicação, barra, chips e duas categorias com três linhas cada — com a
// mesma altura de linha do `ItemRow`, que tem miniatura de 44px.
//
// Esqueleto que não tem a forma do conteúdo não reduz a espera percebida —
// só avisa que algo vai mudar de lugar.
export default function Loading() {
  return (
    <main className="tv-mpage">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-[30px] w-36 rounded-full" />
      </div>

      {/* O cartão dourado de publicação. */}
      <Skeleton className="h-[112px] w-full rounded-[16px]" />

      <div className="flex gap-2"><Skeleton className="h-[30px] w-60 rounded-[9px]" /><Skeleton className="h-[30px] w-80 rounded-[9px]" /></div>
      <div className="flex gap-1.5"><Skeleton className="h-[26px] w-20 rounded-full" /><Skeleton className="h-[26px] w-24 rounded-full" /><Skeleton className="h-[26px] w-28 rounded-full" /></div>

      <div className="space-y-3.5">
        {[0, 1].map((secao) => (
          <div key={secao} className="tv-cat">
            <div className="tv-cat-head">
              <Skeleton className="mr-auto h-4 w-40" />
              <Skeleton className="size-7 rounded-[7px]" />
            </div>
            {[0, 1, 2].map((linha) => (
              <div key={linha} className="tv-item">
                {/* 44px: o mesmo da miniatura real. */}
                <Skeleton className="size-11 rounded-[10px]" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-44" />
                  <Skeleton className="h-3 w-64" />
                </div>
                <Skeleton className="h-[18px] w-[30px] rounded-full" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </main>
  )
}
