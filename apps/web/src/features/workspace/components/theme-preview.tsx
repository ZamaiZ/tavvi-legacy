'use client'

import type { CSSProperties } from 'react'
import type { Density, ThemeChoice } from '@/domain/theme'
import { publicMediaUrl } from '@/lib/media-url'
import { resolveTheme } from '@/lib/theme/resolve'
import { PhonePreviewFrame, type PreviewMode } from './floating-restaurant-preview'
import '@/features/public-menu/styles/menu.css'

// Conteúdo de amostra do protótipo (README §7.7). Só o nome, o tipo, o logo,
// a capa e as cores são do restaurante; categorias e pratos ilustram o tema.
const SAMPLE_CATEGORIES = ['Massas', 'Pizzas', 'Bebidas']
const SAMPLE_DISHES = [
  {
    name: 'Spaghetti alla carbonara',
    description: 'Guanciale, gema, pecorino romano e pimenta-do-reino.',
    price: 'R$ 64,00',
  },
  {
    name: 'Ravioli de abóbora',
    description: 'Massa fresca, manteiga de sálvia e amêndoas tostadas.',
    price: 'R$ 59,00',
  },
]

export type ThemePreviewData = {
  theme: ThemeChoice
  name: string
  segment: string | null
  logoPath: string | null
  coverPath: string | null
}

// As variáveis `--m-*` que o cardápio público usa, na face pedida. A prévia
// desenha com elas, e não com o dourado do painel.
export function themePreviewStyle(theme: ThemeChoice, mode: PreviewMode) {
  const resolved = resolveTheme(theme)
  return {
    density: resolved.density,
    style: (mode === 'light' ? resolved.styleLight : resolved.styleDark) as CSSProperties,
  }
}

export function ThemePreviewContent({
  name,
  segment,
  logoPath,
  coverPath,
  density,
}: Omit<ThemePreviewData, 'theme'> & { density: Density }) {
  return (
    <div className="tv-theme-preview">
      <div className="tv-theme-preview-cover">
        {coverPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={publicMediaUrl('image', coverPath)} alt="" />
        ) : null}
        <span className="tv-theme-preview-logo">
          {logoPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={publicMediaUrl('image', logoPath)} alt="" />
          ) : null}
        </span>
      </div>
      <div className="tv-theme-preview-title">
        <strong className="menu-display">{name || 'Seu restaurante'}</strong>
        {segment ? <span>{segment}</span> : null}
      </div>
      <div className="tv-theme-preview-chips">
        {SAMPLE_CATEGORIES.map((category, index) => (
          <span key={category} className={index === 0 ? 'is-active' : undefined}>{category}</span>
        ))}
      </div>
      {SAMPLE_DISHES.map((dish) => (
        <div key={dish.name} className="tv-theme-preview-dish">
          <span />
          <span>
            <strong className="menu-display">{dish.name}</strong>
            {/* Compacto recolhe a descrição, como no cardápio no ar. */}
            {density === 'confortavel' ? <span>{dish.description}</span> : null}
            <b>{dish.price}</b>
          </span>
        </div>
      ))}
    </div>
  )
}

// A versão com moldura do popover "Ver prévia", usada abaixo de 1024 px.
export function ThemePreview({ theme, mode, ...content }: ThemePreviewData & { mode: PreviewMode }) {
  const { density, style } = themePreviewStyle(theme, mode)

  return (
    <PhonePreviewFrame density={density} style={style}>
      <ThemePreviewContent {...content} density={density} />
    </PhonePreviewFrame>
  )
}
