'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ContactPreview } from '@/features/workspace/components/contact-preview'
import { FloatingRestaurantPreview } from '@/features/workspace/components/floating-restaurant-preview'
import {
  RiInstagramLine,
  RiMapPinLine,
  RiPhoneLine,
  RiWhatsappLine,
} from 'react-icons/ri'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { IconField } from '@/components/ui/field-icon'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
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
}: {
  restaurantId: string
  name: string
  description: string | null
  contact: Record<string, string>
  theme: ThemeChoice
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

  return (
    <>
    <form action={formAction} className="tv-profile-form space-y-4">
      <section className="tavvi-surface space-y-4 p-5 sm:p-6">
        <div><h2 className="text-lg font-semibold">Sobre</h2><p className="mt-1 text-sm text-muted-foreground">Informações que apresentam o restaurante.</p></div>
        <FieldGroup>
        <Field>
          <FieldLabel htmlFor="name">Nome</FieldLabel>
          <Input id="name" name="name" value={values.name} onChange={(event) => update('name', event.target.value)} required />
        </Field>
        <Field>
          <FieldLabel htmlFor="description">Descrição</FieldLabel>
          <Textarea
            id="description"
            name="description"
            rows={3}
            maxLength={500}
            value={values.description}
            onChange={(event) => update('description', event.target.value)}
          />
          <span className="text-right text-xs text-muted-foreground">{values.description.length}/500</span>
        </Field>
        </FieldGroup>
      </section>
      <section className="tavvi-surface space-y-4 p-5 sm:p-6">
        <div><h2 className="text-lg font-semibold">Canais</h2><p className="mt-1 text-sm text-muted-foreground">Telefone e WhatsApp são guardados com o código do Brasil (55).</p></div>
        <FieldGroup>
        {/* Os MESMOS ícones que vão para os atalhos do cardápio público. O
            dono reconhece o que está preenchendo, e reconhece de novo quando
            vê o resultado na tela do cliente. `IconField` já existia e já era
            usado em outra tela; aqui era campo sem ícone. */}
        <IconField
          id="phone"
          name="phone"
          label="Telefone"
          icon={<RiPhoneLine />}
          value={values.phone}
          onChange={(event) => update('phone', displayPhone(event.target.value))}
        />
        <IconField
          id="whatsapp"
          name="whatsapp"
          label="WhatsApp"
          icon={<RiWhatsappLine />}
          value={values.whatsapp}
          onChange={(event) => update('whatsapp', displayPhone(event.target.value))}
        />
        <IconField
          id="instagram"
          name="instagram"
          label="Instagram"
          icon={<RiInstagramLine />}
          value={values.instagram}
          onChange={(event) => update('instagram', event.target.value.replace(/^@+/, ''))}
          maxLength={60}
          pattern="[A-Za-z0-9._]{1,60}"
          title="Use apenas letras, números, ponto e sublinhado."
        />
        </FieldGroup>
      </section>
      <section className="tavvi-surface space-y-4 p-5 sm:p-6">
        <div><h2 className="text-lg font-semibold">Endereço</h2><p className="mt-1 text-sm text-muted-foreground">Um campo simples para o endereço exibido no cardápio.</p></div>
        <IconField
          id="address"
          name="address"
          label="Endereço físico"
          icon={<RiMapPinLine />}
          value={values.address}
          onChange={(event) => update('address', event.target.value)}
          maxLength={200}
        />
      </section>

      {state && !state.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="tv-profile-savebar">
        <span>{dirty ? 'Alterações não salvas' : 'Tudo salvo'}</span>
        <div className="flex gap-2">
          {dirty ? <Button type="button" variant="outline" disabled={pending} onClick={discard}>Descartar</Button> : null}
          <Button type="submit" disabled={pending || !dirty} className="min-w-36">
            {pending ? <Spinner className="size-4" /> : null}
            {pending ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </div>
    </form>
    <FloatingRestaurantPreview
      renderPreview={(mode) => <ContactPreview
        theme={theme}
        name={values.name}
        description={values.description}
        phone={values.phone}
        whatsapp={values.whatsapp}
        instagram={values.instagram}
        address={values.address}
        mode={mode}
      />}
    />
    </>
  )
}
