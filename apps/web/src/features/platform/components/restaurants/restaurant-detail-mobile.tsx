'use client'

import { LuCheck, LuLink, LuTrash2 } from 'react-icons/lu'
import type { RestaurantDetailDTO, RestaurantResponsibleDTO } from '@/domain/restaurant'
import { MEMBER_ROLE_LABELS } from '@/domain/invite'
import { formatLong } from '@/lib/format-date'
import { SpinnerRing } from '@/components/ui/spinner'
import { badgeLabel } from '../tv-badge'
import { restaurantInitials, restaurantStatusOptions, type RestaurantDetailState } from './use-restaurant-detail'

function personInitials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0].toLocaleUpperCase('pt-BR')).join('') || 'R'
}

// Tela empilhada do restaurante no celular: o topo segue o print
// detalhes-restaurante; embaixo, as ações de administração em grupos iOS.
export function RestaurantDetailMobile({ restaurant, members, detail }: {
  restaurant: RestaurantDetailDTO
  members: RestaurantResponsibleDTO[]
  detail: RestaurantDetailState
}) {
  return (
    <div className="tv-rd-m tv-m-only">
      <section className="tv-rd-hero">
        <div className="tv-rd-hero-top"><span className="tv-rd-initials">{restaurantInitials(restaurant.name)}</span><span className="tv-rd-chip">{badgeLabel(restaurant.status)}</span></div>
        <div><h2>{restaurant.name}</h2><p>{restaurant.segment ?? 'Não informado'}</p></div>
      </section>

      <h3 className="tv-group-label">Link público</h3>
      <div className="tv-rd-link">
        <LuLink aria-hidden="true" />
        <span className="tv-mono">{detail.publicHost}</span>
        <button type="button" className={detail.copied ? 'is-copied' : undefined} onClick={detail.copyPublicLink}>{detail.copied ? 'Copiado' : 'Copiar'}</button>
      </div>

      <h3 className="tv-group-label">Responsáveis</h3>
      <div className="tv-group">
        {members.length ? members.map((member) => (
          <div className="tv-rd-member" key={member.id}>
            <span className="tv-rd-avatar" aria-hidden="true">{personInitials(member.name)}</span>
            <span className="tv-rd-member-body">
              <span className="tv-rd-member-copy"><strong>{member.name}</strong><a href={`mailto:${member.email}`}>{member.email}</a></span>
              <small>{MEMBER_ROLE_LABELS[member.role]}</small>
            </span>
          </div>
        )) : <p className="tv-group-empty">Nenhum responsável cadastrado.</p>}
      </div>

      <div className="tv-group is-spaced">
        <div className="tv-group-row"><span>Criado em</span><span>{formatLong(restaurant.createdAt)}</span></div>
        <div className="tv-group-row"><span>Atualizado em</span><span>{formatLong(restaurant.updatedAt)}</span></div>
      </div>

      <h3 className="tv-group-label">Endereço público</h3>
      <div className="tv-group">
        <label className="tv-rd-slug"><span className="tv-mono">{detail.domain}/</span><input aria-label="Endereço público" value={detail.slug} autoCapitalize="none" autoCorrect="off" spellCheck={false} disabled={detail.pending} onChange={(event) => detail.setSlug(event.target.value)} /></label>
      </div>
      <p className="tv-group-note">O cardápio fica em {detail.domain}/{detail.slug}. As plaquinhas continuam funcionando depois da troca, porque elas apontam para um código próprio e não para o endereço. Links compartilhados diretamente é que deixam de funcionar.</p>
      {detail.slugError ? <p role="alert" className="tv-group-error">{detail.slugError}</p> : null}
      <button type="button" className="tv-m-pill is-primary tv-rd-save" disabled={!detail.canSaveSlug || detail.pending} onClick={detail.saveSlug}>{detail.savingSlug ? 'Alterando…' : 'Alterar endereço'}</button>

      <h3 className="tv-group-label">Situação</h3>
      <div role="radiogroup" aria-label="Situação do restaurante" className="tv-group">
        {restaurantStatusOptions.map((option) => (
          <button type="button" key={option.value} role="radio" aria-checked={restaurant.status === option.value} disabled={detail.pending} className="tv-rd-status" onClick={() => detail.setStatus(option.value)}>
            <span><strong>{option.label}</strong><small>{option.hint}</small></span>
            {detail.statusTarget === option.value ? <SpinnerRing label="Alterando a situação" className="tv-row-spinner" /> : restaurant.status === option.value ? <LuCheck aria-hidden="true" /> : null}
          </button>
        ))}
      </div>

      <div className="tv-group is-spaced">
        <button type="button" className="tv-group-danger" disabled={detail.pending} onClick={() => detail.setConfirm('remove')}><LuTrash2 aria-hidden="true" />Remover restaurante</button>
      </div>
    </div>
  )
}
