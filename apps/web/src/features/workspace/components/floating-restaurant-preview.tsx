'use client'

import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import { RiSmartphoneLine } from 'react-icons/ri'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ALL_THEME_FONT_VARIABLES } from '@/lib/fonts'
import type { Density } from '@/domain/theme'

export type PreviewMode = 'light' | 'dark'

export function FloatingRestaurantPreview({
  renderPreview,
}: {
  renderPreview: (mode: PreviewMode) => ReactNode
}) {
  const [mode, setMode] = useState<PreviewMode>('light')

  return (
    <div className="tv-floating-preview">
      <Popover>
        <PopoverTrigger
          render={
            <Button
              type="button"
              className="tv-floating-preview-trigger"
              aria-label="Abrir prévia do cardápio"
            />
          }
        >
          <RiSmartphoneLine aria-hidden="true" />
          <span>Ver prévia</span>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="end"
          sideOffset={10}
          className="tv-floating-preview-popover"
        >
          <PopoverHeader className="tv-floating-preview-header">
            <div>
              <PopoverTitle>Prévia do cardápio</PopoverTitle>
              <PopoverDescription>Veja como os clientes encontram o restaurante.</PopoverDescription>
            </div>
            <div className="tv-floating-preview-mode" role="group" aria-label="Tema da prévia">
              <button type="button" aria-pressed={mode === 'light'} onClick={() => setMode('light')}>Claro</button>
              <button type="button" aria-pressed={mode === 'dark'} onClick={() => setMode('dark')}>Escuro</button>
            </div>
          </PopoverHeader>
          <div className="tv-floating-preview-content">{renderPreview(mode)}</div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export function PhonePreviewFrame({
  mode,
  density,
  style,
  children,
}: {
  mode: PreviewMode
  density: Density
  style: CSSProperties
  children: ReactNode
}) {
  return (
    <div className="tv-phone-preview">
      <p className="tv-phone-preview-mode-label">{mode === 'light' ? 'Claro' : 'Escuro'}</p>
      <div className="tv-phone-preview-device">
        <div className="tv-phone-preview-speaker" aria-hidden="true" />
        <div
          data-density={density}
          className={`menu tv-phone-preview-screen ${ALL_THEME_FONT_VARIABLES}`}
          style={style}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
