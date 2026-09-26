'use client'

import { useEffect, useRef, useTransition } from 'react'
import { LuCheck, LuLogOut, LuMonitor, LuMoon, LuSun, LuX } from 'react-icons/lu'
import { useTheme, type Theme } from '@/components/theme/theme-provider'
import { signOutAction } from '@/server/actions/auth'

const themeOptions: { value: Theme; label: string; Icon: typeof LuSun }[] = [
  { value: 'system', label: 'Sistema', Icon: LuMonitor },
  { value: 'light', label: 'Claro', Icon: LuSun },
  { value: 'dark', label: 'Escuro', Icon: LuMoon },
]

export function AccountPopover({ email, description, onClose }: { email: string | null; description: string | null; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const [pending, startTransition] = useTransition()
  const { theme, setTheme } = useTheme()
  const initial = email?.trim().slice(0, 1).toUpperCase() || 'A'

  useEffect(() => {
    closeRef.current?.focus()
    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
      if (event.key === 'Tab' && ref.current) {
        const items = ref.current.querySelectorAll<HTMLElement>('button:not(:disabled)')
        if (!items.length) return
        const first = items[0]
        const last = items[items.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', keydown)
    return () => document.removeEventListener('keydown', keydown)
  }, [onClose])

  return (
    <div ref={ref} role="dialog" aria-label="Conta" className="tv-account-popover">
      <div className="tv-account-head">
        <span className="tv-account-avatar">{initial}</span>
        <span className="tv-account-user"><strong>{email ?? 'Conta'}</strong><small>{description ?? 'Administrador da plataforma'}</small></span>
        <button ref={closeRef} type="button" className="tv-icon-button" aria-label="Fechar conta" onClick={onClose}><LuX /></button>
      </div>
      <div className="tv-account-section">
        <span className="tv-console-eyebrow">Tema</span>
        <div className="tv-theme-segment" role="group" aria-label="Tema">
          {themeOptions.map(({ value, label }) => <button key={value} type="button" aria-pressed={theme === value} onClick={() => setTheme(value)}>{label}</button>)}
        </div>
      </div>
      <button type="button" disabled={pending} className="tv-signout-button" onClick={() => startTransition(() => void signOutAction())}>
        {pending ? <span className="tv-spinner" /> : <LuLogOut aria-hidden="true" />}<span>{pending ? 'Saindo…' : 'Sair'}</span><LuCheck className="sr-only" />
      </button>
    </div>
  )
}
