import { cn } from "cn"
import { RiLoader4Line } from "react-icons/ri"

// Um módulo de spinner para o projeto inteiro, em português. `Spinner` é o
// traço girando (shadcn); `SpinnerRing` é o anel do handoff (`.tv-spinner`),
// o dos botões do painel e do console. Ao lado de texto ("Salvando…"), passe
// `aria-hidden`/`decorative`: o texto já anuncia, e dois anúncios competem.
function Spinner({
  className,
  label = "Carregando",
  ...props
}: React.ComponentProps<"svg"> & { label?: string }) {
  const decorative = props["aria-hidden"] === true || props["aria-hidden"] === "true"
  return (
    <RiLoader4Line
      data-slot="spinner"
      role={decorative ? undefined : "status"}
      aria-label={decorative ? undefined : label}
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  )
}

function SpinnerRing({
  className,
  label = "Carregando",
  decorative = false,
}: {
  className?: string
  label?: string
  decorative?: boolean
}) {
  return (
    <span
      data-slot="spinner"
      className={cn("tv-spinner", className)}
      role={decorative ? undefined : "status"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
    />
  )
}

export { Spinner, SpinnerRing }
