import type { Metadata } from 'next'
import { PwaProvider } from '@/components/pwa/pwa-provider'
import { pwaMetadata } from '@/lib/pwa'
import { env } from '@/server/env'

// Instalável como "Tavvi Painel": meta tags do iOS aqui, manifesto pelo
// PwaProvider. Vale em todas as telas do painel, login e convite incluídos.
export const metadata: Metadata = pwaMetadata('painel')

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Este layout NÃO monta a casca, e é de propósito.
  //
  // Ele envolve `/convite/{token}`, que não tem sessão e não deve ter
  // navegação; envolve `/` , que virou desvio na Fase 4; e envolve
  // as telas de restaurante, cuja navegação depende de um id que só o layout
  // de `restaurantes/[id]` conhece.
  //
  // Montar a casca aqui obrigaria ou a duplicar `SidebarProvider` — dois
  // provedores aninhados, um recolhendo o outro — ou a inventar um caminho
  // para o filho alimentar o pai. Cada contexto monta a própria casca.
  //
  // `workspace-territory` marca as superfícies privadas e aplica os tokens
  // Tavvi, sem interferir no cardápio público.
  return (
    <div className="workspace-territory flex min-h-dvh flex-col">
      <PwaProvider vapidPublicKey={env.NEXT_PUBLIC_VAPID_PUBLIC_KEY}>{children}</PwaProvider>
    </div>
  )
}
