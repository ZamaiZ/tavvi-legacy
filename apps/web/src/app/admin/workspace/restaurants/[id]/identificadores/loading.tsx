import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return <div className="tv-tags-page" aria-busy="true" aria-label="Carregando identificadores">
    <div className="tv-tags-heading">
      <div className="space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-80 max-w-full" /></div>
      <Skeleton className="h-[42px] w-40 rounded-xl" />
    </div>
    <div className="tv-tags-overview"><Skeleton className="h-8 w-24 rounded-full" /><Skeleton className="h-8 w-28 rounded-full" /></div>
    <div className="tv-tags-filters"><Skeleton className="h-9 w-20 rounded-[10px]" /><Skeleton className="h-9 w-20 rounded-[10px]" /><Skeleton className="h-9 w-44 rounded-[10px]" /><Skeleton className="h-9 w-28 rounded-[10px]" /></div>
    <div className="tv-tags-list">{Array.from({ length: 5 }, (_, index) => <div className="tv-tag-card" key={index}><div className="tv-tag-main"><Skeleton className="h-[43px] w-[43px] shrink-0 rounded-[13px]" /><div className="flex flex-1 flex-col gap-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-3 w-36" /></div><Skeleton className="h-7 w-16 rounded-full" /></div><Skeleton className="m-auto mr-3 h-8 w-8 rounded-lg" /></div>)}</div>
  </div>
}
