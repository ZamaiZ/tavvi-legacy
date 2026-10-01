import Script from 'next/script'
import { INSTALL_PROMPT_EVENT } from './types'

// O Chrome dispara beforeinstallprompt uma vez por carregamento, às vezes
// antes de o React hidratar. Um listener no useEffect do PwaProvider
// chegaria tarde e o convite se perderia. Este script roda antes da
// hidratação, guarda o evento e avisa o provedor.
//
// preventDefault() tira o banner automático do Chrome no Android: instalar
// só acontece num toque na linha "Instalar app". O ícone de instalar da
// barra de endereço do desktop continua.
//
// Fica no layout raiz porque o Next só aceita beforeInteractive ali. No
// cardápio público ele é inerte: sem manifesto, o evento nunca dispara.
const script = `(function(){window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__tvInstallPrompt=e;window.dispatchEvent(new Event("${INSTALL_PROMPT_EVENT}"))});window.addEventListener("appinstalled",function(){window.__tvInstallPrompt=undefined})})()`

export function PwaInstallCapture() {
  // Conteúdo constante, sem entrada de usuário, como o do ThemeScript.
  return (
    <Script
      id="pwa-install-capture"
      strategy="beforeInteractive"
      dangerouslySetInnerHTML={{ __html: script }}
    />
  )
}
