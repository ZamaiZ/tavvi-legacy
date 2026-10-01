import type { Metadata, MetadataRoute } from 'next'
import type { PrivateTerritory } from '@/lib/route-paths'

// PWA do painel (painel.) e do console (admin.). Cada subdomínio é uma
// origem, então cada um instala como um app próprio, com o próprio
// manifesto. O cardápio público (raiz) não tem manifesto de propósito:
// quem lê o QR code da mesa nunca deve ver "instalar".

// Caminho com ponto: o matcher do proxy não o alcança, então a rota chega
// sem reescrita de território e sem redirecionar para /entrar. Isso importa
// porque o manifesto precisa chegar também a quem ainda não entrou.
// O <link> sai do PwaProvider, e não do pwaMetadata (ver lá).
export const PWA_MANIFEST_PATH = '/pwa/manifest.webmanifest'

// Fundo do login e do ícone: é a cor da tela de abertura e da barra até a
// página carregar. Dentro do app, o ConsoleShell sincroniza o theme-color
// com o tema escolhido.
const PWA_BACKGROUND = '#0D0C0A'

const PWA_APPS: Record<PrivateTerritory, { name: string; description: string }> = {
  painel: { name: 'Tavvi Painel', description: 'Cardápio, serviço e equipe do seu restaurante.' },
  admin: { name: 'Tavvi Console', description: 'Administração da plataforma Tavvi.' },
}

export function pwaAppName(territory: PrivateTerritory): string {
  return PWA_APPS[territory].name
}

// Telas de abertura do iOS: [largura, altura, densidade], em pontos, no
// retrato. Sem elas, o app instalado abre numa tela branca antes do login
// escuro. Cada linha vira duas imagens (retrato e paisagem) em
// public/pwa/splash/splash-{largura}x{altura}.png, em pixels.
// Aparelho novo? Acrescente a linha e gere as duas imagens (spec §7).
const APPLE_SPLASH_DEVICES: ReadonlyArray<readonly [number, number, number]> = [
  [440, 956, 3], // iPhone 16 Pro Max, 17 Pro Max
  [420, 912, 3], // iPhone Air
  [402, 874, 3], // iPhone 16 Pro, 17, 17 Pro
  [430, 932, 3], // iPhone 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus
  [393, 852, 3], // iPhone 14 Pro, 15, 15 Pro, 16
  [428, 926, 3], // iPhone 12 Pro Max, 13 Pro Max, 14 Plus
  [390, 844, 3], // iPhone 12, 12 Pro, 13, 13 Pro, 14, 16e
  [375, 812, 3], // iPhone X, XS, 11 Pro, 12 mini, 13 mini
  [414, 896, 3], // iPhone XS Max, 11 Pro Max
  [414, 896, 2], // iPhone XR, 11
  [414, 736, 3], // iPhone 6s Plus, 7 Plus, 8 Plus
  [375, 667, 2], // iPhone 6s, 7, 8, SE (2ª e 3ª)
  [320, 568, 2], // iPhone SE (1ª)
  [1032, 1376, 2], // iPad Pro 13" (M4), iPad Air 13"
  [1024, 1366, 2], // iPad Pro 12,9"
  [834, 1210, 2], // iPad Pro 11" (M4)
  [834, 1194, 2], // iPad Pro 11"
  [820, 1180, 2], // iPad Air 10,9" e 11", iPad (10ª e 11ª)
  [834, 1112, 2], // iPad Air (3ª), iPad Pro 10,5"
  [810, 1080, 2], // iPad (7ª a 9ª)
  [768, 1024, 2], // iPad mini (5ª), iPad 9,7"
  [744, 1133, 2], // iPad mini (6ª e 7ª)
]

function appleStartupImages(): { url: string; media: string }[] {
  return APPLE_SPLASH_DEVICES.flatMap(([width, height, ratio]) =>
    (['portrait', 'landscape'] as const).map((orientation) => {
      const [w, h] = orientation === 'portrait' ? [width * ratio, height * ratio] : [height * ratio, width * ratio]
      return {
        url: `/pwa/splash/splash-${w}x${h}.png`,
        media: `(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: ${orientation})`,
      }
    }),
  )
}

export function pwaManifest(territory: PrivateTerritory): MetadataRoute.Manifest {
  const { name, description } = PWA_APPS[territory]
  return {
    id: '/',
    name,
    short_name: name,
    description,
    lang: 'pt-BR',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    // Abrir o app (ícone, link, aviso) com ele já aberto reaproveita a janela.
    launch_handler: { client_mode: ['navigate-existing', 'auto'] },
    background_color: PWA_BACKGROUND,
    theme_color: PWA_BACKGROUND,
    icons: [
      { src: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Mesma arte do comum: a marca cabe na zona segura de 40 %.
      { src: '/pwa/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}

// No iOS, 'default' deixa a página abaixo da barra de status.
// 'black-translucent' poria ícones brancos sobre o tema claro.
//
// O Next só escreve mobile-web-app-capable; o iOS lê as telas de abertura
// de quem declara também apple-mobile-web-app-capable.
//
// Sem `manifest` aqui: o PwaProvider escreve o <link> com
// crossOrigin="use-credentials", que o metadata não oferece.
export function pwaMetadata(territory: PrivateTerritory): Metadata {
  return {
    appleWebApp: {
      capable: true,
      title: PWA_APPS[territory].name,
      statusBarStyle: 'default',
      startupImage: appleStartupImages(),
    },
    other: { 'apple-mobile-web-app-capable': 'yes' },
  }
}
