import Image from 'next/image'
import { LuPlus } from 'react-icons/lu'

// Topo de Convites no celular: título grande e o cartão dourado compacto com
// o único "Novo" da tela. No desktop quem aparece é o ListHero.
export function InvitesMobileHeader({ pending, total, onCreate }: { pending: number; total: number; onCreate: () => void }) {
  return (
    <header className="tv-invites-m-head tv-m-only">
      <h1 className="tv-m-title">Convites</h1>
      <section className="tv-m-hero" aria-label={`Aguardando resgate: ${pending} de ${total} convites`}>
        <Image src="/brand/tavvi-brandmark-gold-on-light.png" width={130} height={130} alt="" aria-hidden="true" className="tv-m-hero-mark" />
        <div className="tv-m-hero-copy">
          <span>Aguardando resgate</span>
          <p><strong>{pending}</strong><span>de {total} {total === 1 ? 'convite' : 'convites'}</span></p>
        </div>
        <button type="button" className="tv-m-hero-action" onClick={onCreate}><LuPlus aria-hidden="true" />Novo</button>
      </section>
    </header>
  )
}
