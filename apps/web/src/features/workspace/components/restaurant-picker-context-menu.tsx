'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LuCopy, LuExternalLink, LuPanelRightOpen } from 'react-icons/lu'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu'
import type { RestaurantPickerDTO } from '@/domain/restaurant'
import { copyText } from '@/lib/copy-text'
import { publicMenuUrl } from '@/lib/public-menu-url'

// Botão direito no cartão do seletor (spec de componentes §4.3). O cartão
// continua sendo o link; o menu só acrescenta os atalhos.
export function RestaurantPickerContextMenu({
  restaurant,
  domain,
  children,
}: {
  restaurant: Pick<RestaurantPickerDTO, 'id' | 'name' | 'slug' | 'status'>
  domain: string
  children: ReactNode
}) {
  const router = useRouter()
  const href = `/restaurantes/${restaurant.id}`
  return (
    <ContextMenu>
      <ContextMenuTrigger render={<Link href={href} className="tv-picker-card" />}>{children}</ContextMenuTrigger>
      <ContextMenuContent aria-label={`Ações de ${restaurant.name}`}>
        <ContextMenuItem onClick={() => router.push(href)}><LuPanelRightOpen aria-hidden="true" /><span>Abrir</span></ContextMenuItem>
        <ContextMenuItem
          disabled={restaurant.status !== 'active'}
          onClick={() => window.open(publicMenuUrl(domain, restaurant.slug), '_blank', 'noopener,noreferrer')}
        >
          <LuExternalLink aria-hidden="true" /><span>Abrir cardápio público</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={() => void copyText(publicMenuUrl(domain, restaurant.slug), 'Link copiado')}><LuCopy aria-hidden="true" /><span>Copiar link</span></ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
