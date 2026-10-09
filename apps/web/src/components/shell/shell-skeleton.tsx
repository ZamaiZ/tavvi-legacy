import type { ReactNode } from 'react'

// A casca do console e do painel enquanto os dados dela chegam: a mesma
// barra lateral (vazia) e a mesma área principal, para nada pular de lugar
// quando a casca de verdade entra. No celular a barra some, como a real.
export function ShellSkeleton({ children }: { children: ReactNode }) {
  return (
    <div className="tv-console-root" aria-busy="true">
      <div className="tv-sidebar tv-shell-skeleton-rail" aria-hidden="true">
        <span className="tv-skeleton tv-shell-skeleton-mark" />
        {Array.from({ length: 5 }, (_, index) => <span key={index} className="tv-skeleton tv-shell-skeleton-icon" />)}
      </div>
      <main className="tv-console-main">{children}</main>
      <div className="tv-shell-skeleton-dock" aria-hidden="true">
        <span className="tv-skeleton" />
        <span className="tv-skeleton" />
        <span className="tv-skeleton" />
      </div>
    </div>
  )
}
