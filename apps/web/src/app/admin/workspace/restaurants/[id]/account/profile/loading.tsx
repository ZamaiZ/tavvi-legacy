import { PageHeader } from '@/components/shell/page-header'
import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <main className="tv-console-page tv-account-page" aria-busy="true">
      <PageHeader title="Perfil" description="Seus dados de acesso ao Tavvi." />
      <div className="tv-account-sections">
        <section className="tv-acc-section">
          <div className="tv-acc-identity">
            <Skeleton className="size-12 rounded-[15px]" />
            <div className="min-w-0 flex-1 gap-2">
              <Skeleton className="h-5 w-48 max-w-full" />
              <Skeleton className="h-3.5 w-56 max-w-full" />
              <Skeleton className="h-4 w-36 rounded-full" />
            </div>
          </div>
        </section>

        <section className="tv-acc-section">
          <h2>Informações</h2>
          <div className="tv-acc-card">
            {[0, 1, 2, 3, 4].map((row) => (
              <div key={row} className="tv-acc-row">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3.5 w-40 max-w-[55%]" />
              </div>
            ))}
            <div className="px-4 py-3"><Skeleton className="h-3 w-64 max-w-full" /></div>
          </div>
        </section>

        <section className="tv-acc-section">
          <h2>Segurança</h2>
          <div className="tv-acc-card">
            <div className="tv-acc-row tv-acc-password-row">
              <Skeleton className="size-7 rounded-lg" />
              <div className="tv-acc-password-copy gap-2">
                <Skeleton className="h-3.5 w-16" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="h-3.5 w-16" />
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
