'use client'

import { useState } from 'react'
import { RiAddLine } from 'react-icons/ri'
import { Button } from '@/components/ui/button'
import { CategoryDialog } from './category-dialog'

// Existe porque a página é um componente de servidor e o diálogo é
// controlado por estado. Este é o pedacinho de cliente que segura esse
// estado, sem transformar a página inteira em componente de cliente.
export function NewCategoryButton({
  restaurantId,
  label = 'Nova categoria',
  initialName,
  variant = 'default',
}: {
  restaurantId: string
  label?: string
  initialName?: string
  variant?: 'default' | 'outline'
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <RiAddLine className="size-4" />
        {label}
      </Button>
      <CategoryDialog
        restaurantId={restaurantId}
        initialName={initialName}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
