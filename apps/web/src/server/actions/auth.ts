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

  // O destino volta para o cliente em vez de sair num redirect(). Numa server
  // action, o Next resolve o redirect buscando o RSC do destino na origem do
  // próprio servidor (localhost:3000), sem o host admin./painel.; o proxy
  // enxerga o território público, não reescreve /convites e o login cai num
  // 404 até o F5. O formulário navega com location.replace, que passa pelo
  // proxy com o host certo.
  //
  // safeNextPath de novo: o campo oculto do formulário é controlado pelo
  // navegador, então o valor não pode ser confiado só porque a página o
  // entregou limpo.
  //
  // Cada território tem um destino inicial explícito. A raiz é ambígua com o
  // site público; no painel, a lista existente resolve o atalho para uma única
  // loja antes de devolver o destino.
  const territory = await currentTerritory()
  const defaultNext = territory === 'admin' ? '/convites' : '/restaurantes'
  const requestedNext = safeNextPath(formData.get('next'), defaultNext)
  const next = requestedNext === '/' ? defaultNext : requestedNext

  if (territory === 'painel' && next === '/restaurantes') {
    let restaurants: Awaited<ReturnType<typeof listMyRestaurants>> = []

    try {
      restaurants = await listMyRestaurants()
    } catch (error) {
      // A falha ao resolver o atalho não pode transformar um login concluído
      // em erro; a tela de seleção continua sendo o destino de recuperação.
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
  // Não redireciona: quem se cadastra está no meio do resgate de convite e
  // precisa continuar na mesma página, agora autenticado, para aceitar.
  return runAction(() =>
    dal.signUp({
      displayName: formData.get('name'),
      email: formData.get('email'),
      password: formData.get('password'),
    }),
  )
}

export async function signOutAction(): Promise<void> {
  // Sem redirect() pelo mesmo motivo do signInAction: quem chama navega para
  // /entrar com location.replace.
  await dal.signOut()
}
