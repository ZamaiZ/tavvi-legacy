// Preço vive como inteiro de centavos no banco, na API e no estado. Só este
// arquivo converte para texto: exibir, preencher o campo e ler o que foi
// digitado ou colado. Sem ponto flutuante no caminho do valor.
export const MAX_PRICE_CENTS = 99_999_999

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

// "R$ 14,90" (com o espaço inseparável do Intl, como sempre foi).
export function formatCents(cents: number): string {
  return currency.format(cents / 100)
}

// "14,90", "1.324,90": o texto do campo, montado à mão para servidor e
// navegador escreverem igual.
export function formatCentsInput(cents: number): string {
  const reais = Math.floor(cents / 100)
  const rest = String(cents % 100).padStart(2, '0')
  return `${String(reais).replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${rest}`
}

// Máscara de caixa registradora: só os dígitos contam, lidos como centavos.
// "1490" e "R$ 14,90" dão 1490. Sem dígito nenhum, `null`.
export function digitsToCents(text: string): number | null {
  const digits = text.replace(/\D/g, '')
  if (!digits) return null
  const value = Number(digits)
  return Number.isSafeInteger(value) ? value : Number.MAX_SAFE_INTEGER
}

// Colado de outro lugar, "14.9", "14,90" e "R$ 1.324,90" são reais com
// centavos. Só dígitos, como "1490", seguem a máscara (centavos).
export function pastedToCents(text: string): number | null {
  const cents = digitsToCents(text)
  if (cents === null) return null
  const decimals = text.match(/[.,](\d{1,2})\s*$/)
  if (!decimals) return cents
  return decimals[1].length === 1 ? cents * 10 : cents
}

// "A partir de": com variações, o menor preço entre elas, como no cardápio
// público; sem variações, o preço do item.
export function lowestPriceCents(item: { basePriceCents: number; variants: readonly { priceCents: number }[] }): number {
  if (item.variants.length === 0) return item.basePriceCents
  return Math.min(...item.variants.map((variant) => variant.priceCents))
}
