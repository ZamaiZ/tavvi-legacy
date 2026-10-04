'use server'

import { safeNextPath } from '@/domain/common'
import { currentTerritory } from '@/server/dal/auth'
import { listMyRestaurants } from '@/server/dal/restaurant-read'
import * as dal from '@/server/dal/session'
import { runAction, type ActionResult } from './result'

export type SignInResult = ActionResult<{ next: string }>

export async function signInAction(
  _prev: SignInResult | undefined,
  formData: FormData,
): Promise<SignInResult> {
  const result = await runAction(async () => {
    await dal.signIn({
      email: formData.get('email'),
      password: formData.get('password'),
    })
  })

  if (!result.ok) return result
  
  const territory = await currentTerritory()
  const defaultNext = territory === 'admin' ? '/convites' : '/restaurantes'
  const requestedNext = safeNextPath(formData.get('next'), defaultNext)
  const next = requestedNext === '/' ? defaultNext : requestedNext

  if (territory === 'painel' && next === '/restaurantes') {
    let restaurants: Awaited<ReturnType<typeof listMyRestaurants>> = []

    try {
      restaurants = await listMyRestaurants()
    } catch (error) {
      console.error('[auth] Could not resolve the panel home restaurant', error)
    }

    if (restaurants.length === 1) {
      return { ok: true, data: { next: `/restaurantes/${restaurants[0].id}` } }
    }
  }

  return { ok: true, data: { next } }
}

export type SignUpResult = ActionResult<{ confirmEmail: boolean }>

export async function signUpAction(
  _prev: SignUpResult | undefined,
  formData: FormData,
): Promise<SignUpResult> {
  return runAction(() =>
    dal.signUp({
      displayName: formData.get('name'),
      email: formData.get('email'),
      password: formData.get('password'),
    }),
  )
}

export async function signOutAction(): Promise<void> {
  await dal.signOut()
}

export async function signOutEverywhereAction(): Promise<ActionResult> {
  return runAction(() => dal.signOutEverywhere())
}
