'use server'

import { redirect } from 'next/navigation'
import { safeNextPath } from '@/domain/common'
import { currentTerritory } from '@/server/dal/auth'
import { listMyRestaurants } from '@/server/dal/restaurant-read'
import * as dal from '@/server/dal/session'
import { runAction, type ActionResult } from './result'

export async function signInAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const result = await runAction(async () => {
    await dal.signIn({
      email: formData.get('email'),
      password: formData.get('password'),
    })
  })

  if (!result.ok) return result

  // O redirect fica FORA do runAction de propósito. Ele funciona lançando,
  // e o runAction reconhece esse lançamento e o repassa — mas manter aqui
  // deixa explícito que o desvio é sucesso, não erro.
  //
  // safeNextPath de novo: o campo oculto do formulário é controlado pelo
  // navegador, então o valor não pode ser confiado só porque a página o
  // entregou limpo.
  //
  // Cada território tem um destino inicial explícito. A raiz é ambígua com o
  // site público; no painel, a lista existente resolve o atalho para uma única
  // loja antes do redirect final.
  const territory = await currentTerritory()
  const defaultNext = territory === 'admin' ? '/convites' : '/restaurantes'
  const requestedNext = safeNextPath(formData.get('next'), defaultNext)
  const next = requestedNext === '/' ? defaultNext : requestedNext

  if (territory === 'painel' && next === '/restaurantes') {
    let restaurants: Awaited<ReturnType<typeof listMyRestaurants>> = []

    try {
      restaurants = await listMyRestaurants()
    } catch (error) {
      // A falha ao resolver o atalho nÃ£o pode transformar um login concluÃ­do
      // em erro; a tela de seleÃ§Ã£o continua sendo o destino de recuperaÃ§Ã£o.
      console.error('[auth] Could not resolve the panel home restaurant', error)
    }

    if (restaurants.length === 1) {
      redirect(`/restaurantes/${restaurants[0].id}`)
    }
  }

  redirect(next)
}

export async function signUpAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  // Não redireciona: quem se cadastra está no meio do resgate de convite e
  // precisa continuar na mesma página, agora autenticado, para aceitar.
  return runAction(async () => {
    await dal.signUp({
      email: formData.get('email'),
      password: formData.get('password'),
    })
  })
}

export async function signOutAction(): Promise<never> {
  await dal.signOut()
  redirect('/entrar')
}
