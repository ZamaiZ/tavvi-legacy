import { Skeleton } from '@/components/ui/skeleton'

// Estado mínimo enquanto confirma a participação antes do redirect ao Cardápio.
export default function Loading() {
  return (
    <div className="tv-mp tv-msettings" aria-busy="true">
      <Skeleton className="h-[32px] w-[130px] rounded-[10px]" />
      <Skeleton className="h-[100px] rounded-[14px]" />
      <Skeleton className="mt-4 h-[100px] rounded-[14px]" />
      <Skeleton className="mt-4 h-[48px] rounded-[14px]" />
    </div>
  )
}
