import Image from 'next/image'

// Topo da entrada do console abaixo de 1024 px, igual ao app: tela escura,
// lockup dourado, pílula do território e a promessa em duas linhas.
export function ConsoleLoginHero({ badge, title, subtitle }: { badge: string; title: string; subtitle: string }) {
  return (
    <section className="tv-console-login-hero lg:hidden">
      <Image src="/brand/tavvi-lockup-horizontal-gold-on-dark.png" alt="Tavvi" width={80} height={31} priority className="tv-console-login-lockup" />
      <span className="tv-console-login-pill"><span aria-hidden="true" />{badge}</span>
      <h1>{title}.</h1>
      <p>{subtitle}</p>
    </section>
  )
}
