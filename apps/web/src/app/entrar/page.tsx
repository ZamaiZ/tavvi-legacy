import type { Metadata, Viewport } from 'next'
import { notFound, redirect } from 'next/navigation'
import { ConsoleSignInForm } from '@/features/auth/components/tavvi/console-sign-in-form'
import { ConsoleSignInShell } from '@/features/auth/components/tavvi/console-sign-in-shell'
import { PwaProvider } from '@/components/pwa/pwa-provider'
import { safeNextPath } from '@/domain/common'
import { pwaMetadata } from '@/lib/pwa'
import { getPlatformAdminStatus, currentTerritory } from '@/server/dal/auth'
import { env } from '@/server/env'

export async function generateMetadata(): Promise<Metadata> {
  const territory = await currentTerritory()
  return territory === 'site'
    ? { title: 'Entrar' }
    : { ...pwaMetadata(territory), title: 'Entrar' }
}

export async function generateViewport(): Promise<Viewport> {
  const territory = await currentTerritory()
  if (territory === 'admin') {
    return {
      width: 'device-width',
      initialScale: 1,
      viewportFit: 'cover',
      themeColor: [
        { media: '(prefers-color-scheme: light)', color: '#F2F0EB' },
        { media: '(prefers-color-scheme: dark)', color: '#0D0C0A' },
      ],
    }
  }
  return { themeColor: '#0D0C0A' }
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; motivo?: string }>
}) {
  const territory = await currentTerritory()
  if (territory === 'site') notFound()

  const { next, motivo } = await searchParams
  const defaultNext = territory === 'admin' ? '/convites' : '/restaurantes'
  const safeNext = safeNextPath(next === '/' ? undefined : next, defaultNext)
  const isAdmin = territory === 'admin'

  if (isAdmin && (await getPlatformAdminStatus()) === 'allowed') {
    redirect(safeNext)
  }

  const form = (
    <ConsoleSignInShell territory={isAdmin ? 'console' : 'painel'}>
      <ConsoleSignInForm
        next={safeNext}
        denied={isAdmin && motivo === 'sem-acesso'}
        hint={isAdmin ? undefined : 'Acesso do restaurante'}
        emailPlaceholder={isAdmin ? undefined : 'voce@restaurante.com.br'}
        ctaLabel={isAdmin ? undefined : 'Entrar no painel'}
      />
    </ConsoleSignInShell>
  )

  if (territory === 'painel') {
    return (
      <div className="workspace-territory flex min-h-dvh flex-col">
        <PwaProvider vapidPublicKey={env.NEXT_PUBLIC_VAPID_PUBLIC_KEY}>{form}</PwaProvider>
      </div>
    )
  }

  return (
    <PwaProvider vapidPublicKey={env.NEXT_PUBLIC_VAPID_PUBLIC_KEY}>
      <div className="admin-territory flex min-h-dvh flex-col">{form}</div>
    </PwaProvider>
  )
}
