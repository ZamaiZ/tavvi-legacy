'use client'

import type { CSSProperties, ReactNode } from 'react'
import { FcGoogle } from 'react-icons/fc'
import { LuBookOpen, LuInstagram, LuMapPin, LuMessageCircle, LuMessageSquareText, LuPhone } from 'react-icons/lu'
import type { ThemeChoice } from '@/domain/theme'
import { ALL_THEME_FONT_VARIABLES } from '@/lib/fonts'
import { publicMediaUrl } from '@/lib/media-url'
import { resolveTheme } from '@/lib/theme/resolve'
import type { PreviewMode } from './floating-restaurant-preview'

type Action = { key: string; label: string; icon: ReactNode }

// Os valores são cores, comprimentos e variáveis de fonte vindos dos presets
// ou já validados pelo `themeSchema`; nada digitado pelo cliente entra aqui.
function toCss(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([name, value]) => `${name}:${value}`)
    .join(';')
}

// A tela inicial do cardápio como o cliente a vê: contatos em ícones,
// endereço e a lista de ações, no tema do restaurante — nunca o dourado do
// painel.
export function ContactPreview({
  theme,
  name,
  description,
  phone,
  whatsapp,
  instagram,
  address,
  mapsUrl,
  coverPath,
  reviewActive,
  mode,
}: {
  theme: ThemeChoice
  name: string
  description: string
  phone: string
  whatsapp: string
  instagram: string
  address: string
  /** Com link do Maps, "Como chegar" aparece mesmo sem endereço. */
  mapsUrl: string
  coverPath: string | null
  /** Mesmo critério do cardápio: link gerado do Maps salvo. */
  reviewActive: boolean
  // Sem `mode`, a face acompanha o tema do painel. O popover do celular
  // continua passando a face escolhida no seletor dele.
  mode?: PreviewMode
}) {
  const resolved = resolveTheme(theme)
  const handle = instagram.trim().replace(/^@+/, '')
  const candidates: (Action | null)[] = [
    phone.trim() ? { key: 'phone', label: 'Ligar', icon: <LuPhone aria-hidden="true" /> } : null,
    whatsapp.trim() ? { key: 'whatsapp', label: 'WhatsApp', icon: <LuMessageCircle aria-hidden="true" /> } : null,
    handle ? { key: 'instagram', label: `@${handle}`, icon: <LuInstagram aria-hidden="true" /> } : null,
    address.trim() || mapsUrl.trim() ? { key: 'address', label: 'Como chegar', icon: <LuMapPin aria-hidden="true" /> } : null,
  ]
  const actions = candidates.filter((action): action is Action => action !== null)
  const style = mode
    ? ((mode === 'light' ? resolved.styleLight : resolved.styleDark) as CSSProperties)
    : undefined

  return (
    <div className="tv-preview-phone">
      {mode ? null : (
        // Por folha, e não por `style`: só a regra consegue acompanhar a
        // classe `.dark` do painel sem esperar a hidratação.
        <style
          dangerouslySetInnerHTML={{
            __html: `.tv-contact-phone-screen{${toCss(resolved.styleLight)}}.dark .tv-contact-phone-screen{${toCss(resolved.styleDark)}}`,
          }}
        />
      )}
      <div className={`tv-preview-phone-screen tv-contact-phone-screen ${ALL_THEME_FONT_VARIABLES}`} style={style}>
        <div className="tv-contact-phone-cover">
          {coverPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={publicMediaUrl('image', coverPath)} alt="" />
          ) : null}
        </div>
        <div className="tv-contact-phone-intro">
          <strong>{name.trim() || 'Seu restaurante'}</strong>
          {description.trim() ? <span>{description}</span> : null}
        </div>
        {actions.length > 0 ? (
          <div className="tv-contact-phone-icons">
            {actions.map((action) => (
              <span key={action.key} title={action.label}>{action.icon}</span>
            ))}
          </div>
        ) : null}
        {address.trim() ? <span className="tv-contact-phone-address">{address}</span> : null}
        <div className="tv-contact-phone-list">
          {reviewActive ? (
            <span><span className="tv-contact-phone-list-icon is-brand"><FcGoogle aria-hidden="true" /></span>Avaliar no Google</span>
          ) : null}
          <span><span className="tv-contact-phone-list-icon"><LuBookOpen aria-hidden="true" /></span>Ver cardápio</span>
          <span><span className="tv-contact-phone-list-icon"><LuMessageSquareText aria-hidden="true" /></span>Deixar feedback anônimo</span>
        </div>
      </div>
    </div>
  )
}
