import Image from 'next/image'

// Entrada do console (Tavvi Web.dc.html, tela Login). No desktop, coluna
// escura à esquerda e formulário à direita; abaixo de 1024 px, a tela escura
// do app. O painel continua no TavviAuthShell.
export function ConsoleSignInShell({ children }: { children: React.ReactNode }) {
  const brandFoot = (
    <>
      <Image src="/brand/tavvi-wordmark-gold-on-dark.png" alt="" aria-hidden="true" width={40} height={15} className="tv-cl-wordmark" />
      <span aria-hidden="true" className="tv-cl-dot" />
      <span>{new Date().getFullYear()}</span>
    </>
  )

  return (
    <main className="tv-auth-scope tv-cl">
      <section className="tv-cl-aside">
        <Image src="/brand/tavvi-lockup-horizontal-gold-on-dark.png" alt="Tavvi" width={92} height={36} priority className="tv-cl-lockup" />
        <div className="tv-cl-pitch">
          <span className="tv-cl-pill"><span aria-hidden="true" />Console</span>
          <h1>Administre a plataforma.</h1>
          <p className="tv-cl-lead is-desktop">Convites, restaurantes e publicação em um só lugar.</p>
          <p className="tv-cl-lead is-mobile">Convites e restaurantes, de onde você estiver.</p>
        </div>
        <div className="tv-cl-foot is-desktop">{brandFoot}</div>
      </section>
      <section className="tv-cl-panel">{children}</section>
      <footer className="tv-cl-foot is-mobile">{brandFoot}</footer>
    </main>
  )
}
