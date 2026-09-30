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
    <header className={`mb-[18px] flex flex-col justify-between gap-4 sm:flex-row sm:items-end ${className ?? ''}`}>
      <div className="min-w-0 max-w-[560px]">
        {eyebrow ? (
          <p className="mb-1 text-[11.5px] font-medium text-[var(--tv-gold-text)]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-[22px] font-semibold leading-[1.2] tracking-[-0.022em]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-[560px] text-[13px] leading-[1.45] text-[var(--tv-text-2)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  )
}
