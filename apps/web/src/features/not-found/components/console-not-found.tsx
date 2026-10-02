import Link from 'next/link'
import { nfStep } from './nf-step'
import { NotFoundBackButton } from './not-found-back-button'

// Uma 404 para cada território privado, mesma marcação. A classe de
// território vai no próprio <main> porque a 404 raiz renderiza fora dos
// layouts de admin. e painel., e é ela que traz fonte, fundo, tokens e a
// regra global de "reduzir movimento" (base.css).
const VARIANTS = {
  admin: {
    territoryClass: 'admin-territory',
    text: 'O endereço pode ter mudado ou não existe mais.',
    action: 'Ir para Convites',
    href: '/',
  },
  painel: {
    territoryClass: 'workspace-territory',
    text: 'O endereço pode estar errado, ou este restaurante não está mais na sua conta.',
    action: 'Ver meus restaurantes',
    href: '/restaurantes',
  },
} as const

export function ConsoleNotFound({ territory }: { territory: 'admin' | 'painel' }) {
  const variant = VARIANTS[territory]

  return (
    <main className={`${variant.territoryClass} tv-nf tv-nf--console`}>
      <div className="tv-nf-column">
        {/* Duas imagens, uma por tema; .tv-brandmark-light/-dark
            (console-shell.css) mostram a certa conforme o .dark. */}
        <span className="tv-nf-mark tv-nf-step" style={nfStep(0)} aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="tv-brandmark-light" src="/brand/tavvi-brandmark-gold-on-light.png" alt="" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="tv-brandmark-dark" src="/brand/tavvi-brandmark-gold-on-dark.png" alt="" />
        </span>
        <p className="tv-nf-code" style={nfStep(1)} aria-hidden="true">404</p>
        <h1 className="tv-nf-title tv-nf-step" style={nfStep(2)}>
          Página não encontrada<i>.</i>
        </h1>
        <p className="tv-nf-text tv-nf-step" style={nfStep(3)}>{variant.text}</p>
        <div className="tv-nf-actions tv-nf-step" style={nfStep(4)}>
          <Link href={variant.href} className="tv-nf-primary">{variant.action}</Link>
          <NotFoundBackButton fallbackHref={variant.href} className="tv-nf-secondary" />
        </div>
      </div>
    </main>
  )
}
