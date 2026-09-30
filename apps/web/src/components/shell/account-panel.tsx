'use client'

import { useEffect, useRef, useTransition, type RefObject } from 'react'
import { useTheme, type Theme } from '@/components/theme/theme-provider'
import { signOutAction } from '@/server/actions/auth'

const themeOptions: { value: Theme; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
]

export function accountInitial(email: string | null) {
  return email?.trim().slice(0, 1).toLocaleUpperCase('pt-BR') || 'A'
}

// Segmentado Sistema · Claro · Escuro. O popover do desktop e o sheet do
// celular usam o mesmo componente com classes diferentes.
export function ThemeSegment({ className }: { className: string }) {
  const { theme, setTheme } = useTheme()
  return (
    <div className={className} role="group" aria-label="Tema">
      {themeOptions.map(({ value, label }) => (
        <button key={value} type="button" aria-pressed={theme === value} onClick={() => setTheme(value)}>{label}</button>
      ))}
    </div>
  )
}

// Sai e navega com location.replace (ver signOutAction).
export function useSignOut() {
  const [pending, startTransition] = useTransition()
  function signOut() {
    startTransition(async () => {
      await signOutAction()
      window.location.replace('/entrar')
    })
  }
  return { pending, signOut }
}

// Teclado dos diálogos de conta: foco no tema atual ao abrir, Esc fecha
// (exceto com uma confirmação aberta por cima) e Tab fica dentro do diálogo.
export function useAccountDialogKeys(ref: RefObject<HTMLElement | null>, onClose: () => void) {
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('button[aria-pressed="true"]')?.focus()
    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (!document.querySelector('.tv-confirm-scrim')) onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !ref.current) return
      const items = ref.current.querySelectorAll<HTMLElement>('button:not(:disabled)')
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', keydown)
    return () => document.removeEventListener('keydown', keydown)
  }, [ref])
}
