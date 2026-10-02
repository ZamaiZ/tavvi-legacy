import type { Metadata } from 'next'
import { MenuPageNotFound } from '@/features/not-found/components/menu-page-not-found'

// Fronteira de dentro do restaurante: pega o notFound() de `[...rest]`, que
// só roda com o restaurante publicado. Restaurante que não existe nunca
// chega aqui: o notFound() do layout deste segmento sobe à 404 raiz.
export const metadata: Metadata = {
  title: 'Página não encontrada',
}

export default function NotFound() {
  return <MenuPageNotFound />
}
