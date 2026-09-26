'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { LuLink, LuPause, LuTrash2 } from 'react-icons/lu'
import type { RestaurantDetailDTO, RestaurantStatus } from '@/domain/restaurant'
import { slugSchema } from '@/domain/common'
import { formatLong } from '@/lib/format-date'
import { updateRestaurantSlugAction, setRestaurantStatusAction, softDeleteRestaurantAction } from '@/server/actions/restaurants'
import { toast } from '@/components/ui/toast'
import { TvBadge } from '../tv-badge'

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter((word) => word.length > 2 || /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(word))
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'R'
}

export function RestaurantDetail({ restaurant, rootDomain, standalone = false }: {
  restaurant: RestaurantDetailDTO
  rootDomain: string
  standalone?: boolean
}) {
  const router = useRouter()
  const [slug, setSlug] = useState(restaurant.slug)
  const [copied, setCopied] = useState(false)
  const [slugError, setSlugError] = useState('')
  const [confirm, setConfirm] = useState<'suspend' | 'remove' | null>(null)
  const [pending, startTransition] = useTransition()
  const validSlug = slugSchema.safeParse(slug)
  const valid = validSlug.success && slug !== restaurant.slug
  const origin = `${rootDomain.replace(/^https?:\/\//, '')}/${restaurant.slug}`
  const options: { value: RestaurantStatus; label: string; hint: string }[] = [
    { value: 'draft', label: 'Rascunho', hint: 'Invisível para o público' },
    { value: 'active', label: 'Ativo', hint: 'Cardápio no ar' },
    { value: 'suspended', label: 'Suspenso', hint: 'Cardápio fora do ar' },
  ]
  async function copyPublicLink() {
    try { await navigator.clipboard.writeText(`${window.location.protocol}//${origin}`); setCopied(true); setTimeout(() => setCopied(false), 1800) }
    catch { toast.add({ title: 'Não foi possível copiar o link.', type: 'error' }) }
  }
  function saveSlug() {
    setSlugError('')
    if (!validSlug.success) { setSlugError('Use letras minúsculas, números e hífens.'); return }
    startTransition(async () => {
      const result = await updateRestaurantSlugAction({ restaurantId: restaurant.id, slug: validSlug.data })
      if (result.ok) { toast.add({ title: 'Endereço atualizado', type: 'success' }); router.refresh() }
      else setSlugError(result.error.includes('em uso') ? 'Este endereço já está em uso.' : result.error)
    })
  }
  function setStatus(status: RestaurantStatus) {
    if (status === 'suspended') { setConfirm('suspend'); return }
    startTransition(async () => {
      const result = await setRestaurantStatusAction({ restaurantId: restaurant.id, status })
      toast.add(result.ok ? { title: 'Situação atualizada', type: 'success' } : { title: result.error, type: 'error' })
      if (result.ok) router.refresh()
    })
  }
  function confirmAction() {
    if (confirm === 'suspend') {
      startTransition(async () => {
        const result = await setRestaurantStatusAction({ restaurantId: restaurant.id, status: 'suspended' })
        setConfirm(null)
        toast.add(result.ok ? { title: 'Situação atualizada', type: 'success' } : { title: result.error, type: 'error' })
        if (result.ok) router.refresh()
      })
    } else if (confirm === 'remove') {
      startTransition(async () => {
        const result = await softDeleteRestaurantAction(restaurant.id)
        setConfirm(null)
        if (result.ok) { toast.add({ title: 'Restaurante removido', type: 'success' }); router.push('/restaurantes') }
        else toast.add({ title: result.error, type: 'error' })
      })
    }
  }
  return <div className="tv-detail-stack">
    <section className="tv-detail-hero tv-restaurant-detail-hero">
      <div className="tv-detail-top"><span className="tv-restaurant-initials">{initials(restaurant.name)}</span><TvBadge state={restaurant.status} hero /></div>
      <h2>{restaurant.name}<i>.</i></h2><p>{restaurant.segment ?? 'Não informado'}</p>
    </section>
    <section className="tv-detail-block"><h3>LINK PÚBLICO</h3><div className="tv-public-link"><LuLink /><span className="tv-mono">{origin}</span><button type="button" onClick={copyPublicLink}>{copied ? 'Copiado' : 'Copiar'}</button></div></section>
    <section className="tv-detail-block"><h3>ENDEREÇO PÚBLICO</h3><div className="tv-slug-field"><span className="tv-mono">{rootDomain.replace(/^https?:\/\//, '')}/</span><input aria-label="Endereço público" value={slug} onChange={(event) => { const normalized = event.target.value.toLowerCase().replace(/\s+/g, '-'); setSlug(normalized); setSlugError('') }} /></div><p>O cardápio fica em {rootDomain}/{slug}. As plaquinhas continuam funcionando depois da troca, porque elas apontam para um código próprio e não para o endereço. Links compartilhados diretamente é que deixam de funcionar.</p>{slugError && <span role="alert" className="tv-field-error">{slugError}</span>}<button type="button" className="tv-save-slug" disabled={!valid || pending} onClick={saveSlug}>{pending ? 'Alterando…' : 'Alterar endereço'}</button></section>
    <section className="tv-detail-block"><h3>SITUAÇÃO</h3><div role="radiogroup" aria-label="Situação do restaurante" className="tv-status-options">{options.map((option) => <button type="button" key={option.value} role="radio" aria-checked={restaurant.status === option.value} disabled={pending} className={restaurant.status === option.value ? 'is-active' : ''} onClick={() => setStatus(option.value)}><i /><span><strong>{option.label}</strong><small>{option.hint}</small></span></button>)}</div></section>
    <section className="tv-info-card tv-restaurant-dates"><div><span>Criado em</span><strong>{formatLong(restaurant.createdAt)}</strong></div><div><span>Atualizado em</span><strong>{formatLong(restaurant.updatedAt)}</strong></div></section>
    <button type="button" className="tv-remove-restaurant" onClick={() => setConfirm('remove')}><LuTrash2 />Remover restaurante</button>
    {confirm && <div className="tv-confirm-scrim"><section role="alertdialog" aria-modal="true" aria-label={confirm === 'remove' ? 'Remover este restaurante?' : 'Suspender este restaurante?'} className="tv-confirm-dialog"><span className={`tv-state-icon${confirm === 'remove' ? ' is-danger' : ''}`}>{confirm === 'remove' ? <LuTrash2 /> : <LuPause />}</span><h2>{confirm === 'remove' ? 'Remover este restaurante?' : 'Suspender este restaurante?'}</h2><p>{confirm === 'remove' ? 'O cardápio sai do ar imediatamente e o restaurante deixa de aparecer na lista. Os dados continuam no banco, então isso pode ser desfeito — mas não pela interface.' : 'O cardápio ficará fora do ar enquanto o restaurante estiver suspenso.'}</p><div><button type="button" className="tv-secondary-cta" onClick={() => setConfirm(null)}>Cancelar</button><button type="button" className="tv-tonal-button" disabled={pending} onClick={confirmAction}>{pending ? <span className="tv-spinner" /> : confirm === 'remove' ? 'Remover' : 'Suspender'}</button></div></section></div>}
    {standalone && <span className="sr-only">{restaurant.name}</span>}
  </div>
}
