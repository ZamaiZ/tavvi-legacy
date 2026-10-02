import { Fraunces, Inter, Plus_Jakarta_Sans } from 'next/font/google'

// Fontes do domínio público. Ficam aqui, e não só no layout `(site)`, porque
// a 404 "restaurante" renderiza na raiz, fora desse layout, e precisa delas.
const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' })
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-display', axes: ['opsz'], display: 'swap' })
const tavvi = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-tavvi',
  display: 'swap',
})

export const SITE_FONT_VARIABLES = `${inter.variable} ${fraunces.variable} ${tavvi.variable}`
