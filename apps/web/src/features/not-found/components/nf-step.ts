import type { CSSProperties } from 'react'

// Posição do elemento na cascata de entrada da 404. O not-found.css
// multiplica por 70 ms; o 404 usa o mesmo índice nas duas animações dele.
export function nfStep(index: number): CSSProperties {
  return { '--nf-step': index } as CSSProperties
}
