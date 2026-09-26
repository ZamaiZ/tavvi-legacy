import { cn } from 'cn'
import type { RestaurantStatus } from '@/domain/restaurant'

const STYLES: Record<RestaurantStatus, { label: string; className: string }> = {
  draft: {
    label: 'Rascunho',
    className: 'bg-status-draft-bg text-status-draft',
  },
  active: {
    label: 'Ativo',
    className: 'bg-status-active-bg text-status-active',
  },
  suspended: {
    label: 'Suspenso',
    className: 'bg-status-suspended-bg text-status-suspended',
  },
}

export function StatusBadge({ status }: { status: RestaurantStatus }) {
  const { label, className } = STYLES[status]

  // A cor nunca carrega o significado sozinha: o texto sempre vai junto.
  // Quem não distingue as cores lê a palavra, e a interface continua
  // legível numa captura de tela em preto e branco.
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2.5 py-1 text-sm font-medium',
        className,
      )}
    >
      {label}
    </span>
  )
}
