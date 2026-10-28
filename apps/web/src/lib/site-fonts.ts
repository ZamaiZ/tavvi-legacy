import { Fraunces, Plus_Jakarta_Sans } from 'next/font/google'

// Fontes específicas do domínio público. A Inter vem do layout raiz; estas
// duas ficam aqui porque a 404 "restaurante" renderiza fora do layout `(site)`.
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-display', axes: ['opsz'], display: 'swap' })
const tavvi = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-tavvi',
  display: 'swap',
})

export const SITE_FONT_VARIABLES = `${fraunces.variable} ${tavvi.variable}`
