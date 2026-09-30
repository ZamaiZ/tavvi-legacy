'use client'

import { useState } from 'react'
import { LuPlus } from 'react-icons/lu'
import { ItemCreateDialog } from './item-create-dialog'

// "Adicionar item" em dourado no rodapé da categoria, ou pílula com borda
// ("chip") nos estados vazios. É o pedacinho de cliente que segura o estado
// do diálogo.
export function NewItemButton({
  restaurantId,
  categoryId,
  label = 'Adicionar item',
  appearance = 'add',
}: {
  restaurantId: string
  categoryId: string
  label?: string
  appearance?: 'add' | 'chip'
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={appearance === 'add' ? 'tv-add-item' : 'tv-pbtn is-sm'} onClick={() => setOpen(true)}>
        <LuPlus aria-hidden="true" />
        {label}
      </button>
      <ItemCreateDialog restaurantId={restaurantId} categoryId={categoryId} open={open} onOpenChange={setOpen} />
    </>
  )
}
