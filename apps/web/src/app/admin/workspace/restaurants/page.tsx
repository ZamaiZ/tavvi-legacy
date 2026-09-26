import Link from 'next/link'
import { redirect } from 'next/navigation'
import { RiStore2Line } from 'react-icons/ri'
import { StatusBadge } from '@/components/shell/restaurant-status-badge'
import { PanelEmptyState } from '@/features/workspace/components/panel-empty-state'
import { TavviShell } from '@/components/shell/tavvi-shell'
import { getPanelNavigation } from '@/components/shell/navigation'
import { PageHeader } from '@/components/shell/page-header'
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card'
import { publicMediaUrl } from '@/lib/media-url'
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

  return (
    <TavviShell
      config={{
        homeHref: '/restaurantes',
        userLabel: user?.email ?? null,
        contextLabel: 'Seus restaurantes',
        contextDescription: 'Escolha onde deseja trabalhar',
        items: getPanelNavigation(),
      }}
    >
      <main className="tavvi-page">
        <PageHeader
          eyebrow="Painel"
          title="Seus restaurantes"
          description="Selecione um estabelecimento para gerenciar o cardápio, a marca e a equipe."
        />

        {restaurants.length === 0 ? (
          <PanelEmptyState
            density="page"
            icon={<RiStore2Line />}
            title="Nenhum restaurante ainda"
            description="Peça um convite para quem administra a plataforma."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {restaurants.map((restaurant) => (
              // O cartão INTEIRO é o alvo, e não só o nome. `focus-within`
              // traz o anel para o cartão quando o link recebe foco, para
              // quem navega por teclado ver a mesma área que quem clica.
              <Card
                key={restaurant.id}
                className="relative gap-0 overflow-hidden rounded-[20px] border-border/70 p-0 shadow-[var(--shadow-1)] transition-[transform,box-shadow] focus-within:ring-2 focus-within:ring-ring/50 hover:-translate-y-0.5 hover:shadow-[var(--shadow-2)]"
              >
                <div className="relative h-32 w-full bg-gradient-to-br from-primary/10 via-surface-1 to-muted">
                  {restaurant.coverPath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={publicMediaUrl('image', restaurant.coverPath)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : null}

                  {restaurant.logoPath ? (
                    // `object-contain`: recortar um logo retangular em
                    // quadrado é sempre errado — foi o defeito que a Fase 4
                    // consertou no cardápio.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={publicMediaUrl('image', restaurant.logoPath)}
                      alt=""
                      className="absolute -bottom-7 left-5 size-14 rounded-2xl border-4 border-card bg-card object-contain p-1 shadow-sm"
                    />
                  ) : null}
                </div>

                <CardContent className="px-5 pb-5 pt-10">
                  <CardTitle>
                    <Link
                      href={`/restaurantes/${restaurant.id}`}
                      className="outline-none after:absolute after:inset-0 after:content-['']"
                    >
                      {restaurant.name}
                    </Link>
                  </CardTitle>
                  <CardDescription className="mt-1 truncate">
                    {env.NEXT_PUBLIC_ROOT_DOMAIN}/{restaurant.slug}
                  </CardDescription>
                  <div className="mt-3">
                    <StatusBadge status={restaurant.status} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </TavviShell>
  )
}
