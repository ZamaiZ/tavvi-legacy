'use client'

import { useMemo, useRef, useState, useTransition, type FormEvent } from 'react'
import { LuInstagram, LuMessageCircle, LuPhone } from 'react-icons/lu'
import { AddressFields } from '@/features/workspace/components/address-fields'
import { ContactPreview } from '@/features/workspace/components/contact-preview'
import { FloatingRestaurantPreview } from '@/features/workspace/components/floating-restaurant-preview'
import {
  addressToDraft,
  draftToAddress,
  EMPTY_ADDRESS,
  previewAddress,
  type AddressDraft,
  type AddressErrors,
} from '@/features/workspace/lib/address-draft'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { isGoogleMapsUrl, MAPS_URL_ERROR, type RestaurantContact } from '@/domain/restaurant'
import type { ThemeChoice } from '@/domain/theme'
import { updateRestaurantProfileAction } from '@/server/actions/restaurants'

type ProfileValues = {
  name: string
  description: string
  phone: string
  whatsapp: string
  instagram: string
  address: AddressDraft
  legacyAddress: string | null
  mapsUrl: string
}

type FieldErrors = {
  name?: string
  phone?: string
  whatsapp?: string
  mapsUrl?: string
  address?: AddressErrors
}

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
  continueLabel,
  busy,
  onSaved,
}: {
  restaurantId: string
  name: string
  description: string | null
  contact: RestaurantContact
  theme: ThemeChoice
  coverPath: string | null
  /** Assistente: o botão vira "Salvar e continuar" e, sem mudanças, só continua. */
  continueLabel?: string
  /** Algo fora do formulário está rodando (o assistente navegando). */
  busy?: boolean
  onSaved?: () => void
}) {
  const original = useMemo<ProfileValues>(() => ({
    name,
    description: description ?? '',
    phone: displayPhone(contact.phone ?? ''),
    whatsapp: displayPhone(contact.whatsapp ?? ''),
    instagram: (contact.instagram ?? '').replace(/^@+/, ''),
    address: addressToDraft(contact.address),
    legacyAddress: contact.legacyAddress ?? null,
    mapsUrl: contact.mapsUrl ?? '',
  }), [name, description, contact])
  const [values, setValues] = useState(original)
  const [saved, setSaved] = useState(original)
  const valuesRef = useRef(values)
  const [pending, startTransition] = useTransition()
  const locked = pending || busy === true
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const dirty = JSON.stringify(values) !== JSON.stringify(saved)

  function update<K extends keyof ProfileValues>(key: K, value: ProfileValues[K]) {
    const next = { ...valuesRef.current, [key]: value }
    valuesRef.current = next
    setValues(next)
  }

  function discard() {
    valuesRef.current = saved
    setValues(saved)
    setFieldErrors({})
    setError(null)
  }

  function removeAddress() {
    const next = { ...valuesRef.current, address: EMPTY_ADDRESS, legacyAddress: null }
    valuesRef.current = next
    setValues(next)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (locked) return
    if (!dirty) {
      if (continueLabel) onSaved?.()
      return
    }

    const current = valuesRef.current
    const errors: FieldErrors = {}
    if (current.name.trim().length < 2) errors.name = 'Mínimo de 2 caracteres.'
    const phoneDigits = digits(current.phone)
    const whatsappDigits = digits(current.whatsapp)
    if (phoneDigits && phoneDigits.length !== 10 && phoneDigits.length !== 11) {
      errors.phone = 'Informe um telefone com DDD e 10 ou 11 dígitos.'
    }
    if (whatsappDigits && whatsappDigits.length !== 10 && whatsappDigits.length !== 11) {
      errors.whatsapp = 'Informe um WhatsApp com DDD e 10 ou 11 dígitos.'
    }
    const mapsUrl = current.mapsUrl.trim()
    if (mapsUrl && !isGoogleMapsUrl(mapsUrl)) errors.mapsUrl = MAPS_URL_ERROR
    const address = draftToAddress(current.address)
    if (!address.ok) errors.address = address.errors

    if (Object.keys(errors).length > 0 || !address.ok) {
      setFieldErrors(errors)
      setError('Revise os campos destacados.')
      return
    }

    setFieldErrors({})
    setError(null)
    const structured = address.address
    startTransition(async () => {
      const result = await updateRestaurantProfileAction({
        restaurantId,
        name: current.name,
        description: current.description || undefined,
        contact: {
          phone: canonicalPhone(current.phone),
          whatsapp: canonicalPhone(current.whatsapp),
          instagram: current.instagram.trim().replace(/^@+/, '') || undefined,
          address: structured,
          legacyAddress: structured ? undefined : (current.legacyAddress ?? undefined),
          mapsUrl: mapsUrl || undefined,
        },
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      // O endereço do CEP substitui o texto antigo: a tela passa a refletir
      // o que foi gravado, e não o aviso de "endereço atual".
      const persisted = structured ? { ...current, legacyAddress: null } : current
      valuesRef.current = persisted
      setValues(persisted)
      setSaved(persisted)
      toast.add({ title: 'Dados salvos', type: 'success' })
      onSaved?.()
    })
  }

  const preview = {
    theme,
    name: values.name,
    description: values.description,
    phone: values.phone,
    whatsapp: values.whatsapp,
    instagram: values.instagram,
    address: previewAddress(values.address) ?? values.legacyAddress ?? '',
    mapsUrl: values.mapsUrl.trim(),
    coverPath,
  }
  const saveLabel = continueLabel ?? 'Salvar'

  return (
    <>
    <div className="tv-contact-layout">
      <form onSubmit={submit} className="tv-contact-form" aria-busy={pending || undefined} noValidate>
        {/* Um fieldset desabilita todos os campos nativos de uma vez enquanto
            salva: digitar durante o envio faria o que está na tela divergir
            do que foi gravado. */}
        <fieldset disabled={locked} className="tv-contact-fieldset">
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
                maxLength={120}
                aria-invalid={fieldErrors.name ? true : undefined}
                onChange={(event) => update('name', event.target.value)}
              />
              {fieldErrors.name ? <span className="tv-contact-field-error">{fieldErrors.name}</span> : null}
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
              <span className="tv-contact-input tv-contact-control" data-invalid={fieldErrors.phone ? '' : undefined}>
                <LuPhone aria-hidden="true" />
                <input
                  id="phone"
                  name="phone"
                  inputMode="tel"
                  value={values.phone}
                  aria-invalid={fieldErrors.phone ? true : undefined}
                  onChange={(event) => update('phone', displayPhone(event.target.value))}
                />
              </span>
              {fieldErrors.phone ? <span className="tv-contact-field-error">{fieldErrors.phone}</span> : null}
            </label>
            <label className="tv-contact-field">
              <span className="tv-contact-label">WhatsApp</span>
              <span className="tv-contact-input tv-contact-control" data-invalid={fieldErrors.whatsapp ? '' : undefined}>
                <LuMessageCircle aria-hidden="true" />
                <input
                  id="whatsapp"
                  name="whatsapp"
                  inputMode="tel"
                  value={values.whatsapp}
                  aria-invalid={fieldErrors.whatsapp ? true : undefined}
                  onChange={(event) => update('whatsapp', displayPhone(event.target.value))}
                />
              </span>
              {fieldErrors.whatsapp ? <span className="tv-contact-field-error">{fieldErrors.whatsapp}</span> : null}
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
          <AddressFields
            value={values.address}
            legacyAddress={values.legacyAddress}
            mapsUrl={values.mapsUrl}
            errors={fieldErrors.address ?? {}}
            mapsError={fieldErrors.mapsUrl}
            disabled={locked}
            onChange={(change) => update('address', change(valuesRef.current.address))}
            onMapsUrlChange={(next) => update('mapsUrl', next)}
            onRemove={removeAddress}
          />
        </fieldset>

        {error ? (
          <p role="alert" className="tv-contact-error">
            {error}
          </p>
        ) : null}

        <div className="tv-contact-savebar">
          <span aria-live="polite">{pending ? 'Salvando…' : dirty ? 'Alterações não salvas' : 'Tudo salvo'}</span>
          <div>
            {dirty ? (
              <button type="button" className="tv-contact-discard" disabled={locked} onClick={discard}>
                Descartar
              </button>
            ) : null}
            <button
              type="submit"
              className="tv-contact-save"
              disabled={locked || (!dirty && !continueLabel)}
              aria-busy={pending || undefined}
            >
              {pending ? <Spinner className="size-3.5" aria-hidden="true" /> : null}
              {pending ? 'Salvando…' : saveLabel}
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
