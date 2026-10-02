import { AuthShell } from '@/features/auth/components/auth-shell'
import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <AuthShell title="Abrindo o convite…">
      <div className="space-y-5" aria-busy="true">
        <Skeleton className="h-10 w-full rounded-lg" />
        {[0, 1, 2].map((field) => (
          <div key={field} className="space-y-2"><Skeleton className="h-3.5 w-20" /><Skeleton className="h-10 w-full rounded-lg" /></div>
        ))}
        <Skeleton className="h-11 w-full rounded-lg" />
      </div>
    </AuthShell>
  )
}
