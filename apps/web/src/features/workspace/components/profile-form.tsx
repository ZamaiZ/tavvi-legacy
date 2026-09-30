'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { LuInstagram, LuMapPin, LuMessageCircle, LuPhone } from 'react-icons/lu'
import { ContactPreview } from '@/features/workspace/components/contact-preview'
import { FloatingRestaurantPreview } from '@/features/workspace/components/floating-restaurant-preview'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import type { ActionResult } from '@/server/actions/result'
import type { ThemeChoice } from '@/domain/theme'
import { updateRestaurantProfileAction } from '@/server/actions/restaurants'

type State = ActionResult | undefined

type ProfileValues = { name: string; description: string; phone: string; whatsapp: string; instagram: string; address: string }

function digits(value: string) { return value.replace(/\D/g, '') }

function displayPhone(value: string) {
  let local = digits(value)
  if (local.startsWith('55') && local.length > 11) local = local.slice(2)
  if (local.length <= 2) return local ? `(${local}` : ''
  const ddd = local.slice(0, 2)
  const number = local.slice(2, 11)
  if (number.length <= 4) return `(${ddd}) ${number}`
  if (number.length <= 8) return `(${ddd}) ${number.slice(0, 4)}-${number.slice(4)}`
  return `(${ddd}) ${number.slice(0, 5)}-${number.slice(5)}`
}

function canonicalPhone(value: string) {
  const number = digits(value)
  if (!number) return undefined
  // Os campos sempre exibem o número nacional sem o código do país, inclusive
  // quando o registro carregado já era canônico. Assim, DDD 55 não é confundido
  // com prefixo internacional e o país é acrescentado uma única vez.
  return `55${number}`
}

