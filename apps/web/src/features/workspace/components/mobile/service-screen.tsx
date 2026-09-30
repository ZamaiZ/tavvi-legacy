'use client'

import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/shell/page-header'
import type { OwnerMenuCategoryDTO } from '@/domain/menu'
import { ServiceMode } from '@/features/menu-editor/components/work-modes/service-mode'

// Serviço (Tavvi Mobile.dc.html, bService): a disponibilidade dos itens
// visíveis, um toque por item. No celular é aba própria. No desktop a rota
// também abre, com o cabeçalho do painel, e o modo "Trabalhar › Serviço"
// continua dentro do Cardápio.
export function ServiceScreen({
  restaurantId,
  categories,
  canEdit,
}: {
  restaurantId: string
  categories: OwnerMenuCategoryDTO[]
  canEdit: boolean
}) {
  const router = useRouter()
  const menuHref = `/restaurantes/${restaurantId}`
  return (
    <div className="tv-mp tv-service-page">
      <div className="tv-d-only">
        <PageHeader eyebrow="Cardápio" title="Serviço" description="Toque para alternar entre disponível e esgotado durante o atendimento." />
      </div>
      <div className="tv-m-only tv-mp-head">
        <h1 className="tv-mp-title">Serviço</h1>
        <p className="tv-mp-lead">{canEdit ? 'Toque para marcar como esgotado ou disponível.' : 'Só administradores alteram a disponibilidade.'}</p>
      </div>
      <ServiceMode
        restaurantId={restaurantId}
        categories={categories}
        canEdit={canEdit}
        showIntro={false}
        onReviewMenu={() => router.push(menuHref)}
        onManageHiddenItems={() => router.push(menuHref)}
      />
    </div>
  )
}
