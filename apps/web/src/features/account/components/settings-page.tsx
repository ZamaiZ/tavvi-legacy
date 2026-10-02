'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { LuMonitorSmartphone } from 'react-icons/lu'
import { useTheme, type Theme } from '@/components/theme/theme-provider'
import { PageHeader } from '@/components/shell/page-header'
import { signOutEverywhereCopy, useSignOutEverywhere } from '@/components/shell/account-panel'
import { PanelConfirm } from '@/features/workspace/components/panel-confirm'
import { PwaNotificationsAction } from '@/components/pwa/pwa-notifications-action'
import { TestButton } from '@/features/notifications/components/notification-list'
import { Stagger } from '@/components/motion/reveal'

const themes: { value: Theme; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
]

export function SettingsPage({ showSessions }: { showSessions: boolean }) {
  const { theme, setTheme } = useTheme()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { pending, signOutEverywhere } = useSignOutEverywhere(() => setConfirmOpen(false))
  const themeRefs = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    document.querySelector<HTMLElement>('.tv-console-main h1, .tv-account-page h1')?.focus()
  }, [])

  function onThemeKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const next = (index + (event.key === 'ArrowRight' ? 1 : themes.length - 1)) % themes.length
    setTheme(themes[next].value)
    themeRefs.current[next]?.focus()
  }

  return <div className="tv-console-page tv-account-page">
    <PageHeader title="Configurações" description="Aparência, avisos e sessões." />
    <Stagger step={0.04} className="tv-account-sections">
      <section className="tv-acc-section">
        <h2>Aparência</h2>
        <div className="tv-acc-card tv-acc-themes" role="radiogroup" aria-label="Tema">
          {themes.map((option, index) => <button
            key={option.value}
            ref={(node) => { themeRefs.current[index] = node }}
            type="button"
            role="radio"
            aria-checked={theme === option.value}
            tabIndex={theme === option.value ? 0 : -1}
            className={`tv-acc-theme${theme === option.value ? ' is-selected' : ''}`}
            onClick={() => setTheme(option.value)}
            onKeyDown={(event) => onThemeKeyDown(event, index)}
          >
            <span className={`tv-acc-preview is-${option.value}`} aria-hidden="true">
              <span className="is-left"><i /><b /></span><span className="is-right"><i /><b /></span>
            </span>
            <span>{option.label}</span>
          </button>)}
        </div>
      </section>

      <section className="tv-acc-section">
        <h2>Notificações</h2>
        <div className="tv-notif-device is-page">
          <PwaNotificationsAction variant="group" />
          <TestButton variant="settings" />
        </div>
      </section>

      {showSessions ? <section className="tv-acc-section">
        <h2>Sessões</h2>
        <div className="tv-acc-card">
          <button type="button" className="tv-acc-session" disabled={pending} onClick={() => setConfirmOpen(true)}>
            <span className="tv-acc-icon is-neutral" aria-hidden="true"><LuMonitorSmartphone /></span>
            <span>Sair de todos os aparelhos</span>
          </button>
          <p className="tv-acc-foot">{signOutEverywhereCopy.description}</p>
        </div>
      </section> : null}
    </Stagger>
    <PanelConfirm
      open={confirmOpen}
      onOpenChange={setConfirmOpen}
      icon={<LuMonitorSmartphone />}
      title={signOutEverywhereCopy.title}
      description={signOutEverywhereCopy.description}
      confirmLabel={signOutEverywhereCopy.confirmLabel}
      pendingLabel={signOutEverywhereCopy.pendingLabel}
      destructive
      pending={pending}
      onConfirm={signOutEverywhere}
    />
  </div>
}
