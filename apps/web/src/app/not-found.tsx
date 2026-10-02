import type { Metadata } from 'next'
import { TerritoryNotFound } from '@/features/not-found/components/territory-not-found'

// Única fronteira 404 do app, fora a do restaurante em (site)/[slug]. Os
// not-found de admin/(platform) e admin/workspace saíram para que todo
// notFound() suba até aqui e a 404 seja sempre a mesma tela cheia, sem
// sidebar, venha a pessoa de onde vier.
export const metadata: Metadata = {
  title: 'Página não encontrada',
}

export default function NotFound() {
  return <TerritoryNotFound />
}
