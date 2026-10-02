import Link from 'next/link'
import { SITE_FONT_VARIABLES } from '@/lib/site-fonts'
import { defaultProtocol, originFor } from '@/server/territory'
import { nfStep } from './nf-step'
import { NotFoundBackButton } from './not-found-back-button'

// Restaurante inexistente, em rascunho, suspenso ou removido, e plaquinha
// desconhecida, caem todos aqui, com o mesmo texto, para não revelar que o
// restaurante existe. Mesma linguagem da página raiz do domínio público.
export function MenuRestaurantNotFound() {
  return (
    <main className={`site-public tv-nf tv-nf--site ${SITE_FONT_VARIABLES}`}>
      <div aria-hidden="true" className="tv-nf-glow" />
      <div className="tv-nf-column">
        <p className="tv-nf-eyebrow tv-nf-step" style={nfStep(0)}>Cardápio digital</p>
        <p className="tv-nf-code" style={nfStep(1)} aria-hidden="true">404</p>
        <h1 className="tv-nf-title tv-nf-step" style={nfStep(2)}>Cardápio não encontrado</h1>
        <p className="tv-nf-text tv-nf-step" style={nfStep(3)}>
          Este endereço não leva a nenhum restaurante. Confira o link ou aproxime o celular da plaquinha da mesa de novo.
        </p>
        <div className="tv-nf-actions tv-nf-step" style={nfStep(4)}>
          <Link href="/" className="tv-nf-primary">Ir para o início</Link>
          <NotFoundBackButton fallbackHref="/" className="tv-nf-secondary" />
        </div>
        {/* Quem mais chega aqui sabendo o endereço é o próprio dono, com o
            restaurante ainda em rascunho. `originFor` é a mesma função do
            link da página raiz e do convite. */}
        <p className="tv-nf-footnote tv-nf-step" style={nfStep(5)}>
          É dono de restaurante?{' '}
          <Link href={originFor('painel', defaultProtocol())}>Entre no painel</Link>.
        </p>
      </div>
    </main>
  )
}
