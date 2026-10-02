'use client'

import { useEffect, useRef, useTransition, type RefObject } from 'react'
import { useTheme, type Theme } from '@/components/theme/theme-provider'
import { forgetPushOnThisDevice, unsubscribePushLocally } from '@/components/pwa/push-client'
import { toast } from '@/components/ui/toast'
import { signOutAction, signOutEverywhereAction } from '@/server/actions/auth'

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

// Sai e navega com location.replace (ver signOutAction). Antes, o aparelho
// deixa de receber os avisos da conta: apagar a inscrição no servidor ainda
// precisa da sessão.
export function useSignOut() {
  const [pending, startTransition] = useTransition()
  function signOut() {
    startTransition(async () => {
      await forgetPushOnThisDevice()
      await signOutAction()
      window.location.replace('/entrar')
    })
  }
  return { pending, signOut }
}

export const signOutEverywhereCopy = {
  title: 'Sair de todos os aparelhos?',
  description: 'Isso encerra sua sessão em todos os aparelhos e desliga a digital em todos eles, inclusive neste.',
  confirmLabel: 'Sair de todos',
  pendingLabel: 'Saindo…',
}

// "Sair de todos os aparelhos" (só no console): o servidor desliga a digital
// do app em todos os celulares, apaga as inscrições de push da conta e
// encerra todas as sessões. Se falhar, a pessoa continua logada e vê a causa.
export function useSignOutEverywhere(onFailure?: () => void) {
  const [pending, startTransition] = useTransition()
  function signOutEverywhere() {
    startTransition(async () => {
      const result = await signOutEverywhereAction()
      if (!result.ok) {
        toast.add({ title: result.error, type: 'error' })
        onFailure?.()
        return
      }
      await unsubscribePushLocally()
      window.location.replace('/entrar')
    })
  }
  return { pending, signOutEverywhere }
}

// Teclado dos diálogos de conta: foco no tema atual ao abrir, Esc fecha
// (exceto com uma confirmação aberta por cima) e Tab fica dentro do diálogo,
// passando também pelo campo "Nome".
export function useAccountDialogKeys(ref: RefObject<HTMLElement | null>, onClose: () => void) {
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('button[aria-pressed="true"]')?.focus()
    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (!document.querySelector('.tv-confirm-scrim, .tv-pconfirm-scrim')) onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !ref.current) return
      const items = ref.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)')
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
