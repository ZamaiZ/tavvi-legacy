import { Skeleton } from '@/components/ui/skeleton'

// Espelha Feedbacks: título, filtros e os cartões.
export default function Loading() {
  return (
    <div className="tv-mp tv-fb-page" aria-busy="true">
      <Skeleton className="h-[32px] w-[170px] rounded-[10px]" />
      <div className="tv-fb-chips">
        <Skeleton className="h-[32px] w-[72px] rounded-full" />
        <Skeleton className="h-[32px] w-[120px] rounded-full" />
      </div>
      <div className="tv-fb-list">
        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-[112px] rounded-[16px]" />)}
      </div>
    </div>
  )
}
