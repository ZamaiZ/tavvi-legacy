import { redirect } from 'next/navigation'
import { TavviAuthShell } from '@/features/auth/components/tavvi/tavvi-auth-shell'
import { TavviSignInForm } from '@/features/auth/components/tavvi/tavvi-sign-in-form'
import { safeNextPath } from '@/domain/common'
import { getPlatformAdminStatus } from '@/server/dal/auth'

export const metadata = { title: 'Entrar' }

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
      badge="Console · Acesso de administrador"
      title="Bem-vindo de volta"
      subtitle="Restaurantes, cardápios, mesas e pedidos em um só lugar."
    >
      <TavviSignInForm
        next={safeNext}
        denied={motivo === 'sem-acesso'}
      />
    </TavviAuthShell>
  )
}
