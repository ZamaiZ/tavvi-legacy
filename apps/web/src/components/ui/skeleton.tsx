import { cn } from "cn"

// Um esqueleto só: o brilho `.tv-skeleton` do console e do painel. Antes o
// painel usava o pulso do shadcn e o console o brilho, e a mesma espera
// parecia duas coisas diferentes.
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("tv-skeleton rounded-xl", className)}
      {...props}
    />
  )
}

export { Skeleton }
