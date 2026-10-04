'use client'

import { LuLink, LuPause, LuTrash2 } from 'react-icons/lu'
import type { RestaurantDetailDTO, RestaurantResponsibleDTO } from '@/domain/restaurant'
import { MEMBER_ROLE_LABELS } from '@/domain/invite'
import { formatLong } from '@/lib/format-date'
import { SpinnerRing } from '@/components/ui/spinner'
import { TvBadge } from '../tv-badge'
import { ConfirmDialog } from '../confirm-dialog'
import { RestaurantDetailMobile } from './restaurant-detail-mobile'
import { restaurantInitials, restaurantStatusOptions, useRestaurantDetail } from './use-restaurant-detail'

export function RestaurantDetail({ restaurant, rootDomain, members, standalone = false }: {
  restaurant: RestaurantDetailDTO
  rootDomain: string
  /** Só a página empilhada carrega os responsáveis; o drawer não. */
  members?: RestaurantResponsibleDTO[]
  standalone?: boolean
}) {
  const detail = useRestaurantDetail(restaurant, rootDomain)
  return <>
    <div className="tv-detail-stack is-restaurant tv-d-only">
      <section className="tv-detail-hero">
        <div className="tv-detail-top"><span className="tv-restaurant-initials" aria-hidden="true">{restaurantInitials(restaurant.name)}</span><TvBadge state={restaurant.status} /></div>
        <h2>{restaurant.name}</h2>
        <p>{restaurant.segment ?? 'Não informado'}</p>
      </section>
      <section className="tv-detail-section">
        <h3>Link público</h3>
        <div className="tv-public-link">
          <LuLink aria-hidden="true" />
          <span>{detail.publicHost}</span>
          <button type="button" onClick={detail.copyPublicLink}>{detail.copied ? 'Copiado' : 'Copiar'}</button>
        </div>
      </section>
      {members ? <section className="tv-detail-section">
        <h3>Responsáveis</h3>
        {members.length ? <ul className="tv-member-list">{members.map((member) => <li key={member.id}><span><strong>{member.name}</strong><a href={`mailto:${member.email}`}>{member.email}</a></span><small>{MEMBER_ROLE_LABELS[member.role]}</small></li>)}</ul> : <p className="tv-detail-help">Nenhum responsável cadastrado.</p>}
      </section> : null}
      <section className="tv-detail-section">
        <h3>Endereço público</h3>
        <label className="tv-slug-field">
          <span>{detail.domain}/</span>
          <input aria-label="Endereço público" value={detail.slug} disabled={detail.pending} onChange={(event) => detail.setSlug(event.target.value)} />
        </label>
        <p className="tv-detail-help">O cardápio fica em {detail.domain}/{detail.slug || '…'}. Os identificadores continuam funcionando depois da troca, porque eles apontam para um código próprio e não para o endereço. Links compartilhados diretamente é que deixam de funcionar.</p>
        {detail.slugError ? <span role="alert" className="tv-field-error">{detail.slugError}</span> : null}
        <button type="button" className="tv-save-slug" disabled={!detail.canSaveSlug || detail.pending} onClick={detail.saveSlug}>{detail.savingSlug ? 'Alterando…' : 'Alterar endereço'}</button>
      </section>
      <section className="tv-detail-section">
        <h3>Situação</h3>
        <div role="radiogroup" aria-label="Situação do restaurante" className="tv-status-options">
          {restaurantStatusOptions.map((option) => <button type="button" key={option.value} role="radio" aria-checked={restaurant.status === option.value} disabled={detail.pending} className={restaurant.status === option.value ? 'is-active' : ''} onClick={() => detail.setStatus(option.value)}>
            <i aria-hidden="true" />
            <span><strong>{option.label}</strong><small>{option.hint}</small>{detail.statusTarget === option.value ? <SpinnerRing label="Alterando a situação" className="tv-row-spinner" /> : null}</span>
          </button>)}
        </div>
      </section>
      <section className="tv-info-card">
        <div><span>Criado em</span><strong>{formatLong(restaurant.createdAt)}</strong></div>
        <div><span>Atualizado em</span><strong>{formatLong(restaurant.updatedAt)}</strong></div>
      </section>
      <button type="button" className="tv-remove-restaurant" disabled={detail.pending} onClick={() => detail.setConfirm('remove')}><LuTrash2 aria-hidden="true" />Remover restaurante</button>
    </div>
    {members ? <RestaurantDetailMobile restaurant={restaurant} members={members} detail={detail} /> : null}
    {detail.confirm && <ConfirmDialog title={detail.confirm === 'remove' ? 'Remover este restaurante?' : 'Suspender este restaurante?'} description={detail.confirm === 'remove' ? 'O cardápio sai do ar imediatamente e o restaurante deixa de aparecer na lista. Os dados continuam no banco, então isso pode ser desfeito — mas não pela interface.' : 'O cardápio ficará fora do ar enquanto o restaurante estiver suspenso.'} confirmLabel={detail.confirm === 'remove' ? 'Remover' : 'Suspender'} icon={detail.confirm === 'remove' ? <LuTrash2 /> : <LuPause />} iconTone={detail.confirm === 'remove' ? 'danger' : 'accent'} destructive pending={detail.confirming} pendingLabel={detail.confirm === 'remove' ? 'Removendo…' : 'Suspendendo…'} onCancel={() => detail.setConfirm(null)} onConfirm={detail.confirmAction} />}
    {standalone && <span className="sr-only">{restaurant.name}</span>}
  </>
}
