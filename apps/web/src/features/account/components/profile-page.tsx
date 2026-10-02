'use client'

import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react'
import { AnimatePresence, useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'
import { LuKeyRound } from 'react-icons/lu'
import { PageHeader } from '@/components/shell/page-header'
import { Stagger } from '@/components/motion/reveal'
import { SpinnerRing } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { fullDateTime, relativeTime } from '@/lib/relative-time'
import { personInitials } from '@/lib/initials'
import { changePasswordAction } from '@/server/actions/profile'
import type { AccountProfile } from '@/server/dal/profile'

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' })

export function ProfilePage({ profile }: { profile: AccountProfile }) {
  const [editingPassword, setEditingPassword] = useState(false)
  const [changedNow, setChangedNow] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const currentPasswordRef = useRef<HTMLInputElement>(null)
  const passwordRowRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (editingPassword) currentPasswordRef.current?.focus()
  }, [editingPassword])

  useEffect(() => {
    document.querySelector<HTMLElement>('.tv-console-main h1, .tv-account-page h1')?.focus()
  }, [])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const form = new FormData(event.currentTarget)
    setError(null)
    startTransition(async () => {
      const result = await changePasswordAction({
        currentPassword: form.get('currentPassword'),
        password: form.get('password'),
        confirmation: form.get('confirmation'),
      })
      if (!result.ok) { setError(result.error); return }
      setEditingPassword(false)
      setChangedNow(true)
      toast.add({ title: 'Senha alterada', type: 'success' })
    })
  }

  function cancelPassword() {
    setEditingPassword(false)
    setError(null)
    requestAnimationFrame(() => passwordRowRef.current?.focus())
  }

  const lastAccess = profile.lastSignInAt ? relativeTime(profile.lastSignInAt) : '—'
  return <div className="tv-console-page tv-account-page">
    <PageHeader title="Perfil" description="Seus dados de acesso ao Tavvi." />
    <Stagger step={0.04} className="tv-account-sections">
      <section className="tv-acc-section">
        <div className="tv-acc-identity">
          <span className="tv-acc-avatar" aria-hidden="true">{personInitials({ displayName: profile.displayName?.trim() || null, email: profile.email })}</span>
          <div><strong>{profile.displayName?.trim() || profile.email || 'Conta'}</strong><span>{profile.email}</span><small>{profile.platformAdmin ? 'Administrador da plataforma' : profile.restaurants[0]?.role ?? 'Membro do painel'}</small></div>
        </div>
      </section>

      <section className="tv-acc-section">
        <h2>Informações</h2>
        <div className="tv-acc-card">
          <div className="tv-acc-row"><span>Nome</span><span>{profile.displayName?.trim() || '—'}</span></div>
          <div className="tv-acc-row"><span>E-mail</span><span>{profile.email || '—'}</span></div>
          {profile.platformAdmin
            ? <div className="tv-acc-row"><span>Papel</span><span>Administrador da plataforma</span></div>
            : profile.restaurants.map((restaurant) => <div className="tv-acc-row" key={`${restaurant.name}-${restaurant.role}`}><span>{restaurant.name}</span><span>{restaurant.role}</span></div>)}
          <div className="tv-acc-row"><span>Membro desde</span><span>{profile.createdAt ? dateFormatter.format(new Date(profile.createdAt)) : '—'}</span></div>
          <div className="tv-acc-row"><span>Último acesso</span><span title={profile.lastSignInAt ? fullDateTime(profile.lastSignInAt) : undefined}>{lastAccess}</span></div>
          <p className="tv-acc-foot">Nome e e-mail vêm do convite e não podem ser alterados por aqui.</p>
        </div>
      </section>

      <section className="tv-acc-section">
        <h2>Segurança</h2>
        <div className="tv-acc-card">
          <div ref={passwordRowRef} tabIndex={-1} className="tv-acc-row tv-acc-password-row">
            <span className="tv-acc-icon is-neutral" aria-hidden="true"><LuKeyRound /></span>
            <span className="tv-acc-password-copy"><strong>Senha</strong><small>{changedNow ? 'Alterada agora' : profile.passwordUpdatedAt ? `Última alteração ${relativeTime(profile.passwordUpdatedAt)}` : 'Última alteração não informada'}</small></span>
            {!editingPassword ? <button type="button" className="tv-acc-link" onClick={() => setEditingPassword(true)}>Alterar</button> : null}
          </div>
          <AnimatePresence initial={false}>
            {editingPassword ? <m.div
              className="tv-acc-form-wrap"
              initial={reduced ? false : { height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={reduced ? { opacity: 0, transition: { duration: 0.15 } } : { height: 0, opacity: 0 }}
              transition={reduced ? { opacity: { duration: 0.15 } } : { height: { duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }, opacity: { duration: 0.22 } }}
            >
              <form className="tv-acc-form" aria-busy={pending} onSubmit={submit}>
                <div className="tv-acc-inputs">
                  <label className="sr-only" htmlFor="tv-current-password">Senha atual</label>
                  <input id="tv-current-password" ref={currentPasswordRef} type="password" name="currentPassword" autoComplete="current-password" placeholder="Senha atual" required disabled={pending} />
                  <label className="sr-only" htmlFor="tv-new-password">Nova senha</label>
                  <input id="tv-new-password" type="password" name="password" autoComplete="new-password" placeholder="Nova senha" minLength={8} maxLength={200} required disabled={pending} />
                  <label className="sr-only" htmlFor="tv-confirm-password">Confirmar nova senha</label>
                  <input id="tv-confirm-password" type="password" name="confirmation" autoComplete="new-password" placeholder="Confirmar nova senha" required disabled={pending} />
                </div>
                {error ? <p className="tv-acc-error" role="alert">{error}</p> : null}
                <div className="tv-acc-form-actions">
                  <button type="button" className="is-cancel" disabled={pending} onClick={cancelPassword}>Cancelar</button>
                  <button type="submit" disabled={pending}>{pending ? <><SpinnerRing decorative />Alterando…</> : 'Alterar senha'}</button>
                </div>
              </form>
            </m.div> : null}
          </AnimatePresence>
        </div>
      </section>
    </Stagger>
  </div>
}
