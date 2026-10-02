import { addressSchema, formatAddress, type Address } from '@/domain/restaurant'

// O endereço como o formulário o edita: CEP com máscara, número separado do
// "Sem número", e `manual` quando o ViaCEP caiu e cidade/UF ficaram
// liberadas para digitar.
export type AddressDraft = {
  cep: string
  street: string
  number: string
  noNumber: boolean
  complement: string
  district: string
  city: string
  state: string
  manual: boolean
}

export type AddressErrors = Partial<
  Record<'cep' | 'street' | 'number' | 'complement' | 'district' | 'city' | 'state', string>
>

export const EMPTY_ADDRESS: AddressDraft = {
  cep: '',
  street: '',
  number: '',
  noNumber: false,
  complement: '',
  district: '',
  city: '',
  state: '',
  manual: false,
}

export function maskCep(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
}

export function addressToDraft(address: Address | undefined): AddressDraft {
  if (!address) return EMPTY_ADDRESS
  const noNumber = address.number.toUpperCase() === 'S/N'
  return {
    cep: maskCep(address.cep),
    street: address.street,
    number: noNumber ? '' : address.number,
    noNumber,
    complement: address.complement ?? '',
    district: address.district,
    city: address.city,
    state: address.state,
    manual: false,
  }
}

export function isAddressEmpty(draft: AddressDraft): boolean {
  return (
    !draft.cep &&
    !draft.street.trim() &&
    !draft.number.trim() &&
    !draft.noNumber &&
    !draft.complement.trim() &&
    !draft.district.trim() &&
    !draft.city.trim() &&
    !draft.state
  )
}

// Vazio é válido (o endereço é opcional). Começado, precisa estar completo,
// e o erro aponta o campo que falta.
export function draftToAddress(
  draft: AddressDraft,
): { ok: true; address: Address | undefined } | { ok: false; errors: AddressErrors } {
  if (isAddressEmpty(draft)) return { ok: true, address: undefined }

  const value = {
    cep: draft.cep.replace(/\D/g, ''),
    street: draft.street.trim(),
    number: draft.noNumber ? 'S/N' : draft.number.trim(),
    complement: draft.complement.trim() || undefined,
    district: draft.district.trim(),
    city: draft.city.trim(),
    state: draft.state,
  }

  const errors: AddressErrors = {}
  if (value.cep.length !== 8) errors.cep = 'Informe o CEP com 8 dígitos.'
  if (value.street.length < 2) errors.street = 'Informe a rua.'
  if (!value.number) errors.number = 'Informe o número ou marque Sem número.'
  if (value.district.length < 2) errors.district = 'Informe o bairro.'
  if (draft.manual) {
    if (value.city.length < 2) errors.city = 'Informe a cidade.'
    if (!value.state) errors.state = 'Escolha a UF.'
  } else if (!value.city || !value.state) {
    errors.cep ??= 'Busque o CEP para preencher cidade e UF.'
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors }

  const parsed = addressSchema.safeParse(value)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = String(issue?.path[0] ?? 'street') as keyof AddressErrors
    return { ok: false, errors: { [field]: issue?.message ?? 'Endereço inválido.' } }
  }
  return { ok: true, address: parsed.data }
}

export function previewAddress(draft: AddressDraft): string | null {
  const result = draftToAddress(draft)
  return result.ok && result.address ? formatAddress(result.address) : null
}
