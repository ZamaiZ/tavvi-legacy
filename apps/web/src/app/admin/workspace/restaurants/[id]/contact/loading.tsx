import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <main className="tv-contact-page">
      <div className="mb-[18px] flex flex-col gap-[3px]">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="tv-contact-layout">
        <div className="tv-contact-form">
          {[2, 3, 1].map((fields, index) => <div key={index} className="tv-contact-card">
            <div className="space-y-1.5"><Skeleton className="h-4 w-24" /><Skeleton className="h-3.5 w-64 max-w-full" /></div>
            {Array.from({ length: fields }).map((_, field) => <div key={field} className="tv-contact-field"><Skeleton className="h-3.5 w-20" /><Skeleton className="h-8 w-full rounded-lg" /></div>)}
          </div>)}
          <Skeleton className="h-[48px] w-full rounded-full" />
        </div>
        <div className="tv-contact-preview">
          <Skeleton className="h-4 w-28 self-start" />
          <Skeleton className="h-[520px] w-[260px] rounded-[34px]" />
        </div>
      </div>
    </main>
  )
}
