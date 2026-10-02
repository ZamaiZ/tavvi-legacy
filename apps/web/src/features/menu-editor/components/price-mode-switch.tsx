'use client'

type PriceMode = 'single' | 'variants'

// "Preço único | Variações". A escolha é explícita: nada some do formulário
// sem a pessoa ter pedido. Mesmo padrão segmentado da Densidade (Identidade).
export function PriceModeSwitch({
  value,
  disabled,
  appearance = 'panel',
  onChange,
}: {
  value: PriceMode
  disabled: boolean
  appearance?: 'panel' | 'mobile'
  onChange: (mode: PriceMode) => void
}) {
  const labels: Record<PriceMode, string> =
    appearance === 'mobile' ? { single: 'Único', variants: 'Variações' } : { single: 'Preço único', variants: 'Variações' }
  return (
    <div className={`tv-pricemode${appearance === 'mobile' ? ' is-mobile' : ''}`} role="group" aria-label="Tipo de preço">
      {(['single', 'variants'] as const).map((mode) => (
        <button key={mode} type="button" aria-pressed={value === mode} disabled={disabled} onClick={() => onChange(mode)}>
          {labels[mode]}
        </button>
      ))}
    </div>
  )
}
