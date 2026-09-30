'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { RestaurantDetailDTO, RestaurantStatus } from '@/domain/restaurant'
import { slugSchema } from '@/domain/common'
import { updateRestaurantSlugAction, setRestaurantStatusAction, softDeleteRestaurantAction } from '@/server/actions/restaurants'
import { toast } from '@/components/ui/toast'

export const restaurantStatusOptions: { value: RestaurantStatus; label: string; hint: string }[] = [
  { value: 'draft', label: 'Rascunho', hint: 'Invisível para o público' },
  { value: 'active', label: 'Ativo', hint: 'Cardápio no ar' },
  { value: 'suspended', label: 'Suspenso', hint: 'Cardápio fora do ar' },
]

export function restaurantInitials(name: string) {
  const words = name.trim().split(/\s+/).filter((word) => word.length > 2 || /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(word))
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'R'
}

// Estado e ações do detalhe do restaurante, compartilhados pela gaveta e
// página desktop e pela tela empilhada do celular.
export function useRestaurantDetail(restaurant: RestaurantDetailDTO, rootDomain: string) {
  const router = useRouter()
  const [slug, setSlugValue] = useState(restaurant.slug)
  const [copied, setCopied] = useState(false)
  const [slugError, setSlugError] = useState('')
  const [confirm, setConfirm] = useState<'suspend' | 'remove' | null>(null)
  const [pending, startTransition] = useTransition()
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

  return { slug, setSlug, slugError, canSaveSlug, saveSlug, copied, copyPublicLink, domain, publicHost, pending, setStatus, confirm, setConfirm, confirmAction }
}

export type RestaurantDetailState = ReturnType<typeof useRestaurantDetail>
