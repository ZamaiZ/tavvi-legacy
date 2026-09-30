import { Skeleton } from '@/components/ui/skeleton'

// Espelha o Serviço: título e a grade de blocos.
export default function Loading() {
  return (
    <div className="tv-mp tv-service-page" aria-busy="true">
      <Skeleton className="h-[32px] w-[150px] rounded-[10px]" />
      <div className="tv-service">
        {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-[104px] rounded-[16px]" />)}
      </div>
    </div>
  )
}
