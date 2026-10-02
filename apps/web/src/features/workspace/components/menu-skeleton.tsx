import { Skeleton } from '@/components/ui/skeleton'

// O esqueleto ESPELHA o cardápio: no desktop, cabeçalho, cartão de
// publicação, barra, chips e duas categorias; no celular, a tela do app
// (título, cartão, chips e grupos de linhas de 48 px de miniatura).
export function MenuSkeleton() {
  return (
    <>
      <main className="tv-mpage tv-d-only" aria-busy="true">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-[30px] w-36 rounded-full" />
        </div>
        <Skeleton className="h-[112px] w-full rounded-[16px]" />
        <div className="flex gap-2"><Skeleton className="h-[30px] w-60 rounded-[9px]" /><Skeleton className="h-[30px] w-80 rounded-[9px]" /></div>
        <div className="flex gap-1.5"><Skeleton className="h-[26px] w-20 rounded-full" /><Skeleton className="h-[26px] w-24 rounded-full" /><Skeleton className="h-[26px] w-28 rounded-full" /></div>
        <div className="space-y-3.5">
          {[0, 1].map((section) => (
            <div key={section} className="tv-cat">
              <div className="tv-cat-head">
                <Skeleton className="mr-auto h-4 w-40" />
                <Skeleton className="size-7 rounded-[7px]" />
              </div>
              {[0, 1, 2].map((row) => (
                <div key={row} className="tv-item">
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
      <div className="tv-mp tv-m-only" aria-busy="true">
        <div className="tv-mp-titlebar"><h1 className="tv-mp-title">Cardápio</h1></div>
        <div className="space-y-4 px-4">
          <Skeleton className="h-[96px] w-full rounded-[16px]" />
          <div className="flex gap-2"><Skeleton className="h-8 w-16 rounded-full" /><Skeleton className="h-8 w-24 rounded-full" /><Skeleton className="h-8 w-20 rounded-full" /></div>
          {[0, 1].map((group) => (
            <div key={group} className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <div className="overflow-hidden rounded-[14px]">
                {[0, 1, 2].map((row) => (
                  <div key={row} className="flex items-center gap-3 py-2.5">
                    <Skeleton className="size-12 rounded-[10px]" />
                    <div className="flex-1 space-y-2"><Skeleton className="h-4 w-40" /><Skeleton className="h-3 w-24" /></div>
                    <Skeleton className="h-[31px] w-[51px] rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
