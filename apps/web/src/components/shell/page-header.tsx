// Cabeçalho único das superfícies privadas. A família vem do território
// Tavvi; aqui a hierarquia é construída por peso, escala e espaçamento.
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <header className={`mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end ${className ?? ''}`}>
      <div className="min-w-0 max-w-2xl">
        {eyebrow ? (
          <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-primary">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-[clamp(1.625rem,2.5vw,2.125rem)] font-semibold leading-[1.1] tracking-[-0.03em]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  )
}
