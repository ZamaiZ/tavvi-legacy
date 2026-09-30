import type { Viewport } from 'next'
import { redirect } from 'next/navigation'
import { TavviAuthShell } from '@/features/auth/components/tavvi/tavvi-auth-shell'
import { TavviSignInForm } from '@/features/auth/components/tavvi/tavvi-sign-in-form'
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
    <TavviAuthShell
      badge="Console"
      title="Administre a plataforma"
      subtitle="Convites, restaurantes e publicação em um só lugar."
      mobileSubtitle="Convites e restaurantes, de onde você estiver."
    >
      <TavviSignInForm
        next={safeNext}
        denied={motivo === 'sem-acesso'}
      />
    </TavviAuthShell>
  )
}
