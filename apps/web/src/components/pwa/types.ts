// Contrato do convite de instalação do Chrome e do Edge. O evento ainda
// não está nos tipos do DOM do TypeScript.
export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

// Disparado pelo PwaInstallCapture quando guarda um convite novo, para o
// PwaProvider que já estiver montado ler `window.__tvInstallPrompt`.
export const INSTALL_PROMPT_EVENT = 'tv-installprompt'

declare global {
  interface Window {
    // Guardado antes da hidratação pelo PwaInstallCapture.
    __tvInstallPrompt?: BeforeInstallPromptEvent
  }
}
