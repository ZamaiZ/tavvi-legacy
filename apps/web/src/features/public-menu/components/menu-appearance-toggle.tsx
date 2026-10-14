'use client'

import { useEffect, useState } from 'react'
import { RiComputerLine, RiMoonLine, RiSunLine } from 'react-icons/ri'

type MenuAppearance = 'system' | 'light' | 'dark'
const MENU_THEME_KEY = 'tema-cardapio'
const appearanceOptions = {
  system: { label: 'Sistema', Icon: RiComputerLine, next: 'light' },
  light: { label: 'Claro', Icon: RiSunLine, next: 'dark' },
  dark: { label: 'Escuro', Icon: RiMoonLine, next: 'system' },
} as const

export function MenuAppearanceToggle() {
  const [appearance, setAppearance] = useState<MenuAppearance>('system')

  useEffect(() => {
    const stored = document.documentElement.dataset.menuAppearance
    if (stored === 'light' || stored === 'dark') setAppearance(stored)
  }, [])

  function cycleAppearance() {
    const next = appearanceOptions[appearance].next
    setAppearance(next)
    document.documentElement.dataset.menuAppearance = next
    try {
      localStorage.setItem(MENU_THEME_KEY, next)
    } catch {
      // The current visit still responds when browser storage is unavailable.
    }
  }

  const { label, Icon, next } = appearanceOptions[appearance]

  return (
    <button
      type="button"
      onClick={cycleAppearance}
      className="menu-chip menu-theme-toggle flex min-h-11 shrink-0 items-center gap-1.5 px-3 text-[0.8125rem] font-semibold"
      aria-label={`Tema: ${label}. Ativar ${appearanceOptions[next].label}`}
      title={`Tema: ${label}`}
    >
      <Icon className="size-4" aria-hidden="true" />
      <span>{label}</span>
    </button>
  )
}