export function ProfileForm({
  restaurantId,
  name,
  description,
  contact,
  theme,
  coverPath,
}: {
  restaurantId: string
  name: string
  description: string | null
  contact: Record<string, string>
  theme: ThemeChoice
  coverPath: string | null
}) {
  const original = useMemo<ProfileValues>(() => ({
    name,
    description: description ?? '',
    phone: displayPhone(contact.phone ?? ''),
    whatsapp: displayPhone(contact.whatsapp ?? ''),
    instagram: (contact.instagram ?? '').replace(/^@+/, ''),
    address: contact.address ?? '',
  }), [name, description, contact])
  const [values, setValues] = useState(original)
  const [saved, setSaved] = useState(original)
  const valuesRef = useRef(values)
  const dirty = (Object.keys(saved) as (keyof ProfileValues)[]).some((key) => values[key] !== saved[key])

  const [state, formAction, pending] = useActionState<State, FormData>(
    async (_prev, formData) => {
      const phone = String(formData.get('phone') ?? '')
      const whatsapp = String(formData.get('whatsapp') ?? '')
      const phoneDigits = digits(phone)
      const whatsappDigits = digits(whatsapp)
      if (phoneDigits && phoneDigits.length !== 10 && phoneDigits.length !== 11) return { ok: false, error: 'Informe um telefone com DDD e 10 ou 11 dígitos.' }
      if (whatsappDigits && whatsappDigits.length !== 10 && whatsappDigits.length !== 11) return { ok: false, error: 'Informe um WhatsApp com DDD e 10 ou 11 dígitos.' }
      return updateRestaurantProfileAction({
        restaurantId,
        name: formData.get('name'),
        description: formData.get('description') || undefined,
        contact: {
          phone: canonicalPhone(phone),
          whatsapp: canonicalPhone(whatsapp),
          instagram: String(formData.get('instagram') ?? '').trim().replace(/^@+/, '') || undefined,
          address: formData.get('address') || undefined,
        },
      })
    },
    undefined,
  )

  useEffect(() => {
    if (state?.ok) {
      setSaved(valuesRef.current)
      toast.add({ title: 'Dados salvos', type: 'success' })
    }
  }, [state])

  function update(key: keyof ProfileValues, value: string) {
    const next = { ...valuesRef.current, [key]: value }
    valuesRef.current = next
    setValues(next)
  }

  function discard() {
    valuesRef.current = saved
    setValues(saved)
  }

  const preview = {
    theme,
    name: values.name,
    description: values.description,
    phone: values.phone,
    whatsapp: values.whatsapp,
    instagram: values.instagram,
    address: values.address,
    coverPath,
  }

  return (
    <>
    <div className="tv-contact-layout">
      <form action={formAction} className="tv-contact-form">
        <section className="tv-contact-card">
          <div className="tv-contact-card-head">
            <h2>Sobre</h2>
            <p>Informações que apresentam o restaurante.</p>
          </div>
          <label className="tv-contact-field">
            <span className="tv-contact-label">Nome</span>
            <input
              id="name"
              name="name"
              className="tv-contact-input"
              value={values.name}
              onChange={(event) => update('name', event.target.value)}
              required
            />
          </label>
          <div className="tv-contact-field">
            <label htmlFor="description" className="tv-contact-label">Descrição</label>
            <textarea
              id="description"
              name="description"
              className="tv-contact-input tv-contact-textarea"
              rows={3}
              maxLength={500}
              aria-describedby="description-count"
              value={values.description}
              onChange={(event) => update('description', event.target.value)}
            />
            <span id="description-count" className="tv-contact-count">{values.description.length}/500</span>
          </div>
        </section>
        <section className="tv-contact-card">
          <div className="tv-contact-card-head">
            <h2>Canais</h2>
            <p>Telefone e WhatsApp são guardados com o código do Brasil (55).</p>
          </div>
          {/* Os mesmos ícones dos atalhos da prévia: o dono reconhece o que
              preenche quando vê o resultado na tela do cliente. O rótulo
              envolve a caixa inteira, então clicar no ícone foca o campo. */}
          <label className="tv-contact-field">
            <span className="tv-contact-label">Telefone</span>
            <span className="tv-contact-input tv-contact-control">
              <LuPhone aria-hidden="true" />
              <input
                id="phone"
                name="phone"
                inputMode="tel"
                value={values.phone}
                onChange={(event) => update('phone', displayPhone(event.target.value))}
              />
            </span>
          </label>
          <label className="tv-contact-field">
            <span className="tv-contact-label">WhatsApp</span>
            <span className="tv-contact-input tv-contact-control">
              <LuMessageCircle aria-hidden="true" />
              <input
                id="whatsapp"
                name="whatsapp"
                inputMode="tel"
                value={values.whatsapp}
                onChange={(event) => update('whatsapp', displayPhone(event.target.value))}
              />
            </span>
          </label>
          <label className="tv-contact-field">
            <span className="tv-contact-label">Instagram</span>
            <span className="tv-contact-input tv-contact-control">
              <LuInstagram aria-hidden="true" />
              <span className="tv-contact-prefix" aria-hidden="true">@</span>
              <input
                id="instagram"
                name="instagram"
                value={values.instagram}
                onChange={(event) => update('instagram', event.target.value.replace(/^@+/, ''))}
                maxLength={60}
                pattern="[A-Za-z0-9._]{1,60}"
                title="Use apenas letras, números, ponto e sublinhado."
              />
            </span>
          </label>
        </section>
        <section className="tv-contact-card">
          <div className="tv-contact-card-head">
            <h2>Endereço</h2>
            <p>Um campo simples para o endereço exibido no cardápio.</p>
          </div>
          <label className="tv-contact-field">
            <span className="tv-contact-label">Endereço físico</span>
            <span className="tv-contact-input tv-contact-control">
              <LuMapPin aria-hidden="true" />
              <input
                id="address"
                name="address"
                value={values.address}
                onChange={(event) => update('address', event.target.value)}
                maxLength={200}
              />
            </span>
          </label>
        </section>

        {state && !state.ok ? (
          <p role="alert" className="tv-contact-error">
            {state.error}
          </p>
        ) : null}

        <div className="tv-contact-savebar">
          <span aria-live="polite">{dirty ? 'Alterações não salvas' : 'Tudo salvo'}</span>
          <div>
            {dirty ? (
              <button type="button" className="tv-contact-discard" disabled={pending} onClick={discard}>
                Descartar
              </button>
            ) : null}
            <button type="submit" className="tv-contact-save" disabled={pending || !dirty} aria-busy={pending}>
              {pending ? <Spinner className="size-3.5" /> : null}
              {pending ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      </form>
      <aside className="tv-contact-preview" aria-labelledby="contact-preview-label">
        <span id="contact-preview-label" className="tv-contact-preview-label">Prévia do cardápio</span>
        <ContactPreview {...preview} />
      </aside>
    </div>
    {/* Abaixo de 1024 px não cabe a coluna da prévia: volta o botão
        flutuante, com o mesmo celular dentro. */}
    <div className="tv-contact-floating">
      <FloatingRestaurantPreview renderPreview={(mode) => <ContactPreview {...preview} mode={mode} />} />
    </div>
    </>
  )
}
