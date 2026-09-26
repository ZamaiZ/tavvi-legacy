import 'server-only'
import type { RevalidationTarget } from '@/server/revalidate'
import { createUserClient } from './_client'
import { currentTerritory } from './auth'

async function db() {
  return createUserClient(await currentTerritory())
}

// Toda escrita precisa dizer QUAL restaurante mudou, para a revalidação
// alcançar o cardápio público pelo slug e o painel pelo id.
//
// Só o id não basta: o cardápio público mora em `/{slug}`, e nenhuma escrita
// carrega o slug. Daí esta consulta, que roda uma vez por ação de escrita.
//
// Este arquivo vive separado de `restaurants.ts` por uma razão concreta:
// `menu.ts` e `media.ts` precisam do alvo, e `restaurants.ts` precisa de
// `countVisibleItemsWithoutMedia`, que mora em `menu.ts`. Se o alvo estivesse em
// `restaurants.ts`, isso fecharia um ciclo de importação. Um módulo que só
// depende de `_client` desfaz o ciclo antes de ele existir.
//
// Nada aqui AUTORIZA. Esta função roda sempre depois de um
// `requireRestaurantAdmin`, e existe só para traduzir id em alvo. Quem tem
// um id de categoria, item ou variação em vez do id do restaurante já
// resolve isso antes, com `ownerRestaurantOf` — que é a função que impede o
// IDOR e portanto tem de rodar de qualquer forma.
export async function getRestaurantRevalidationTarget(
  restaurantId: string,
): Promise<RevalidationTarget> {
  const supabase = await db()
  const { data, error } = await supabase
    .from('restaurants')
    .select('id, slug')
    .eq('id', restaurantId)
    .single()

  if (error || !data) throw new Error('Restaurante não encontrado')
  return { id: data.id as string, slug: data.slug as string }
}
