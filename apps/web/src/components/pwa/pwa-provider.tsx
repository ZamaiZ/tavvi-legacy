'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { PWA_MANIFEST_PATH } from '@/lib/pwa'
import { detectPlatform, isStandalone, type Platform } from './platform'
import { PushProvider } from './push-provider'
import { INSTALL_PROMPT_EVENT, type BeforeInstallPromptEvent } from './types'

// prompt: o navegador entregou o convite de instalação (Chrome, Edge).
// ios: iPhone e iPad instalam pelo Compartilhar, e não por um diálogo.
// safari-mac: o Safari 17+ do macOS instala por Arquivo › Adicionar ao Dock.
export type InstallAvailability = 'prompt' | 'ios' | 'safari-mac' | 'unavailable'

export type PwaContextValue = {
  installAvailability: InstallAvailability
  isInstalled: boolean
  install: () => Promise<void>
}

const PwaContext = createContext<PwaContextValue | null>(null)

// Instalação e service worker. As notificações ficam no PushProvider, aqui
// dentro, que recebe a chave pública VAPID do layout.
export function PwaProvider({ vapidPublicKey, children }: { vapidPublicKey: string; children: React.ReactNode }) {
  // Tudo começa "indisponível" no servidor e no primeiro render do cliente,
  // para o HTML dos dois lados coincidir. O efeito lê o navegador.
  const [platform, setPlatform] = useState<Platform>('other')
  const [isInstalled, setIsInstalled] = useState(false)
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  // Dois toques rápidos chamariam prompt() duas vezes no mesmo convite.
  const installing = useRef(false)

  useEffect(() => {
    setPlatform(detectPlatform())
    setIsInstalled(isStandalone())
    setPrompt(window.__tvInstallPrompt ?? null)

    const standalone = window.matchMedia('(display-mode: standalone)')
    const onDisplayMode = () => setIsInstalled(isStandalone())
    const onPrompt = () => setPrompt(window.__tvInstallPrompt ?? null)
    const onInstalled = () => {
      setIsInstalled(true)
      setPrompt(null)
    }
    standalone.addEventListener('change', onDisplayMode)
    window.addEventListener(INSTALL_PROMPT_EVENT, onPrompt)
    window.addEventListener('appinstalled', onInstalled)

    // Depois do load, para não disputar banda com a primeira pintura. O
    // service worker trata navegações e push (ver public/sw.js). Falha no
    // registro não quebra nada: a página segue como site.
    function register() {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .catch(() => undefined)
    }
    const canRegister = 'serviceWorker' in navigator
    if (canRegister && document.readyState === 'complete') register()
    else if (canRegister) window.addEventListener('load', register, { once: true })

    return () => {
      standalone.removeEventListener('change', onDisplayMode)
      window.removeEventListener(INSTALL_PROMPT_EVENT, onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
      window.removeEventListener('load', register)
    }
  }, [])

  const value = useMemo<PwaContextValue>(() => {
    const installAvailability: InstallAvailability = isInstalled
      ? 'unavailable'
      : prompt
        ? 'prompt'
        : platform === 'ios' || platform === 'safari-mac'
          ? platform
          : 'unavailable'
    return {
      installAvailability,
      isInstalled,
      async install() {
        if (!prompt || installing.current) return
        installing.current = true
        try {
          await prompt.prompt()
          await prompt.userChoice
        } catch {
          // prompt() lança se o convite já foi usado. Resta descartá-lo.
        } finally {
          // O convite só pode ser usado uma vez, aceito ou não, e só sai
          // depois da escolha: a linha não some com o diálogo aberto. Se a
          // pessoa recusar, o Chrome entrega outro mais tarde e ela volta.
          installing.current = false
          if (window.__tvInstallPrompt === prompt) window.__tvInstallPrompt = undefined
          setPrompt((current) => (current === prompt ? null : current))
        }
      },
    }
  }, [isInstalled, platform, prompt])

  // O manifesto leva os cookies da página (use-credentials), como o Next já
  // faz sozinho nos previews da Vercel. Sem eles, um host que libera o acesso
  // por cookie, como o túnel gratuito do ngrok, devolve a página de aviso no
  // lugar do manifesto, e o Chrome recusa instalar. O React leva o <link>
  // para o <head>. Só painel e admin montam este provedor: a raiz segue sem
  // manifesto.
  return (
    <PwaContext.Provider value={value}>
      <link rel="manifest" href={PWA_MANIFEST_PATH} crossOrigin="use-credentials" />
      <PushProvider vapidPublicKey={vapidPublicKey} isInstalled={isInstalled}>
        {children}
      </PushProvider>
    </PwaContext.Provider>
  )
}

export function usePwa() {
  const value = useContext(PwaContext)
  if (!value) throw new Error('usePwa precisa estar dentro de PwaProvider')
  return value
}
