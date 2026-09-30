import type { ReactNode } from 'react'
import { LuRotateCcw } from 'react-icons/lu'

export function StateCard({ title, description, action, icon }: {
  title: string
  description: string
  action?: ReactNode
  icon: ReactNode
}) {
  return <section className="tv-state-card"><span className="tv-state-icon">{icon}</span><h2>{title}</h2><p>{description}</p>{action}</section>
}

export function RetryButton({ onClick }: { onClick: () => void }) {
  return <button type="button" className="tv-secondary-cta" onClick={onClick}><LuRotateCcw aria-hidden="true" />Tentar novamente</button>
}
