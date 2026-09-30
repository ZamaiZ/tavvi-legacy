'use client'

import type { OwnerMenuCategoryDTO } from '@/domain/menu'
import { BoardMode } from './work-modes/board-mode'
import { SequenceMode } from './work-modes/sequence-mode'
import { ServiceMode } from './work-modes/service-mode'
import { SheetMode } from './work-modes/sheet-mode'
import { StudioMode } from './work-modes/studio-mode'

export type MenuWorkMode = 'studio' | 'board' | 'spreadsheet' | 'sequence' | 'service'

// Modos "Trabalhar" do cardápio. Cada um mora no próprio arquivo.
export function MenuWorkModes({
  mode,
  restaurantId,
  categories,
  canEdit,
  theme,
  onManageHiddenItems,
  onReviewMenu,
}: {
  mode: MenuWorkMode
  restaurantId: string
  categories: OwnerMenuCategoryDTO[]
  canEdit: boolean
  theme: unknown
  onManageHiddenItems: () => void
  onReviewMenu: () => void
}) {
  if (mode === 'service') return <ServiceMode restaurantId={restaurantId} categories={categories} canEdit={canEdit} onReviewMenu={onReviewMenu} onManageHiddenItems={onManageHiddenItems} />
  if (mode === 'sequence') return <SequenceMode restaurantId={restaurantId} categories={categories} canEdit={canEdit} onReviewMenu={onReviewMenu} />
  if (mode === 'board') return <BoardMode restaurantId={restaurantId} categories={categories} canEdit={canEdit} />
  if (mode === 'spreadsheet') return <SheetMode restaurantId={restaurantId} categories={categories} canEdit={canEdit} />
  return <StudioMode restaurantId={restaurantId} categories={categories} canEdit={canEdit} theme={theme} />
}
