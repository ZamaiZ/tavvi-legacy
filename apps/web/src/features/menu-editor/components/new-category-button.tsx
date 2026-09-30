'use client'

import { useState } from 'react'
import { LuFolderPlus } from 'react-icons/lu'
import { CategoryDialog } from './category-dialog'

// Primário com folder-plus no cabeçalho; pílula ("chip") nos atalhos do
// cardápio vazio. Existe porque a página é componente de servidor e o
// diálogo é controlado por estado.
export function NewCategoryButton({
  restaurantId,
  label = 'Nova categoria',
  initialName,
  appearance = 'primary',
}: {
  restaurantId: string
  label?: string
  initialName?: string
  appearance?: 'primary' | 'chip'
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={appearance === 'primary' ? 'tv-pbtn is-primary' : 'tv-pbtn is-sm'} onClick={() => setOpen(true)}>
        {appearance === 'primary' ? <LuFolderPlus aria-hidden="true" /> : null}
        {label}
      </button>
      <CategoryDialog restaurantId={restaurantId} initialName={initialName} open={open} onOpenChange={setOpen} />
    </>
  )
}
