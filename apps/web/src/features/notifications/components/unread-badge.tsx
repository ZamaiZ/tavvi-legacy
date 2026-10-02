export function UnreadBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null
  return (
    <span className={className ? `tv-notif-count ${className}` : 'tv-notif-count'}>
      {count > 99 ? '99+' : count}
      <span className="sr-only"> não lidas</span>
    </span>
  )
}
