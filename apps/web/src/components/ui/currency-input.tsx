'use client'

import { useLayoutEffect, useRef, type ComponentProps } from 'react'
import { digitsToCents, formatCentsInput, MAX_PRICE_CENTS, pastedToCents } from '@/lib/money'

type CurrencyInputProps = Omit<ComponentProps<'input'>, 'value' | 'defaultValue' | 'onChange' | 'type' | 'inputMode' | 'name' | 'ref'> & {
  valueCents: number | null
  onValueChange: (cents: number | null) => void
  /** Grava os centavos num campo oculto, para formulários lidos com FormData. */
  name?: string
}

// Na caixa registradora o cursor mora no fim: tocar no meio do valor não
// pode inserir dígito ali. Selecionar tudo (para digitar por cima) continua.
function keepCaretAtEnd(input: HTMLInputElement) {
  const end = input.value.length
  const { selectionStart, selectionEnd } = input
  if (selectionStart === end && selectionEnd === end) return
  if (end > 0 && selectionStart === 0 && selectionEnd === end) return
  input.setSelectionRange(end, end)
}

// Campo de preço com máscara de caixa registradora (spec de componentes §1.2):
// os dígitos entram pela direita (1, 4, 9, 0 → 14,90) e o valor sai sempre em
// centavos inteiros. O prefixo "R$" fica com quem usa o campo.
export function CurrencyInput({ valueCents, onValueChange, name, placeholder = '0,00', onFocus, onSelect, ...props }: CurrencyInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const text = valueCents === null ? '' : formatCentsInput(valueCents)

  // A máscara cresce pela direita: com foco, o cursor mora no fim.
  useLayoutEffect(() => {
    const input = inputRef.current
    if (input && document.activeElement === input) input.setSelectionRange(text.length, text.length)
  }, [text])

  return (
    <>
      <input
        {...props}
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        value={text}
        onFocus={(event) => {
          onFocus?.(event)
          // O toque posiciona o cursor depois do foco.
          const input = event.currentTarget
          requestAnimationFrame(() => {
            if (document.activeElement === input) keepCaretAtEnd(input)
          })
        }}
        onSelect={(event) => {
          onSelect?.(event)
          keepCaretAtEnd(event.currentTarget)
        }}
        onChange={(event) => {
          const typed = event.target.value
          const next = digitsToCents(typed)
          if (next !== null && next > MAX_PRICE_CENTS) return
          // Apagar até sobrar só zero esvazia o campo; digitar 0 nele vazio dá 0,00.
          if (next === 0 && typed.length < text.length) {
            onValueChange(null)
            return
          }
          onValueChange(next)
        }}
        onPaste={(event) => {
          event.preventDefault()
          const next = pastedToCents(event.clipboardData.getData('text'))
          if (next === null || next > MAX_PRICE_CENTS) return
          onValueChange(next)
        }}
      />
      {name ? <input type="hidden" name={name} value={valueCents ?? ''} /> : null}
    </>
  )
}
