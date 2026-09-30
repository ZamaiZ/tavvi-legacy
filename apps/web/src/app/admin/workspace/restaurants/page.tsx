import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { LuStore } from 'react-icons/lu'
import { PanelEmptyState } from '@/features/workspace/components/panel-empty-state'
import { RestaurantPickerCard } from '@/features/workspace/components/restaurant-picker-card'
import { TavviShell } from '@/components/shell/tavvi-shell'
import { getPanelNavigation } from '@/components/shell/navigation'
import { PageHeader } from '@/components/shell/page-header'
import { getCurrentUser, requireUser } from '@/server/dal/auth'
import { listMyRestaurants } from '@/server/dal/restaurant-read'
import { env } from '@/server/env'

export const metadata = { title: 'Seus restaurantes' }

// Keep the restaurant picker outside the workspace layout so it does not nest
// a second sidebar provider.
export default async function Page() {
  await requireUser()
  const [user, restaurants] = await Promise.all([
    getCurrentUser(),
    listMyRestaurants(),
  ])

  // Uma tela de escolha com um item só é um clique que não escolhe nada.
  // O desvio acontece no servidor, antes de renderizar, então a lista nem
  // chega a piscar.
  if (restaurants.length === 1) {
    redirect(`/restaurantes/${restaurants[0].id}`)
  }
  const cookieStore = await cookies()
  const initialRail = cookieStore.get('tv_rail')?.value === 'pinned' ? 'pinned' : 'collapsed'

  return (
    <TavviShell
      initialRail={initialRail}
      sidebar={{
        brand: { kind: 'tavvi' },
        title: 'Seus restaurantes',
        subtitle: 'Painel',
        section: 'Gerenciar',
        accountDescription: 'Painel',
      }}
      itemCounts={{ '/restaurantes': restaurants.length }}
      config={{
        homeHref: '/restaurantes',
        userLabel: user?.email ?? null,
        contextLabel: 'Seus restaurantes',
        contextDescription: 'Painel',
        items: getPanelNavigation(),
      }}
    >
      <main className="tv-picker-page">
        <PageHeader
          eyebrow="Painel"
          title="Seus restaurantes"
          description="Selecione um estabelecimento para gerenciar o cardápio, a marca e a equipe."
        />
        {restaurants.length === 0 ? (
          <PanelEmptyState
            density="page"
            icon={<LuStore />}
            title="Nenhum restaurante ainda"
            description="Peça um convite para quem administra a plataforma."
          />
        ) : (
          <div className="tv-picker-grid">
            {restaurants.map((restaurant) => (
              <RestaurantPickerCard key={restaurant.id} restaurant={restaurant} domain={env.NEXT_PUBLIC_ROOT_DOMAIN} />
            ))}
          </div>
        )}
      </main>
    </TavviShell>
  )
}
