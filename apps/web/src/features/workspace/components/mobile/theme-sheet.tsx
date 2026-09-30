'use client'

import { LuCheck } from 'react-icons/lu'
import { MobileSheet, MobileSheetNav, useMobileSheet } from '@/components/shell/mobile-sheet'
import { useTheme, type Theme } from '@/components/theme/theme-provider'

export const THEME_LABELS: Record<Theme, string> = { system: 'Sistema', light: 'Claro', dark: 'Escuro' }
const THEMES: Theme[] = ['system', 'light', 'dark']

// Tema no celular: escolha única, aplicada na hora.
export function ThemeSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <MobileSheet open={open} onOpenChange={onOpenChange} detent="content">
      <ThemeBody />
    </MobileSheet>
  )
}

function ThemeBody() {
  const { forceClose } = useMobileSheet()
  const { theme, setTheme } = useTheme()

  // A troca aparece antes de o sheet descer: 150 ms para o ✓ ser visto.
  function choose(next: Theme) {
    setTheme(next)
    window.setTimeout(forceClose, 150)
  }

  return (
    <>
      <MobileSheetNav title="Tema" cancelLabel="Fechar" />
      <div className="tv-group" role="radiogroup" aria-label="Tema">
        {THEMES.map((value) => (
          <button key={value} type="button" role="radio" aria-checked={theme === value} className="tv-choice" onClick={() => choose(value)}>
            <span><strong>{THEME_LABELS[value]}</strong></span>
            {theme === value ? <LuCheck aria-hidden="true" /> : null}
          </button>
        ))}
      </div>
      <p className="tv-sheet-m-note">Sistema acompanha o modo claro ou escuro do celular.</p>
    </>
  )
}
