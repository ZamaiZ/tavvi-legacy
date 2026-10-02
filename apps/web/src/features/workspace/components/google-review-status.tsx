'use client'

import { LuCircleCheck, LuExternalLink, LuTriangleAlert } from 'react-icons/lu'
import { Spinner } from '@/components/ui/spinner'
import type { GoogleReviewStatus } from '@/domain/google-review'

export type ReviewState =
  | { kind: 'active'; url: string }
  | { kind: 'missing' }
  | { kind: 'not_business' }
  | { kind: 'unavailable' }

export function reviewStateFrom(status: GoogleReviewStatus, url: string | null): ReviewState {
  if (status === 'active' && url) return { kind: 'active', url }
  if (status === 'not_business') return { kind: 'not_business' }
  if (status === 'unavailable') return { kind: 'unavailable' }
  return { kind: 'missing' }
}

const MESSAGES: Record<Exclude<ReviewState['kind'], 'active'>, string> = {
  missing: 'O botão “Avaliar no Google” ainda não foi gerado.',
  not_business:
    'Esse link não leva a um perfil de empresa no Google. O “Como chegar” funciona, mas o botão de avaliação não aparece. No Maps, abra o perfil do restaurante → Compartilhar → Copiar link.',
  unavailable: 'Não conseguimos consultar o Google agora. O link foi salvo; toque em Gerar agora em alguns minutos.',
}

// Abaixo do campo "Perfil no Google Maps", no Contato e no passo 3 do
// assistente. O link de avaliação é calculado no servidor ao salvar; aqui só
// se mostra o resultado e se oferece "Gerar agora".
export function GoogleReviewStatusLine({
  state,
  hasMapsUrl,
  edited,
  dirty,
  generating,
  disabled,
  onGenerate,
}: {
  state: ReviewState
  hasMapsUrl: boolean
  /** O link do Maps no campo é diferente do salvo. */
  edited: boolean
  /** O formulário tem qualquer alteração não salva. */
  dirty: boolean
  generating: boolean
  disabled: boolean
  onGenerate: () => void
}) {
  if (!hasMapsUrl) return null
  if (edited) {
    return <p className="tv-contact-review" role="status">O link de avaliação é gerado ao salvar.</p>
  }
  if (state.kind === 'active') {
    return (
      <p className="tv-contact-review is-active" role="status">
        <LuCircleCheck aria-hidden="true" />
        <span>Botão “Avaliar no Google” ativo no cardápio.</span>
        <a className="tv-contact-link" href={state.url} target="_blank" rel="noopener noreferrer">
          Testar
          <LuExternalLink aria-hidden="true" />
        </a>
      </p>
    )
  }
  return (
    <div className={`tv-contact-review${state.kind === 'missing' ? '' : ' is-warning'}`} role="status">
      {state.kind === 'missing' ? null : <LuTriangleAlert aria-hidden="true" />}
      <span>{MESSAGES[state.kind]}</span>
      {/* Com alteração pendente, "Gerar agora" esperaria um Salvar: o botão
          fica desabilitado em vez de gravar só um pedaço do formulário. */}
      <button type="button" className="tv-contact-link" disabled={disabled || dirty} onClick={onGenerate}>
        {generating ? <Spinner className="size-3.5" aria-hidden="true" /> : null}
        {generating ? 'Gerando…' : 'Gerar agora'}
      </button>
    </div>
  )
}
