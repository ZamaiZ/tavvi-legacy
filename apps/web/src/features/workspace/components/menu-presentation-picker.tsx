'use client'

import { useState } from 'react'
import type { MenuPresentation } from '@/domain/menu-presentation'

export function MenuPresentationPicker({
  value,
  disabled,
  onChange,
}: {
  value: MenuPresentation
  disabled: boolean
  onChange: (value: MenuPresentation) => void
}) {
  const isClassic = value !== 'immersive'
  const [classicLayout, setClassicLayout] = useState<'catalog-list' | 'catalog-grid'>(
    value === 'catalog-grid' ? 'catalog-grid' : 'catalog-list',
  )

  function selectClassicLayout(layout: 'catalog-list' | 'catalog-grid') {
    setClassicLayout(layout)
    onChange(layout)
  }

  return (
    <section className="tv-identity-card tv-menu-presentation" aria-labelledby="identity-presentation-title">
      <div className="tv-identity-card-head">
        <h2 id="identity-presentation-title">Formato do cardápio</h2>
        <p>Escolha como seus clientes vão explorar os pratos.</p>
      </div>

      <div className="tv-menu-presentation-options" role="group" aria-label="Perfil do cardápio">
        <button
          type="button"
          className="tv-menu-presentation-option"
          aria-pressed={!isClassic}
          disabled={disabled}
          onClick={() => onChange('immersive')}
        >
          <span className="tv-menu-presentation-preview is-immersive" aria-hidden="true">
            <i />
            <span><b /><b /></span>
          </span>
          <span className="tv-menu-presentation-copy">
            <strong>Imersivo</strong>
            <small>Um prato por vez, com fotos em destaque.</small>
          </span>
        </button>

        <button
          type="button"
          className="tv-menu-presentation-option"
          aria-pressed={isClassic}
          disabled={disabled}
          onClick={() => onChange(classicLayout)}
        >
          <span className={`tv-menu-presentation-preview ${value === 'catalog-grid' ? 'is-grid' : 'is-list'}`} aria-hidden="true">
            <i /><i /><i /><i />
          </span>
          <span className="tv-menu-presentation-copy">
            <strong>Clássico</strong>
            <small>Categorias e pratos em uma página.</small>
          </span>
        </button>
      </div>

      {isClassic ? (
        <div className="tv-menu-presentation-layout">
          <span className="tv-identity-label">Organização dos itens</span>
          <div className="tv-menu-presentation-layout-options" role="group" aria-label="Organização dos itens no cardápio clássico">
            <button
              type="button"
              aria-pressed={value === 'catalog-list'}
              disabled={disabled}
              onClick={() => selectClassicLayout('catalog-list')}
            >
              <span className="tv-menu-presentation-preview is-list" aria-hidden="true"><i /><i /><i /><i /></span>
              <span><strong>Lista</strong><small>Uma linha por prato</small></span>
            </button>
            <button
              type="button"
              aria-pressed={value === 'catalog-grid'}
              disabled={disabled}
              onClick={() => selectClassicLayout('catalog-grid')}
            >
              <span className="tv-menu-presentation-preview is-grid" aria-hidden="true"><i /><i /><i /><i /></span>
              <span><strong>Cards</strong><small>Lado a lado</small></span>
            </button>
          </div>
        </div>
      ) : null}

      <p className="tv-identity-help">Você pode mudar esse formato depois. As regras e os itens do cardápio continuam iguais.</p>
    </section>
  )
}
