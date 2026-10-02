'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LuArrowLeftRight, LuChevronRight, LuContact, LuLogOut, LuMoon, LuPalette } from 'react-icons/lu'
import { AccountNameAction } from '@/components/shell/account-name-action'
import { useSignOut } from '@/components/shell/account-panel'
import { PwaInstallAction } from '@/components/pwa/pwa-install-action'
import { PwaNotificationsAction } from '@/components/pwa/pwa-notifications-action'
import { useRestaurantShell } from '@/components/shell/console-shell'
import { useTheme } from '@/components/theme/theme-provider'
import { markStackedFromList } from '@/lib/viewport'
import { PanelConfirm } from '../panel-confirm'
import { SwitchRestaurantSheet } from './switch-restaurant-sheet'
import { THEME_LABELS, ThemeSheet } from './theme-sheet'

// Ajustes (Tavvi Mobile.dc.html, bMore). Só existe no celular: no desktop a
// sidebar e o popover de conta fazem esse papel, e a rota volta ao Cardápio.
export function SettingsMobile() {
  const router = useRouter()
  const { restaurantId, canEdit, restaurants, email, name } = useRestaurantShell()
  const { theme } = useTheme()
  const { pending, signOut } = useSignOut()
  const [themeOpen, setThemeOpen] = useState(false)
  const [switchOpen, setSwitchOpen] = useState(false)
  const [signOutOpen, setSignOutOpen] = useState(false)
  const root = `/restaurantes/${restaurantId}`

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 768px)')
    const leave = () => { if (desktop.matches) router.replace(root) }
    leave()
    desktop.addEventListener('change', leave)
    return () => desktop.removeEventListener('change', leave)
  }, [root, router])

  // Identidade e Contato são telas empilhadas: o "‹ Ajustes" delas volta no
  // histórico quando foi Ajustes que as abriu.
  function stack(href: string) {
    return () => markStackedFromList(href)
  }

  return (
    <div className="tv-mp tv-msettings">
      <h1 className="tv-mp-title">Ajustes</h1>

      {canEdit ? (
        <div className="tv-group">
          <Link href={`${root}/identidade`} className="tv-mlink" onClick={stack(`${root}/identidade`)}>
            <span className="tv-mlink-icon is-gold" aria-hidden="true"><LuPalette /></span>
            <span className="tv-mlink-copy"><span>Identidade</span><small>Marca, cores, fontes e imagens</small></span>
            <LuChevronRight aria-hidden="true" />
          </Link>
          <Link href={`${root}/contato`} className="tv-mlink" onClick={stack(`${root}/contato`)}>
            <span className="tv-mlink-icon is-gold" aria-hidden="true"><LuContact /></span>
            <span className="tv-mlink-copy"><span>Contato</span><small>Informações públicas do restaurante</small></span>
            <LuChevronRight aria-hidden="true" />
          </Link>
        </div>
      ) : null}

      <AccountNameAction variant="row" name={name} />

      <div className="tv-group">
        {restaurants.length > 1 ? (
          <button type="button" className="tv-mlink" aria-haspopup="dialog" onClick={() => setSwitchOpen(true)}>
            <span className="tv-mlink-icon" aria-hidden="true"><LuArrowLeftRight /></span>
            <span className="tv-mlink-copy"><span>Trocar de restaurante</span></span>
            <LuChevronRight aria-hidden="true" />
          </button>
        ) : null}
        <button type="button" className="tv-mlink" aria-haspopup="dialog" onClick={() => setThemeOpen(true)}>
          <span className="tv-mlink-icon" aria-hidden="true"><LuMoon /></span>
          <span className="tv-mlink-copy"><span>Tema</span></span>
          <span className="tv-mlink-value">{THEME_LABELS[theme]}</span>
          <LuChevronRight aria-hidden="true" />
        </button>
      </div>

      <PwaInstallAction variant="row" />
      <PwaNotificationsAction variant="row" />

      <div className="tv-group">
        <button type="button" className="tv-group-danger" disabled={pending} onClick={() => setSignOutOpen(true)}>
          <LuLogOut aria-hidden="true" />{pending ? 'Saindo…' : 'Sair'}
        </button>
      </div>

      {email ? <p className="tv-msettings-email">{email}</p> : null}

      <ThemeSheet open={themeOpen} onOpenChange={setThemeOpen} />
      {restaurants.length > 1 ? <SwitchRestaurantSheet open={switchOpen} onOpenChange={setSwitchOpen} /> : null}
      <PanelConfirm
        open={signOutOpen}
        onOpenChange={setSignOutOpen}
        icon={<LuLogOut />}
        title="Sair da conta?"
        description="Você precisará entrar novamente para acessar o painel."
        confirmLabel="Sair"
        pendingLabel="Saindo…"
        pending={pending}
        destructive
        onConfirm={signOut}
      />
    </div>
  )
}
