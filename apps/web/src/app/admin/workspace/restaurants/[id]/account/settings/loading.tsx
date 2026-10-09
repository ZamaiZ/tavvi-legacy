import { PageHeader } from '@/components/shell/page-header'
import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <main className="tv-console-page tv-account-page" aria-busy="true">
      <PageHeader title="Configurações" description="Aparência, avisos e sessões." />
      <div className="tv-account-sections">
        <section className="tv-acc-section">
          <h2>Aparência</h2>
          <div className="tv-acc-card tv-acc-themes">
            {[0, 1, 2].map((theme) => (
              <div key={theme} className="flex min-w-0 flex-col gap-[9px] rounded-xl p-1">
                <Skeleton className="aspect-[16/10] w-full rounded-[10px]" />
                <Skeleton className="h-3 w-16 self-center" />
              </div>
            ))}
          </div>
        </section>

        <section className="tv-acc-section">
          <h2>Notificações</h2>
          <div className="tv-notif-device is-page">
            <div className="flex min-h-[56px] items-center gap-3 px-4">
              <Skeleton className="size-7 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="h-3 w-52 max-w-full" />
              </div>
              <Skeleton className="h-5 w-9 rounded-full" />
            </div>
            <div className="border-t px-4 py-3"><Skeleton className="h-3.5 w-40" /></div>
            <div className="border-t px-4 py-3"><Skeleton className="h-3.5 w-36" /></div>
          </div>
        </section>
      </div>
    </main>
  )
}
