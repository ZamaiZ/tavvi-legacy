'use client'

import { Children } from 'react'
import { useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'

// Entrada só na MONTAGEM. `initial`/`animate` sem `whileInView` e sem `layout`
// é deliberado: animar a cada renderização faria a lista inteira piscar toda
// vez que um preço mudasse ou um item fosse marcado como esgotado.
//
// A curva é a "expo out" — arranca rápido e freia longo. É o que faz o
// movimento parecer resposta do sistema, e não enfeite.
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const reduced = useReducedMotion()

  // Quem pediu menos movimento recebe o conteúdo direto, sem wrapper animado.
  // Não é uma animação de duração zero: é a ausência dela.
  if (reduced) return <div className={className}>{children}</div>

  return (
    <m.div
      className={className}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </m.div>
  )
}

// Cascata. O teto de 10 existe porque atraso crescente numa lista de oitenta
// itens faria o último aparecer quatro segundos depois do primeiro — o que
// deixa de ser elegância e vira lentidão. Do décimo em diante, todos entram
// juntos.
export function Stagger({
  children,
  step = 0.04,
  className,
}: {
  children: React.ReactNode
  step?: number
  className?: string
}) {
  return (
    <div className={className}>
      {Children.map(children, (child, index) => (
        <Reveal delay={Math.min(index, 10) * step}>{child}</Reveal>
      ))}
    </div>
  )
}
