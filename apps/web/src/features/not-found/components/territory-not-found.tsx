import { currentTerritory } from '@/server/dal/auth'
import { ConsoleNotFound } from './console-not-found'
import { MenuRestaurantNotFound } from './menu-restaurant-not-found'

// A 404 raiz atende os três hosts: URL sem rota e todo notFound() sem
// fronteira mais próxima. O host decide a variante, do mesmo jeito que o
// proxy decide o território.
export async function TerritoryNotFound() {
  const territory = await currentTerritory()
  if (territory === 'site') return <MenuRestaurantNotFound />
  return <ConsoleNotFound territory={territory} />
}
