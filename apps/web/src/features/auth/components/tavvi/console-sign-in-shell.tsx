import Image from 'next/image'

type Territory = 'console' | 'painel'

const COPY: Record<Territory, { pill: string; title: string; lead: string; leadMobile: string; areas: string[] }> = {
  console: {
    pill: 'Console',
    title: 'Administre a plataforma.',
    lead: 'Convites, restaurantes e publicação em um só lugar.',
    leadMobile: 'Convites e restaurantes, de onde você estiver.',
    areas: [],
  },
  painel: {
    pill: 'Painel',
    title: 'Seu restaurante, em ordem.',
    lead: 'Cardápio, identidade, equipe e contato — tudo o que o cliente vê na mesa.',
    leadMobile: 'Cardápio, identidade, equipe e contato — tudo o que o cliente vê na mesa.',
    areas: ['Cardápio', 'Identidade', 'Equipe', 'Contato'],
  },
}

// Entrada do console e do painel (Tavvi Web.dc.html, tela Login). No desktop,
// coluna escura à esquerda e formulário à direita; abaixo de 1024 px, a tela
// escura do app. Cada subdomínio tem o seu; não há seletor entre os dois.
export function ConsoleSignInShell({ territory = 'console', children }: { territory?: Territory; children: React.ReactNode }) {
  const copy = COPY[territory]
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
          <span className="tv-cl-pill"><span aria-hidden="true" />{copy.pill}</span>
          <h1>{copy.title}</h1>
          <p className="tv-cl-lead is-desktop">{copy.lead}</p>
          <p className="tv-cl-lead is-mobile">{copy.leadMobile}</p>
          {copy.areas.length > 0 ? (
            <ul className="tv-cl-areas" aria-label="Áreas do painel">
              {copy.areas.map((area) => <li key={area}>{area}</li>)}
            </ul>
          ) : null}
        </div>
        <div className="tv-cl-foot is-desktop">{brandFoot}</div>
      </section>
      <section className="tv-cl-panel">{children}</section>
      <footer className="tv-cl-foot is-mobile">{brandFoot}</footer>
    </main>
  )
}
