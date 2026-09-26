import Link from 'next/link'
import { notFound } from 'next/navigation'
import { IdentityForm } from '@/features/workspace/components/identity-form'
import { ProfileForm } from '@/features/workspace/components/profile-form'
import { Reveal } from '@/components/motion/reveal'
import { buttonVariants } from '@/components/ui/button'
import { Progress, ProgressLabel } from '@/components/ui/progress'
import { uuidSchema } from '@/domain/common'
import { requireRestaurantAdmin } from '@/server/dal/auth'
import { getRestaurantWorkspace } from '@/server/dal/restaurant-workspace'

export const metadata = { title: 'Configurar restaurante' }

// Passos 2 e 3 do assistente. O passo 1 — o nome e o endereço — aconteceu na
// página do convite, e é por isso que o restaurante já EXISTE quando se chega
// aqui: o que vem agora é edição, e por isso pode ser pulado.
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ passo?: string }>
}) {
  const { id } = await params
  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) notFound()

  const workspace = await getRestaurantWorkspace(parsed.data)
  if (!workspace) notFound()
  const { restaurant } = workspace
  await requireRestaurantAdmin(restaurant.id)

  const { passo: requestedStep } = await searchParams
  const currentStep = requestedStep === 'contato' ? 'contato' : 'identidade'

  return (
    <main className="tavvi-page">
      <Reveal>
        <div className="mb-8">
          {/* `Progress` no lugar do "Passo 2 de 3" em texto puro. O primitivo
              existia desde a Fase 1 e nunca tinha sido importado.

              Num assistente o número sozinho não diz quanto falta — a barra
              diz, e de relance. O texto fica junto porque a barra sozinha não
              serve a quem usa leitor de tela nem a quem não distingue o
              preenchimento. */}
          <Progress
            value={currentStep === 'identidade' ? (2 / 3) * 100 : 100}
            className="mb-3 max-w-[280px]"
          >
            <ProgressLabel className="text-micro font-semibold uppercase tracking-[0.12em] text-primary">
              Passo {currentStep === 'identidade' ? '2' : '3'} de 3
            </ProgressLabel>
          </Progress>
          <h1 className="mt-3 text-[clamp(1.75rem,3vw,2.4rem)] font-semibold leading-tight tracking-[-0.035em]">
            {currentStep === 'identidade'
              ? 'A cara do seu cardápio'
              : 'Como te encontram'}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            {currentStep === 'identidade'
              ? 'Escolha o tema e as cores. Dá para mudar depois, quando quiser.'
              : 'Telefone, WhatsApp e endereço viram botões no topo do cardápio.'}
          </p>
        </div>

        {currentStep === 'identidade' ? (
          <IdentityForm
            restaurantId={restaurant.id}
            name={restaurant.name}
            segment={restaurant.segment}
            theme={restaurant.theme}
            logoPath={restaurant.logoPath}
            coverPath={restaurant.coverPath}
          />
        ) : (
          <div className="max-w-[560px]">
            <ProfileForm
              restaurantId={restaurant.id}
              name={restaurant.name}
              description={restaurant.description}
              contact={restaurant.contact}
            />
          </div>
        )}

        {/* Pular é visível nos dois passos, e não escondido num canto. O
            restaurante já existe; nada aqui é obrigatório para operar. */}
        <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-border pt-6">
          {/* Link estilizado, e não Button com `render`: a doc local do Base
              UI (`button.md:150`) diz que âncora não deve receber semântica
              de botão pelo `render`. */}
          {currentStep === 'identidade' ? (
            <Link
              href={`/restaurantes/${restaurant.id}/comecar?passo=contato`}
              className={buttonVariants({ variant: 'outline' })}
            >
              Continuar para o contato
            </Link>
          ) : null}

          <Link
            href={`/restaurantes/${restaurant.id}`}
            className={buttonVariants({ variant: 'ghost' })}
          >
            {currentStep === 'identidade' ? 'Pular e montar o cardápio' : 'Ir para o cardápio'}
          </Link>
        </div>
      </Reveal>
    </main>
  )
}
