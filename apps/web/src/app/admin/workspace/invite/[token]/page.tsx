import { AuthShell } from '@/features/auth/components/auth-shell'
import { SignInForm } from '@/features/auth/components/sign-in-form'
import { SignUpForm } from '@/features/auth/components/sign-up-form'
import { CreateRestaurantStep } from '@/features/onboarding/components/create-restaurant-step'
import { AcceptInviteButton } from '@/features/workspace/components/accept-invite-button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MEMBER_ROLE_LABELS } from '@/domain/invite'
import { getCurrentUser } from '@/server/dal/auth'
import { previewInvite } from '@/server/dal/invites'
import { env } from '@/server/env'

export const metadata = { title: 'Convite' }

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  // previewInvite já aplica rate limit e já valida o formato. Token
  // desconhecido, vencido, revogado e já usado devolvem todos null — são
  // indistinguíveis daqui, que é exatamente o ponto.
  const invite = await previewInvite(token)

  if (!invite) {
    return (
      <AuthShell
        title="Convite indisponível"
        subtitle="Este convite não é mais válido. Peça um novo para quem enviou."
      />
    )
  }

  const daPlataforma = invite.kind === 'platform'

  // Repare no que esta página NÃO mostra, nos dois casos: quem emitiu, o
  // e-mail amarrado, ou a data.
  const titulo = daPlataforma
    ? 'Crie seu restaurante'
    : (invite.restaurantName ?? 'Convite')

  const user = await getCurrentUser()

  if (!user) {
    return (
      <AuthShell
        title={titulo}
        subtitle={
          daPlataforma
            ? 'Você foi convidado a criar seu restaurante. Crie sua conta para começar.'
            : `Você foi convidado a fazer parte da equipe, como ${MEMBER_ROLE_LABELS[invite.role].toLowerCase()}. Entre ou crie sua conta para aceitar.`
        }
      >
        <Tabs defaultValue="criar">
          <TabsList className="w-full">
            <TabsTrigger value="criar" className="flex-1">
              Criar conta
            </TabsTrigger>
            <TabsTrigger value="entrar" className="flex-1">
              Já tenho conta
            </TabsTrigger>
          </TabsList>

          <TabsContent value="criar" className="pt-6">
            <SignUpForm />
          </TabsContent>

          <TabsContent value="entrar" className="pt-6">
            {/* O destino é esta mesma página: depois de entrar, a pessoa
                precisa voltar aqui para concluir. O token vive no caminho,
                então atravessa a autenticação sem se perder. */}
            <SignInForm next={`/convite/${token}`} />
          </TabsContent>
        </Tabs>
      </AuthShell>
    )
  }

  if (daPlataforma) {
    return (
      <AuthShell
        title={titulo}
        subtitle={`Entrando como ${user.email ?? 'sua conta'}. Comece pelo nome.`}
      >
        <CreateRestaurantStep
          token={token}
          rootDomain={env.NEXT_PUBLIC_ROOT_DOMAIN}
        />
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title={titulo}
      subtitle={`Você foi convidado a fazer parte desta equipe como ${MEMBER_ROLE_LABELS[
        invite.role
      ].toLowerCase()}, entrando como ${user.email ?? 'sua conta'}.`}
    >
      <AcceptInviteButton token={token} />
    </AuthShell>
  )
}
