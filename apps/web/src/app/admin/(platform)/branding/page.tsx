import { AppearanceEditor } from '@/features/platform/components/appearance-editor'
import { ListHero } from '@/features/platform/components/list-hero'
import { readPlatformAppearance } from '@/server/api/platform-appearance'
import { requirePlatformAdminPage } from '@/server/dal/auth'

export const metadata = { title: 'Identidade visual' }

export default async function BrandingPage() {
  await requirePlatformAdminPage()
  const appearance = await readPlatformAppearance()
  return <main className="tv-platform-page">
    <ListHero title="Sua identidade, em todos os painéis" description="Defina o acento visual do Tavvi para web e mobile. Os tons derivados acompanham essa escolha." summary="IDENTIDADE DA PLATAFORMA" />
    <section className="tv-page-section tv-branding-page">
      <AppearanceEditor initialAppearance={appearance} />
    </section>
  </main>
}
