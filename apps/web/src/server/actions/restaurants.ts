'use server'

import { redirect } from 'next/navigation'
import type { GoogleReviewOutcome } from '@/domain/google-review'
import * as readDal from '@/server/dal/restaurant-read'
import * as writeDal from '@/server/dal/restaurant-write'
import {
  revalidatePublicPath,
  revalidateLists,
  revalidateRestaurant,
} from '@/server/revalidate'
import { runAction, type ActionResult } from './result'

export async function updateRestaurantProfileAction(
  input: unknown,
): Promise<ActionResult<GoogleReviewOutcome>> {
  return runAction(async () => {
    const { target, googleReview, googleReviewUrl } = await writeDal.updateRestaurantProfile(input)
    revalidateRestaurant(target)
    return { googleReview, googleReviewUrl }
  })
}

export async function generateGoogleReviewAction(
  input: unknown,
): Promise<ActionResult<GoogleReviewOutcome>> {
  return runAction(async () => {
    const { target, googleReview, googleReviewUrl } = await writeDal.generateGoogleReview(input)
    revalidateRestaurant(target)
    return { googleReview, googleReviewUrl }
  })
}

export async function setPublishedAction(
  input: unknown,
): Promise<ActionResult> {
  return runAction(async () => {
    revalidateRestaurant(await writeDal.setPublished(input))
    // A lista mostra a situação de cada restaurante, e publicar muda
    // exatamente isso.
    revalidateLists()
  })
}

// Formulário do assistente ("Pular e montar o cardápio" / "Ir para o
// cardápio"): grava a marca e leva ao cardápio. Daí em diante o botão
// "Primeiros passos" some do cabeçalho.
export async function completeOnboardingAction(formData: FormData): Promise<void> {
  const restaurantId = String(formData.get('restaurantId') ?? '')
  revalidateRestaurant(await writeDal.completeOnboarding({ restaurantId }))
  redirect(`/restaurantes/${restaurantId}`)
}

export async function updateIdentityAction(
  input: unknown,
): Promise<ActionResult> {
  return runAction(async () => {
    revalidateRestaurant(await writeDal.updateIdentity(input))
  })
}

// Consulta, não mutação — mas passa por action porque o assistente é
// componente de cliente e não pode importar a DAL.
export async function checkSlugAction(
  candidate: unknown,
): Promise<ActionResult<boolean>> {
  return runAction(async () => readDal.checkSlug(candidate))
}

export async function suggestSlugAction(
  name: unknown,
): Promise<ActionResult<string | null>> {
  return runAction(async () => readDal.suggestSlug(name))
}

export async function setRestaurantStatusAction(
  input: unknown,
): Promise<ActionResult> {
  return runAction(async () => {
    revalidateRestaurant(await writeDal.setRestaurantStatus(input))
    revalidateLists()
  })
}

export async function softDeleteRestaurantAction(
  restaurantId: unknown,
): Promise<ActionResult> {
  return runAction(async () => {
    revalidateRestaurant(await writeDal.softDeleteRestaurant(restaurantId))
    revalidateLists()
  })
}

export async function updateRestaurantSlugAction(
  input: unknown,
): Promise<ActionResult> {
  return runAction(async () => {
    const { oldSlug, ...target } = await writeDal.updateRestaurantSlug(input)
    revalidateRestaurant(target)
    // O endereço antigo também: sem esta linha `/{slugAnterior}` continuaria
    // servindo um cardápio que mudou de endereço.
    revalidatePublicPath(oldSlug)
    revalidateLists()
  })
}
