'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { RestaurantDetailDTO, RestaurantStatus } from '@/domain/restaurant'
import { slugSchema } from '@/domain/common'
import { updateRestaurantSlugAction, setRestaurantStatusAction, softDeleteRestaurantAction } from '@/server/actions/restaurants'
import { toast } from '@/components/ui/toast'
import { restaurantInitials } from '@/lib/initials'

export const restaurantStatusOptions: { value: RestaurantStatus; label: string; hint: string }[] = [
  { value: 'draft', label: 'Rascunho', hint: 'Invisível para o público' },
  { value: 'active', label: 'Ativo', hint: 'Cardápio no ar' },
  { value: 'suspended', label: 'Suspenso', hint: 'Cardápio fora do ar' },
]

export { restaurantInitials }

// Estado e ações do detalhe do restaurante, compartilhados pela gaveta e
// página desktop e pela tela empilhada do celular.
export function useRestaurantDetail(restaurant: RestaurantDetailDTO, rootDomain: string) {
  const router = useRouter()
  const [slug, setSlugValue] = useState(restaurant.slug)
  const [copied, setCopied] = useState(false)
  const [slugError, setSlugError] = useState('')
  const [confirm, setConfirm] = useState<'suspend' | 'remove' | null>(null)
  // Uma transição por ação: cada botão mostra o próprio andamento, e o
  // `pending` geral trava o resto da tela.
  const [savingSlug, startSlug] = useTransition()
  const [changingStatus, startStatus] = useTransition()
  const [confirming, startConfirm] = useTransition()
  const [statusTarget, setStatusTarget] = useState<RestaurantStatus | null>(null)
  const pending = savingSlug || changingStatus || confirming
  const validSlug = slugSchema.safeParse(slug)
  const canSaveSlug = validSlug.success && slug !== restaurant.slug
  const domain = rootDomain.replace(/^https?:\/\//, '')
  const publicHost = `${domain}/${restaurant.slug}`

  function setSlug(value: string) {
    setSlugValue(value.toLowerCase().replace(/\s+/g, '-'))
    setSlugError('')
  }
  async function copyPublicLink() {
    try { await navigator.clipboard.writeText(`${window.location.protocol}//${publicHost}`); setCopied(true); setTimeout(() => setCopied(false), 1800) }
    catch { toast.add({ title: 'Não foi possível copiar o link.', type: 'error' }) }
  }
  function saveSlug() {
    setSlugError('')
    if (!validSlug.success) { setSlugError('Use letras minúsculas, números e hífens.'); return }
    startSlug(async () => {
      const result = await updateRestaurantSlugAction({ restaurantId: restaurant.id, slug: validSlug.data })
      if (result.ok) { toast.add({ title: 'Endereço atualizado', type: 'success' }); router.refresh() }
      else setSlugError(result.error.includes('em uso') ? 'Este endereço já está em uso.' : result.error)
    })
  }
  function setStatus(status: RestaurantStatus) {
    if (status === 'suspended') { setConfirm('suspend'); return }
    setStatusTarget(status)
    startStatus(async () => {
      const result = await setRestaurantStatusAction({ restaurantId: restaurant.id, status })
      setStatusTarget(null)
      toast.add(result.ok ? { title: 'Situação atualizada', type: 'success' } : { title: result.error, type: 'error' })
      if (result.ok) router.refresh()
    })
  }
  function confirmAction() {
    if (confirm === 'suspend') {
      startConfirm(async () => {
        const result = await setRestaurantStatusAction({ restaurantId: restaurant.id, status: 'suspended' })
        setConfirm(null)
        toast.add(result.ok ? { title: 'Situação atualizada', type: 'success' } : { title: result.error, type: 'error' })
        if (result.ok) router.refresh()
      })
    } else if (confirm === 'remove') {
      startConfirm(async () => {
        const result = await softDeleteRestaurantAction(restaurant.id)
        setConfirm(null)
        if (result.ok) { toast.add({ title: 'Restaurante removido', type: 'success' }); router.push('/restaurantes') }
        else toast.add({ title: result.error, type: 'error' })
      })
    }
  }

  return { slug, setSlug, slugError, canSaveSlug, saveSlug, copied, copyPublicLink, domain, publicHost, pending, savingSlug, changingStatus, statusTarget, confirming, setStatus, confirm, setConfirm, confirmAction }
}

export type RestaurantDetailState = ReturnType<typeof useRestaurantDetail>
