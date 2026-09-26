import { Reveal } from '@/components/motion/reveal'
import { APP_MONOGRAM, APP_NAME } from '@/lib/brand'
import { ThemeToggle } from '@/components/theme/theme-toggle'

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children?: React.ReactNode
}) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-surface-1 px-4 py-12">
      {/* Um halo único, atrás de tudo, sem interceptar clique. É o que tira a
          tela de entrada da cara de formulário solto no branco, sem custar
          uma imagem nem um segundo de carregamento. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-48 left-1/2 h-[480px] w-[700px] -translate-x-1/2 rounded-full bg-primary/12 blur-3xl"
      />

      <div className="absolute right-4 top-4"><ThemeToggle /></div>

      <Reveal className="relative w-full max-w-[420px]">
        <div className="mb-7 flex items-center justify-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-xs font-bold tracking-[0.08em] text-primary-foreground shadow-sm">
            {APP_MONOGRAM}
          </span>
          <span className="text-sm font-semibold tracking-[-0.01em]">{APP_NAME}</span>
        </div>
        <div className="space-y-2 text-center">
          <h1 className="text-[2rem] font-semibold leading-tight tracking-[-0.035em]">
            {title}
          </h1>
          {subtitle ? (
            <p className="text-body text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {children ? <div className="tavvi-surface mt-8 p-6 sm:p-7">{children}</div> : null}
      </Reveal>
    </main>
  )
}
