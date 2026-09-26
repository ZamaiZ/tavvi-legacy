'use client'

import { useState } from 'react'
import { RiAddLine } from 'react-icons/ri'
import { Button } from '@/components/ui/button'
import { ItemCreateDialog } from './item-create-dialog'

// Mesmo papel do NewCategoryButton: a página é componente de servidor e o
// diálogo é controlado por estado. Este é o pedacinho de cliente que segura
// esse estado.
export function NewItemButton({
  restaurantId,
  categoryId,
  label = 'Adicionar item',
  variant = 'ghost',
  size = 'sm',
}: {
  restaurantId: string
  categoryId: string
  label?: string
  variant?: 'ghost' | 'outline'
  size?: 'sm' | 'default'
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <RiAddLine className="size-4" />
        {label}
      </Button>
      <ItemCreateDialog
        restaurantId={restaurantId}
        categoryId={categoryId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
