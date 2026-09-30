import type { ReactNode } from 'react'
import Image from 'next/image'
import { LuPlus } from 'react-icons/lu'

type HeroStat = {
  label: string
  value: number
  icon: ReactNode
  selected?: boolean
  onClick?: () => void
}

export function ListHero({ title, description, mobileDescription, heroLabel, heroValue, heroDetail, heroActions, stats = [] }: {
  title: string
  description: string
  mobileDescription?: string
  heroLabel: string
  heroValue: number
  heroDetail: string
  heroActions?: ReactNode
  stats?: HeroStat[]
}) {
  return <div className="tv-list-overview">
    <header className="tv-list-heading">
      <div><span className="tv-list-eyebrow">Console</span><h1>{title}</h1><p className="tv-list-description">{description}</p><p className="tv-list-description-mobile">{mobileDescription ?? description}</p></div>
    </header>
    <div className="tv-list-summary-grid">
      <section className="tv-list-hero" aria-label={`${heroLabel}: ${heroValue}`}>
        <Image src="/brand/tavvi-brandmark-gold-on-light.png" width={340} height={340} alt="" aria-hidden="true" className="tv-hero-watermark tv-brandmark-light" />
        <Image src="/brand/tavvi-brandmark-gold-on-dark.png" width={340} height={340} alt="" aria-hidden="true" className="tv-hero-watermark tv-brandmark-dark" />
        <div className="tv-summary-copy"><span>{heroLabel}</span><strong>{heroValue}</strong><p>{heroDetail}</p></div>
        {heroActions ? <div className="tv-summary-actions">{heroActions}</div> : null}
      </section>
      {stats.length > 0 ? <div className="tv-stat-grid">{stats.map((stat) => {
        const content = <><span className="tv-stat-label">{stat.icon}{stat.label}</span><strong>{stat.value}</strong></>
        return stat.onClick ? <button type="button" key={stat.label} className={`tv-stat-card${stat.selected ? ' is-selected' : ''}`} aria-pressed={stat.selected} onClick={stat.onClick}>{content}</button> : <div key={stat.label} className="tv-stat-card">{content}</div>
      })}</div> : null}
    </div>
  </div>
}

export function NewInviteButton({ onClick }: { onClick: () => void }) {
  return <button type="button" className="tv-new-invite" onClick={onClick}><span>Novo convite</span><i><LuPlus aria-hidden="true" /></i></button>
}
