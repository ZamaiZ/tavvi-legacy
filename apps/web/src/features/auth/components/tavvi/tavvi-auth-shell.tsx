import { Reveal } from '@/components/motion/reveal'
import { AuthHeroCopy, BrandFooter } from './auth-hero-copy'
import { HeroThemeToggle } from './hero-theme-toggle'

export type TavviAuthShellProps = {
  variant?: 'admin' | 'painel'
  badge: string
  title: string
  subtitle: string
  children: React.ReactNode
}

// Login do painel. O console tem o próprio shell (ConsoleSignInShell).
export function TavviAuthShell({ variant = 'painel', badge, title, subtitle, children }: TavviAuthShellProps) {
  return (
    <main className="tv-auth-scope tv-auth-main relative flex min-h-dvh flex-col overflow-x-hidden bg-tv-screen text-tv-text transition-colors duration-150 lg:h-dvh lg:min-h-[640px] lg:p-4">
      <div className="tv-auth-layout relative mx-auto flex w-full max-w-[488px] flex-1 flex-col gap-4 px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(24px,calc(env(safe-area-inset-top)+12px))] lg:mx-0 lg:grid lg:h-full lg:min-h-[608px] lg:max-w-none lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)] lg:gap-12 lg:px-12 lg:py-11 xl:pr-20">
        <section className="tv-auth-mobile-hero relative h-[264px] shrink-0 lg:hidden">
          <AuthHeroCopy badge={badge} title={title} subtitle={subtitle} variant={variant} />
        </section>

        <div aria-hidden="true" className="tv-auth-desktop-hero pointer-events-none absolute inset-y-0 left-0 hidden lg:block" />

        <section className="relative hidden min-h-0 flex-col justify-between lg:flex">
          <AuthHeroCopy badge={badge} title={title} subtitle={subtitle} desktop variant={variant} />
        </section>

        <Reveal delay={0.16} className="relative z-10 flex w-full flex-col lg:self-center">
          {children}
        </Reveal>

        <div aria-hidden="true" className="tv-auth-spacer min-h-5 flex-1 lg:hidden" />
        <footer className="tv-auth-footer relative z-10 flex min-h-11 items-center justify-center gap-2 lg:hidden">
          <BrandFooter />
        </footer>

        <HeroThemeToggle />
      </div>
    </main>
  )
}
