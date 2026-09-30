import type { Viewport } from 'next'
import { redirect } from 'next/navigation'
import { ConsoleSignInShell } from '@/features/auth/components/tavvi/console-sign-in-shell'
import { ConsoleSignInForm } from '@/features/auth/components/tavvi/console-sign-in-form'
import { safeNextPath } from '@/domain/common'
import { getPlatformAdminStatus } from '@/server/dal/auth'

export const metadata = { title: 'Entrar' }
export const viewport: Viewport = { themeColor: '#0D0C0A' }

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; motivo?: string }>
}) {
  const { next, motivo } = await searchParams
  const safeNext = safeNextPath(next === '/' ? undefined : next, '/convites')
  if ((await getPlatformAdminStatus()) === 'allowed') {
    redirect(safeNext)
  }

  return (
    <ConsoleSignInShell>
      <ConsoleSignInForm next={safeNext} denied={motivo === 'sem-acesso'} />
    </ConsoleSignInShell>
  )
}
