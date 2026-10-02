'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { LuCheck } from 'react-icons/lu'
import { useRestaurantShell } from '@/components/shell/console-shell'
import { MobileSheet, MobileSheetNav, useMobileSheet, useSheetBusy } from '@/components/shell/mobile-sheet'
import { RestaurantMark } from '@/components/shell/restaurant-mark'
import { SpinnerRing } from '@/components/ui/spinner'

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
  const [opening, startOpening] = useTransition()
  const [target, setTarget] = useState<string | null>(null)
  useSheetBusy(opening)

  function go(id: string) {
    if (id === restaurantId) {
      forceClose()
      return
    }
    // O sheet fica aberto com o spinner na linha até a casca do outro
    // restaurante montar; ela o substitui.
    setTarget(id)
    startOpening(() => router.push(`/restaurantes/${id}`))
  }

  return (
    <>
      <MobileSheetNav title="Seus restaurantes" cancelLabel="Fechar" />
      <div className="tv-group" role="radiogroup" aria-label="Seus restaurantes">
        {restaurants.map((entry) => (
          <button key={entry.id} type="button" role="radio" aria-checked={entry.id === restaurantId} className="tv-choice is-restaurant" disabled={opening} onClick={() => go(entry.id)}>
            <RestaurantMark entry={entry} className="tv-mrest-mark" />
            <span><strong>{entry.name}</strong><small>{entry.roleLabel}</small></span>
            {target === entry.id && opening ? <SpinnerRing label={`Abrindo ${entry.name}`} /> : entry.id === restaurantId ? <LuCheck aria-hidden="true" /> : null}
          </button>
        ))}
      </div>
    </>
  )
}
