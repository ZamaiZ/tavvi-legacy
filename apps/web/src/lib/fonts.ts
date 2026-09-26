import {
  Anton,
  Bitter,
  Cormorant_Garamond,
  Fraunces,
  Inter,
  Outfit,
  Quicksand,
  Space_Grotesk,
  Zen_Kaku_Gothic_New,
} from 'next/font/google'

// `preload: false` em TODAS as fontes de tema, e o motivo é concreto: o
// next/font declara as nove no grafo da rota do cardápio, e com preload ligado
// o navegador baixaria as nove em todo cardápio para usar uma. Sem preload,
// só o @font-face que o CSS renderizado de fato casar é buscado — navegador
// não baixa fonte que nenhum texto usa.
//
// O que sobra são alguns quilobytes de CSS de @font-face não usado. Preço
// barato por não mandar megabytes de fonte para um celular numa mesa de
// restaurante, quase sempre em rede ruim.
// As opções vão LITERAIS em cada chamada, sem spread e sem constante
// compartilhada. Não é preferência de estilo: o carregador de fontes do Next
// analisa a chamada em tempo de build e recusa qualquer coisa que não seja um
// objeto literal, com a mensagem "Unexpected spread". O `tsc` não pega isso —
// só o build pega. Repetir `preload: false` nove vezes é o preço.

export const antonFont = Anton({
  subsets: ['latin'],
  weight: '400',
  variable: '--tf-anton',
  preload: false,
  display: 'swap',
})
export const bitterFont = Bitter({
  subsets: ['latin'],
  variable: '--tf-bitter',
  preload: false,
  display: 'swap',
})
export const cormorantFont = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--tf-cormorant',
  preload: false,
  display: 'swap',
})
export const frauncesFont = Fraunces({
  subsets: ['latin'],
  axes: ['opsz'],
  variable: '--tf-fraunces',
  preload: false,
  display: 'swap',
})
export const interFont = Inter({
  subsets: ['latin'],
  variable: '--tf-inter',
  preload: false,
  display: 'swap',
})
export const outfitFont = Outfit({
  subsets: ['latin'],
  variable: '--tf-outfit',
  preload: false,
  display: 'swap',
})
export const quicksandFont = Quicksand({
  subsets: ['latin'],
  variable: '--tf-quicksand',
  preload: false,
  display: 'swap',
})
export const spaceGroteskFont = Space_Grotesk({
  subsets: ['latin'],
  variable: '--tf-space',
  preload: false,
  display: 'swap',
})
export const zenKakuFont = Zen_Kaku_Gothic_New({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--tf-zen',
  preload: false,
  display: 'swap',
})

// Todas juntas, para a rota do cardápio aplicar de uma vez num elemento só.
// Só a que o tema ativo referenciar em `--m-font-display` ou `--m-font-text`
// desce de fato para o aparelho.
export const ALL_THEME_FONT_VARIABLES = [
  antonFont.variable,
  bitterFont.variable,
  cormorantFont.variable,
  frauncesFont.variable,
  interFont.variable,
  outfitFont.variable,
  quicksandFont.variable,
  spaceGroteskFont.variable,
  zenKakuFont.variable,
].join(' ')
