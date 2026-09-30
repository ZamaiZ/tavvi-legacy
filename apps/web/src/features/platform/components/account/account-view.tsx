'use client'

import { useState, useTransition } from 'react'
import { LuLogOut } from 'react-icons/lu'
import { useTheme, type Theme } from '@/components/theme/theme-provider'
import { signOutAction } from '@/server/actions/auth'
import { ConfirmDialog } from '../confirm-dialog'

const themes: { value: Theme; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
]

// Aba Conta do console (print conta.png): perfil, aparência e saída.
// Face ID fica de fora: o web não tem biometria.
export function AccountView({ email }: { email: string | null }) {
  const { theme, setTheme } = useTheme()
  const [confirm, setConfirm] = useState(false)
  const [pending, startTransition] = useTransition()
  const initial = email?.trim().slice(0, 1).toLocaleUpperCase('pt-BR') || 'A'
  return (
    <main className="tv-account-page">
      <h1>Conta</h1>
      <section className="tv-account-profile" aria-label="Perfil">
        <span className="tv-account-profile-avatar" aria-hidden="true">{initial}</span>
        <span className="tv-account-profile-copy"><strong>{email ?? 'Conta'}</strong><small>Administrador da plataforma</small></span>
      </section>
      <h2 className="tv-account-label">Aparência</h2>
      <div className="tv-account-group">
        <div className="tv-account-segment" role="group" aria-label="Tema">
          {themes.map(({ value, label }) => <button key={value} type="button" aria-pressed={theme === value} onClick={() => setTheme(value)}>{label}</button>)}
        </div>
      </div>
      <div className="tv-account-group is-spaced">
        <button type="button" className="tv-account-signout" disabled={pending} onClick={() => setConfirm(true)}>
          <LuLogOut aria-hidden="true" />{pending ? 'Saindo…' : 'Sair'}
        </button>
      </div>
      {confirm && <ConfirmDialog title="Sair da conta?" description="Você precisará entrar novamente para acessar o console." confirmLabel="Sair da conta" icon={<LuLogOut />} destructive pending={pending} onCancel={() => setConfirm(false)} onConfirm={() => startTransition(() => void signOutAction())} />}
    </main>
  )
}
