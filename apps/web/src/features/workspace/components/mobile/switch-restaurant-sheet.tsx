'use client'

import { useRouter } from 'next/navigation'
import { LuCheck } from 'react-icons/lu'
import { useRestaurantShell } from '@/components/shell/console-shell'
import { MobileSheet, MobileSheetNav, useMobileSheet } from '@/components/shell/mobile-sheet'
import { RestaurantMark } from '@/components/shell/restaurant-mark'

// "Trocar de restaurante" no celular: os restaurantes da pessoa, com ✓ no
// atual. Só aparece com 2 ou mais (quem chama decide).
export function SwitchRestaurantSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <MobileSheet open={open} onOpenChange={onOpenChange} detent="content">
      <SwitchBody />
    </MobileSheet>
  )
}

function SwitchBody() {
  const router = useRouter()
  const { forceClose } = useMobileSheet()
  const { restaurantId, restaurants } = useRestaurantShell()

  function go(id: string) {
    forceClose()
    if (id !== restaurantId) router.push(`/restaurantes/${id}`)
  }

  return (
    <>
      <MobileSheetNav title="Seus restaurantes" cancelLabel="Fechar" />
      <div className="tv-group" role="radiogroup" aria-label="Seus restaurantes">
        {restaurants.map((entry) => (
          <button key={entry.id} type="button" role="radio" aria-checked={entry.id === restaurantId} className="tv-choice is-restaurant" onClick={() => go(entry.id)}>
            <RestaurantMark entry={entry} className="tv-mrest-mark" />
            <span><strong>{entry.name}</strong><small>{entry.roleLabel}</small></span>
            {entry.id === restaurantId ? <LuCheck aria-hidden="true" /> : null}
          </button>
        ))}
      </div>
    </>
  )
}
