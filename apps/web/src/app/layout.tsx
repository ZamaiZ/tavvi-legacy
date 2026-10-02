import type { Metadata } from 'next'
import './globals.css'
import '../features/workspace/styles/plaquinhas.css'
import '../features/calls/styles/calls.css'
import '../features/account/styles/account.css'
import '../features/feedback/styles/feedback.css'
import '../features/not-found/styles/not-found.css'
import { ThemeProvider } from '@/components/theme/theme-provider'
import { ThemeScript } from '@/components/theme/theme-script'
import { PwaInstallCapture } from '@/components/pwa/pwa-install-capture'
import { Toaster } from '@/components/ui/toast'
import { TooltipProvider } from '@/components/ui/tooltip'
import { MotionProvider } from '@/components/providers/motion-provider'

export const metadata: Metadata = {
  title: {
    default: 'Tavvi',
    template: '%s · Tavvi',
  },
  description: 'Cardápios de restaurante acessíveis por NFC e QR code.',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="pt-BR"
      // O tema e aplicado por um script antes da hidratacao, o que faz o
      // HTML do servidor divergir do primeiro render do cliente. Sem isto,
      // o React reclama de uma divergencia que e intencional.
      suppressHydrationWarning
      className="h-full antialiased font-sans"
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeScript />
        <PwaInstallCapture />
        <ThemeProvider>
          <MotionProvider>
            <TooltipProvider>
              {children}
              <Toaster />
            </TooltipProvider>
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
