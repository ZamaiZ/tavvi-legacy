import { TavviAuthShell } from '@/features/auth/components/tavvi/tavvi-auth-shell'
import { TavviSignInForm } from '@/features/auth/components/tavvi/tavvi-sign-in-form'
import { safeNextPath } from '@/domain/common'

export const metadata = { title: 'Entrar' }

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  const safeNext = safeNextPath(next === '/' ? undefined : next, '/restaurantes')

  return (
    <TavviAuthShell
      variant="painel"
      badge="Painel · Acesso do restaurante"
      title="Painel do restaurante"
      subtitle="Entre para cuidar do seu cardápio."
    >
      <TavviSignInForm
        next={safeNext}
        hint="Conta do restaurante"
        emailPlaceholder="voce@seurestaurante.com"
        ctaLabel="Entrar no painel"
        footer={(
          <p className="px-1 text-center text-xs leading-4 font-medium text-tv-subtle text-pretty">
            Recebeu um convite? Abra o link enviado ao seu e-mail.
          </p>
        )}
      />
    </TavviAuthShell>
  )
}
