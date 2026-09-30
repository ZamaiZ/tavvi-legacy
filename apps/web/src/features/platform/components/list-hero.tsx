import type { ReactNode } from 'react'
import Image from 'next/image'
import { LuPlus } from 'react-icons/lu'

export type ListStat = {
  label: string
  value: number
  icon: ReactNode
  onClick?: () => void
}

// Cabeçalho e linha de estatísticas das listas do console (Tavvi Web.dc.html):
// um cartão dourado e três cartões brancos numa linha só. No celular quem
// aparece é o topo próprio de cada tela (.tv-list-overview some).
export function ListHero({ title, description, hero, stats }: {
  title: string
  description: string
  hero: { label: string; chip?: string; value: number; detail: string; actions?: ReactNode; compact?: boolean }
  stats: ListStat[]
}) {
  return <div className="tv-list-overview">
    <header className="tv-page-head">
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
    <section className="tv-stats" aria-label="Resumo">
      <div className={`tv-hero-card${hero.compact ? ' is-compact' : ''}`}>
        <Image src="/brand/tavvi-brandmark-gold-on-light.png" width={170} height={170} alt="" aria-hidden="true" className="tv-hero-card-mark" />
        <div className="tv-hero-card-top">
          <span>{hero.label}</span>
          {hero.chip ? <span className="tv-hero-card-chip">{hero.chip}</span> : null}
        </div>
        <p className="tv-hero-card-value"><strong>{hero.value}</strong><span>{hero.detail}</span></p>
        {hero.actions ? <div className="tv-hero-card-actions">{hero.actions}</div> : null}
      </div>
      {stats.map((stat) => {
        const content = <><span className="tv-stat-label">{stat.icon}{stat.label}</span><strong>{stat.value}</strong></>
        return stat.onClick
          ? <button type="button" key={stat.label} className="tv-stat-card" onClick={stat.onClick}>{content}</button>
          : <div key={stat.label} className="tv-stat-card">{content}</div>
      })}
    </section>
  </div>
}

export function NewInviteButton({ onClick }: { onClick: () => void }) {
  return <button type="button" className="tv-hero-button is-light" onClick={onClick}><LuPlus aria-hidden="true" />Novo convite</button>
}
