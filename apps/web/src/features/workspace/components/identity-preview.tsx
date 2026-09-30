'use client'

import { useState } from 'react'
import { ALL_THEME_FONT_VARIABLES } from '@/lib/fonts'
import type { PreviewMode } from './floating-restaurant-preview'
import { ThemePreviewContent, themePreviewStyle, type ThemePreviewData } from './theme-preview'

const MODES: { value: PreviewMode; label: string }[] = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
]

// A prévia fixa ao lado do formulário, a partir de 1024 px (README §7.7).
// Claro e Escuro é a única diferença do protótipo: sem ele o dono não teria
// onde ver como o destaque se ajusta no cardápio escuro.
export function IdentityPreview({ theme, ...content }: ThemePreviewData) {
  const [mode, setMode] = useState<PreviewMode>('light')
  const { density, style } = themePreviewStyle(theme, mode)

  return (
    <aside className="tv-identity-aside" aria-labelledby="identity-preview-title">
      <div className="tv-identity-aside-head">
        <span id="identity-preview-title">Prévia do cardápio</span>
        <div className="tv-identity-segmented is-small" role="group" aria-label="Versão da prévia">
          {MODES.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={mode === option.value}
              onClick={() => setMode(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="tv-identity-device" aria-hidden="true">
        <div
          data-density={density}
          className={`menu tv-identity-device-screen ${ALL_THEME_FONT_VARIABLES}`}
          style={style}
        >
          <ThemePreviewContent {...content} density={density} />
        </div>
      </div>
      <p className="tv-identity-aside-note">O cardápio público mantém o tema do restaurante.</p>
    </aside>
  )
}
