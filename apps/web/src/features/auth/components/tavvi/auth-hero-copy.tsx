import Image from 'next/image'
import { Reveal } from '@/components/motion/reveal'

export function AuthHeroCopy({
  badge,
  title,
  subtitle,
  desktop = false,
  variant = 'admin',
}: {
  badge: string
  title: string
  subtitle: string
  desktop?: boolean
  variant?: 'admin' | 'painel'
}) {
  return (
    <div className={desktop
      ? 'relative z-10 flex h-full min-w-0 flex-col justify-between pb-1 pr-2 pt-0'
      : 'relative z-10 flex h-full flex-col justify-between p-[22px]'}
    >
      <Reveal delay={0} className="flex flex-col items-start gap-4">
        <Image
          src="/brand/tavvi-lockup-horizontal.png"
          alt="Tavvi"
          width={102}
          height={40}
          sizes={desktop ? '102px' : '78px'}
          priority
          className={desktop ? 'h-10 w-[102px] object-contain' : 'h-[31px] w-[78px] object-contain'}
        />
        <div className={desktop
          ? 'inline-flex min-h-[30px] max-w-full items-center gap-2 rounded-tv-badge bg-tv-lime-soft px-3 py-1 text-tv-lime'
          : 'inline-flex min-h-[26px] max-w-full items-center gap-2 rounded-tv-badge-mobile bg-tv-lime-soft px-[10px] py-1 text-tv-lime'}
        >
          <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-tv-lime shadow-[0_0_0_3px_var(--tv-lime-soft)]" />
          <span className={desktop ? 'text-xs leading-4 font-semibold' : 'text-[11px] leading-4 font-semibold'}>{badge}</span>
        </div>
      </Reveal>

      <div className={desktop ? 'flex max-w-[520px] flex-col gap-4 pb-1' : 'flex max-w-[210px] flex-col gap-[10px]'}>
        <Reveal delay={0.06}>
          <h1 className={desktop
            ? 'tv-hero-title text-tv-on-dark'
            : 'text-[31px] leading-8 font-extrabold tracking-[-1.1px] text-tv-on-dark'}
          >
            {title}<span className="text-tv-lime">.</span>
          </h1>
        </Reveal>
        <Reveal delay={0.12}>
          <p className={desktop
            ? 'max-w-[420px] text-lg leading-[27px] font-medium text-tv-muted-on-dark'
            : 'text-[13px] leading-[18px] font-medium text-tv-muted-on-dark'}
          >
            {subtitle}
          </p>
        </Reveal>
        {desktop && variant === 'admin' ? <BrandFooter /> : null}
        {desktop && variant === 'painel' ? (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Áreas do painel">
            {['Cardápio', 'Identidade', 'Equipe', 'Contato'].map((area) => (
              <li key={area} className="flex min-h-[30px] items-center rounded-tv-chip bg-[var(--tv-on-dark-chip)] px-3 text-xs leading-4 font-semibold text-tv-muted-on-dark">
                {area}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}

export function BrandFooter() {
  return (
    <div className="mt-3 flex items-center gap-2">
      <Image
        src="/brand/tavvi-wordmark.png"
        alt=""
        aria-hidden="true"
        width={44}
        height={16}
        className="h-4 w-11 object-contain opacity-50 brightness-0 dark:brightness-100"
      />
      <span aria-hidden="true" className="size-[3px] rounded-full bg-tv-border" />
      <span className="text-xs leading-4 font-medium text-tv-subtle-on-dark">{new Date().getFullYear()}</span>
    </div>
  )
}
