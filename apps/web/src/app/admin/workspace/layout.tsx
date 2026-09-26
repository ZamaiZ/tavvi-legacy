import { PlatformAppearanceProvider } from '@/components/theme/platform-appearance-provider'
import { readPlatformAppearance } from '@/server/api/platform-appearance'

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const appearance = await readPlatformAppearance()
  // Este layout NÃO monta a casca, e é de propósito.
  //
  // Ele envolve `/entrar` e `/convite/{token}`, que não têm sessão e não
  // devem ter navegação; envolve `/` , que virou desvio na Fase 4; e envolve
  // as telas de restaurante, cuja navegação depende de um id que só o layout
  // de `restaurantes/[id]` conhece.
  //
  // Montar a casca aqui obrigaria ou a duplicar `SidebarProvider` — dois
  // provedores aninhados, um recolhendo o outro — ou a inventar um caminho
  // para o filho alimentar o pai. Cada contexto monta a própria casca.
  //
  // `workspace-territory` marca as superfícies privadas e aplica os tokens
  // Tavvi, incluindo Inter, sem interferir no cardápio público.
  return <PlatformAppearanceProvider initialAppearance={appearance} className="workspace-territory flex min-h-dvh flex-col">{children}</PlatformAppearanceProvider>
}
