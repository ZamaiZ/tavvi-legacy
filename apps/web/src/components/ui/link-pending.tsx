'use client'

import { useLinkStatus } from 'next/link'
import { cn } from 'cn'
import { SpinnerRing } from './spinner'

// Retorno do toque num link enquanto a rota carrega. Tamanho fixo e sempre
// presente (só a opacidade muda), como a doc do Next recomenda: nada pula de
// lugar. `forced` cobre a mesma navegação disparada por menu (router.push).
// Precisa estar DENTRO de um <Link>.
export function LinkPendingHint({ className, forced = false }: { className?: string; forced?: boolean }) {
  const { pending } = useLinkStatus()
  return (
    <span className={cn('tv-link-pending', className)} data-active={pending || forced || undefined} aria-hidden="true">
      <SpinnerRing decorative />
    </span>
  )
}
