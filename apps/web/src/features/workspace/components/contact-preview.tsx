'use client'

import type { CSSProperties } from 'react'
import { RiInstagramLine, RiMapPinLine, RiPhoneLine, RiWhatsappLine } from 'react-icons/ri'
import type { ThemeChoice } from '@/domain/theme'
import { resolveTheme } from '@/lib/theme/resolve'
import { PhonePreviewFrame, type PreviewMode } from './floating-restaurant-preview'
import '@/features/public-menu/styles/menu.css'

export function ContactPreview({
  theme,
  name,
  description,
  phone,
  whatsapp,
  instagram,
  address,
  mode,
}: {
  theme: ThemeChoice
  name: string
  description: string
  phone: string
  whatsapp: string
  instagram: string
  address: string
  mode: PreviewMode
}) {
  const resolved = resolveTheme(theme)
  const style = (mode === 'light' ? resolved.styleLight : resolved.styleDark) as CSSProperties
  const channels = [
    phone ? { label: 'Telefone', value: phone, icon: <RiPhoneLine aria-hidden="true" /> } : null,
    whatsapp ? { label: 'WhatsApp', value: whatsapp, icon: <RiWhatsappLine aria-hidden="true" /> } : null,
    instagram ? { label: 'Instagram', value: `@${instagram.replace(/^@+/, '')}`, icon: <RiInstagramLine aria-hidden="true" /> } : null,
    address ? { label: 'Endereço', value: address, icon: <RiMapPinLine aria-hidden="true" /> } : null,
  ].filter((channel) => channel !== null)

  return (
    <PhonePreviewFrame mode={mode} density={resolved.density} style={style}>
      <div
        className="h-24 w-full"
        style={{
          background:
            'linear-gradient(150deg, color-mix(in oklab, var(--m-accent) 70%, var(--m-base)), var(--m-base))',
        }}
      />
      <div className="px-3 pb-5">
        <h3 className="menu-display -mt-2 text-base font-semibold leading-tight">
          {name || 'Seu restaurante'}
        </h3>
        {description.trim() ? (
          <p className="menu-muted mt-2 text-[0.6875rem] leading-relaxed">{description}</p>
        ) : null}
        {channels.length > 0 ? (
          <section className="pt-5">
            <h4 className="menu-display menu-accent text-[0.5625rem] font-bold uppercase tracking-[0.18em]">
              Encontre e fale com a gente
            </h4>
            <ul className="menu-list menu-line mt-2 divide-y" style={{ borderColor: 'var(--m-line)' }}>
              {channels.map((channel) => (
                <li key={channel.label} className="menu-item flex items-start gap-2 py-2">
                  <span className="menu-accent mt-0.5 shrink-0">{channel.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="menu-display block text-[0.6875rem] font-semibold">{channel.label}</span>
                    <span className="menu-muted mt-0.5 block break-words text-[0.625rem] leading-snug">{channel.value}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </PhonePreviewFrame>
  )
}
