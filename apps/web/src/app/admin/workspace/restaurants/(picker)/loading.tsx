import { ShellSkeleton } from '@/components/shell/shell-skeleton'
import { Skeleton } from '@/components/ui/skeleton'

// Espelha a grade de cartões da lista: capa de 112px, logo sobreposto, nome,
// endereço e a marca de situação. As mesmas colunas em cada largura, para a
// grade não reorganizar quando o conteúdo chega. Mora no grupo `(picker)`
// para não envolver `[id]`: entrar num restaurante mostra a casca do painel,
// e não esta grade.
export default function Loading() {
  return (
    <ShellSkeleton>
      <main className="tavvi-page">
        <Skeleton className="mb-6 h-9 w-64" />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((cartao) => (
            <div
              key={cartao}
              className="overflow-hidden rounded-[20px] border border-border/70 bg-card shadow-[var(--shadow-1)]"
            >
              <Skeleton className="h-32 w-full rounded-none" />
              <div className="space-y-2 px-5 pb-5 pt-10">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-52" />
                <Skeleton className="h-7 w-20 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </ShellSkeleton>
  )
}
