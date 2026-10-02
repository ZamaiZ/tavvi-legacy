'use client'

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import { LuMap, LuMapPin } from 'react-icons/lu'
import { Combobox } from '@/components/ui/combobox'
import { Spinner } from '@/components/ui/spinner'
import { UF_CODES } from '@/domain/restaurant'
import {
  isAddressEmpty,
  maskCep,
  previewAddress,
  type AddressDraft,
  type AddressErrors,
} from '@/features/workspace/lib/address-draft'
import { lookupCepAction } from '@/server/actions/address'

const UF_OPTIONS = UF_CODES.map((uf) => ({ value: uf, label: uf }))

type Notice = { tone: 'error' | 'info'; text: string }

// Card "Endereço" do Contato e do passo 3 do assistente. O CEP busca sozinho
// ao completar 8 dígitos; o resto vem dos Correios e fica editável onde os
// Correios costumam falhar (rua e bairro de CEP de cidade inteira).
export function AddressFields({
  value,
  legacyAddress,
  mapsUrl,
  errors,
  mapsError,
  disabled,
  onChange,
  onMapsUrlChange,
  onRemove,
  reviewStatus,
}: {
  value: AddressDraft
  legacyAddress: string | null
  mapsUrl: string
  errors: AddressErrors
  mapsError?: string
  disabled: boolean
  /** Recebe um atualizador: a busca termina depois de outras teclas. */
  onChange: (change: (current: AddressDraft) => AddressDraft) => void
  onMapsUrlChange: (value: string) => void
  onRemove: () => void
  /** Status do link "Avaliar no Google", abaixo do campo do Maps. */
  reviewStatus?: ReactNode
}) {
  const [looking, startLookup] = useTransition()
  const [notice, setNotice] = useState<Notice | null>(null)
  // A resposta só vale se for do ÚLTIMO CEP digitado. Sem isto, uma busca
  // lenta de um CEP corrigido sobrescreveria o endereço do CEP certo.
  const sequence = useRef(0)
  const numberRef = useRef<HTMLInputElement>(null)
  const focusNumberAfterLookup = useRef(false)
  const locked = disabled || looking
  const preview = previewAddress(value)

  // O foco vai para Número só depois de a busca destravar os campos, e só
  // com mouse: no celular isso abriria o teclado sem a pessoa pedir.
  useEffect(() => {
    if (looking || !focusNumberAfterLookup.current) return
    focusNumberAfterLookup.current = false
    numberRef.current?.focus()
  }, [looking])

  function changeCep(raw: string) {
    const cep = maskCep(raw)
    onChange((current) => ({ ...current, cep }))
    setNotice(null)
    const digits = cep.replace(/\D/g, '')
    const ticket = ++sequence.current
    if (digits.length !== 8) return

    startLookup(async () => {
      const result = await lookupCepAction(digits)
      if (ticket !== sequence.current) return
      if (!result.ok) {
        setNotice({ tone: 'error', text: result.error })
        return
      }
      if (result.data.kind === 'unavailable') {
        setNotice({ tone: 'error', text: result.data.message })
        onChange((current) => ({ ...current, manual: true }))
        return
      }
      const found = result.data.address
      // CEP novo troca rua, bairro, cidade e UF; número e complemento ficam,
      // para quem só corrigiu um dígito.
      onChange((current) => ({
        ...current,
        street: found.street,
        district: found.district,
        city: found.city,
        state: found.state,
        manual: false,
      }))
      if (!found.street || !found.district) {
        setNotice({ tone: 'info', text: 'Este CEP vale para a cidade inteira. Preencha a rua e o bairro.' })
      }
      focusNumberAfterLookup.current = window.matchMedia('(pointer: fine)').matches
    })
  }

  const empty = isAddressEmpty(value)

  return (
    <section className="tv-contact-card" aria-labelledby="contact-address-title">
      <div className="tv-contact-card-head">
        <h2 id="contact-address-title">Endereço</h2>
        <p>Busque pelo CEP; rua, bairro e cidade vêm dos Correios.</p>
      </div>

      {legacyAddress && empty ? (
        <p className="tv-contact-note">
          Endereço atual: <strong>{legacyAddress}</strong>. Busque pelo CEP para atualizá-lo.
        </p>
      ) : null}

      <div className="tv-contact-grid">
        <div className="tv-contact-field">
          <label htmlFor="address-cep" className="tv-contact-label">CEP</label>
          <span className="tv-contact-input tv-contact-control" data-invalid={errors.cep ? '' : undefined}>
            <LuMapPin aria-hidden="true" />
            <input
              id="address-cep"
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="00000-000"
              maxLength={9}
              value={value.cep}
              disabled={disabled}
              aria-invalid={errors.cep ? true : undefined}
              aria-describedby={notice ? 'address-cep-notice' : undefined}
              onChange={(event) => changeCep(event.target.value)}
            />
            {looking ? <Spinner className="size-3.5" aria-label="Buscando o CEP" /> : null}
          </span>
          {errors.cep ? <span className="tv-contact-field-error">{errors.cep}</span> : null}
        </div>

        <div className="tv-contact-field">
          <label htmlFor="address-number" className="tv-contact-label">Número</label>
          <div className="tv-contact-number">
            <input
              ref={numberRef}
              id="address-number"
              className="tv-contact-input"
              inputMode="numeric"
              maxLength={10}
              value={value.noNumber ? 'S/N' : value.number}
              disabled={locked || value.noNumber}
              aria-invalid={errors.number ? true : undefined}
              onChange={(event) => onChange((current) => ({ ...current, number: event.target.value }))}
            />
            <label className="tv-contact-check">
              <input
                type="checkbox"
                checked={value.noNumber}
                disabled={locked}
                onChange={(event) => onChange((current) => ({ ...current, noNumber: event.target.checked }))}
              />
              Sem número
            </label>
          </div>
          {errors.number ? <span className="tv-contact-field-error">{errors.number}</span> : null}
        </div>
      </div>

      <div className="tv-contact-field">
        <label htmlFor="address-street" className="tv-contact-label">Rua</label>
        <input
          id="address-street"
          className="tv-contact-input"
          autoComplete="address-line1"
          maxLength={120}
          value={value.street}
          disabled={locked}
          aria-invalid={errors.street ? true : undefined}
          onChange={(event) => onChange((current) => ({ ...current, street: event.target.value }))}
        />
        {errors.street ? <span className="tv-contact-field-error">{errors.street}</span> : null}
      </div>

      <div className="tv-contact-grid">
        <div className="tv-contact-field">
          <label htmlFor="address-complement" className="tv-contact-label">Complemento (opcional)</label>
          <input
            id="address-complement"
            className="tv-contact-input"
            autoComplete="address-line2"
            maxLength={60}
            placeholder="Loja 2, Apto 12"
            value={value.complement}
            disabled={locked}
            aria-invalid={errors.complement ? true : undefined}
            onChange={(event) => onChange((current) => ({ ...current, complement: event.target.value }))}
          />
          {errors.complement ? <span className="tv-contact-field-error">{errors.complement}</span> : null}
        </div>
        <div className="tv-contact-field">
          <label htmlFor="address-district" className="tv-contact-label">Bairro</label>
          <input
            id="address-district"
            className="tv-contact-input"
            maxLength={80}
            value={value.district}
            disabled={locked}
            aria-invalid={errors.district ? true : undefined}
            onChange={(event) => onChange((current) => ({ ...current, district: event.target.value }))}
          />
          {errors.district ? <span className="tv-contact-field-error">{errors.district}</span> : null}
        </div>
      </div>

      {value.manual ? (
        <div className="tv-contact-grid">
          <div className="tv-contact-field">
            <label htmlFor="address-city" className="tv-contact-label">Cidade</label>
            <input
              id="address-city"
              className="tv-contact-input"
              maxLength={80}
              value={value.city}
              disabled={locked}
              aria-invalid={errors.city ? true : undefined}
              onChange={(event) => onChange((current) => ({ ...current, city: event.target.value }))}
            />
            {errors.city ? <span className="tv-contact-field-error">{errors.city}</span> : null}
          </div>
          <div className="tv-contact-field">
            <span className="tv-contact-label">UF</span>
            <Combobox
              label="UF"
              options={UF_OPTIONS}
              value={value.state || null}
              onValueChange={(state) => onChange((current) => ({ ...current, state }))}
              disabled={locked}
            />
            {errors.state ? <span className="tv-contact-field-error">{errors.state}</span> : null}
          </div>
        </div>
      ) : value.city ? (
        <p className="tv-contact-city">
          <span>Cidade / UF</span>
          <strong>{value.city} / {value.state}</strong>
        </p>
      ) : null}

      {notice ? (
        <p
          id="address-cep-notice"
          role={notice.tone === 'error' ? 'alert' : 'status'}
          className={`tv-contact-notice is-${notice.tone}`}
        >
          {notice.text}
        </p>
      ) : null}

      {preview ? (
        <div className="tv-contact-preview-line">
          <span>Como aparece no cardápio</span>
          <p>{preview}</p>
        </div>
      ) : null}

      <div className="tv-contact-field">
        <label htmlFor="address-maps" className="tv-contact-label">Perfil no Google Maps (opcional)</label>
        <span className="tv-contact-input tv-contact-control" data-invalid={mapsError ? '' : undefined}>
          <LuMap aria-hidden="true" />
          <input
            id="address-maps"
            type="url"
            inputMode="url"
            maxLength={500}
            placeholder="https://maps.app.goo.gl/…"
            value={mapsUrl}
            disabled={disabled}
            aria-invalid={mapsError ? true : undefined}
            aria-describedby="address-maps-help"
            onChange={(event) => onMapsUrlChange(event.target.value)}
          />
        </span>
        <span id="address-maps-help" className="tv-contact-help">
          No Google Maps, abra o perfil do restaurante → Compartilhar → Copiar link.
        </span>
        {reviewStatus}
        {mapsError ? <span className="tv-contact-field-error">{mapsError}</span> : null}
      </div>

      {!empty || legacyAddress ? (
        <button type="button" className="tv-contact-link" disabled={locked} onClick={onRemove}>
          Remover endereço
        </button>
      ) : null}
    </section>
  )
}
