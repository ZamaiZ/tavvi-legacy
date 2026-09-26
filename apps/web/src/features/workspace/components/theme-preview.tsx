'use client'

import type { CSSProperties } from 'react'
import type { ThemeChoice } from '@/domain/theme'
import { resolveTheme } from '@/lib/theme/resolve'
import { PhonePreviewFrame, type PreviewMode } from './floating-restaurant-preview'
import '@/features/public-menu/styles/menu.css'

const SAMPLE_CATEGORIES = [
  {
    name: 'Entradas',
    items: [
      { name: 'Bolinho de bacalhau', description: 'Seis unidades, aioli de limão', price: 'R$ 38,00' },
      { name: 'Pastel de queijo', description: 'Massa fina, muçarela de búfala', price: 'R$ 24,00' },
    ],
  },
  {
    name: 'Pratos principais',
    items: [
      { name: 'Picanha na chapa', description: '400g, farofa de ovo e vinagrete', price: 'R$ 128,00' },
    ],
  },
]

export function ThemePreview({
  theme,
  name,
  mode,
}: {
  theme: ThemeChoice
  name: string
  mode: PreviewMode
}) {
  const resolved = resolveTheme(theme)
  const style = (mode === 'light' ? resolved.styleLight : resolved.styleDark) as CSSProperties

  return (
    <PhonePreviewFrame mode={mode} density={resolved.density} style={style}>
      <div
        className="h-20 w-full"
        style={{
          background:
            'linear-gradient(150deg, color-mix(in oklab, var(--m-accent) 70%, var(--m-base)), var(--m-base))',
        }}
      />
      <div className="px-3 pb-4">
        <h3 className="menu-display -mt-2 text-[0.98rem] font-semibold leading-tight">
          {name || 'Seu restaurante'}
        </h3>
        {SAMPLE_CATEGORIES.map((category) => (
          <section key={category.name} className="pt-4">
            <h4 className="menu-display menu-accent text-[0.5625rem] font-bold uppercase tracking-[0.18em]">
              {category.name}
            </h4>
            <ul className="menu-list menu-line mt-1 divide-y" style={{ borderColor: 'var(--m-line)' }}>
              {category.items.map((item) => (
                <li key={item.name} className="menu-item flex items-center gap-2 py-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="menu-display text-[0.75rem] font-semibold">{item.name}</span>
                      <span className="menu-accent shrink-0 text-[0.75rem] font-semibold">{item.price}</span>
                    </div>
                    <p className="menu-item-description menu-muted mt-0.5 text-[0.625rem] leading-snug">
                      {item.description}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </PhonePreviewFrame>
  )
}
