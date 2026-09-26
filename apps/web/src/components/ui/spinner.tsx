import { cn } from "cn"
import { RiLoader4Line } from "react-icons/ri"

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <RiLoader4Line data-slot="spinner" role="status" aria-label="Loading" className={cn("size-4 animate-spin", className)} {...props} />
  )
}

export { Spinner }
