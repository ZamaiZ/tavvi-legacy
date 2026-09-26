import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <main className="tavvi-page">
      <Skeleton className="mb-8 h-9 w-64" />
      <div className="space-y-4">
        {[0, 1].map((row) => (
          <Skeleton key={row} className="h-20 w-full" />
        ))}
      </div>
    </main>
  )
}
