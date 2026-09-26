import type { Metadata } from 'next'
import { Fraunces, Inter, JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import { cn } from 'cn'
import { ThemeProvider } from '@/components/theme/theme-provider'
import { ThemeScript } from '@/components/theme/theme-script'
import { Toaster } from '@/components/ui/toast'
import { TooltipProvider } from '@/components/ui/tooltip'
import { MotionProvider } from '@/components/providers/motion-provider'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const tavvi = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-tavvi',
  display: 'swap',
})
const tavviMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500'],
  variable: '--font-tavvi-mono',
  display: 'swap',
})

// Fraunces é variável e tem eixo de tamanho óptico. `opsz` alto engrossa a
// serifa e fecha as contraformas, que é o que dá presença a um título grande
// sem precisar recorrer a peso 700.
//
// Ela permanece apenas na pequena página pública institucional. O painel,
// autenticação do painel e onboarding usam Inter; o admin aplica Jakarta e
// o cardápio público aplica as fontes escolhidas pelo restaurante.
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  axes: ['opsz'],
})

export const metadata: Metadata = {
  title: {
    default: 'Tavvi',
    template: '%s · Tavvi',
  },
  description: 'Cardápios de restaurante acessíveis por NFC e QR code.',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="pt-BR"
      // O tema e aplicado por um script antes da hidratacao, o que faz o
      // HTML do servidor divergir do primeiro render do cliente. Sem isto,
      // o React reclama de uma divergencia que e intencional.
      suppressHydrationWarning
      className={cn(
        'h-full antialiased font-sans',
        inter.variable,
        tavvi.variable,
        tavviMono.variable,
        fraunces.variable,
      )}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeScript />
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
