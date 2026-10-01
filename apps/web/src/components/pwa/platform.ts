// Plataforma e modo de exibição, lidos do navegador. Compartilhados pelo
// PwaProvider (instalação) e pelo PushProvider (notificações).

export type Platform = 'ios' | 'safari-mac' | 'other'

// A ordem importa: o iPadOS se apresenta como Mac, e só o toque o denuncia.
// Testar o Safari do Mac antes mandaria o iPad procurar o Dock.
export function detectPlatform(): Platform {
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)) {
    return 'ios'
  }
  const safari = navigator.vendor === 'Apple Computer, Inc.' ? /Version\/(\d+)/.exec(ua) : null
  if (safari && Number(safari[1]) >= 17) return 'safari-mac'
  return 'other'
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}
