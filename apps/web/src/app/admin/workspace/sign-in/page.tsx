import type { Viewport } from 'next'
import { ConsoleSignInShell } from '@/features/auth/components/tavvi/console-sign-in-shell'
import { ConsoleSignInForm } from '@/features/auth/components/tavvi/console-sign-in-form'
import { safeNextPath } from '@/domain/common'

export const metadata = { title: 'Entrar' }
export const viewport: Viewport = { themeColor: '#0D0C0A' }

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  const safeNext = safeNextPath(next === '/' ? undefined : next, '/restaurantes')

  return (
    <ConsoleSignInShell territory="painel">
      <ConsoleSignInForm
        next={safeNext}
        hint="Acesso do restaurante"
        emailPlaceholder="voce@restaurante.com.br"
        ctaLabel="Entrar no painel"
      />
    </ConsoleSignInShell>
  )
}
