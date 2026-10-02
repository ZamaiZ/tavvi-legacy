'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { RiCheckLine, RiCloseLine, RiStore2Line } from 'react-icons/ri'
import { Button } from '@/components/ui/button'
import { IconField } from '@/components/ui/field-icon'
import { Spinner } from '@/components/ui/spinner'
import { slugify } from '@/lib/slug'
import { redeemPlatformInviteAction } from '@/server/actions/invites'
import { checkSlugAction } from '@/server/actions/restaurants'

type Disponibilidade = 'curto' | 'conferindo' | 'livre' | 'ocupado'

export function CreateRestaurantStep({
  token,
  rootDomain,
}: {
  token: string
  rootDomain: string
}) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [tocouSlug, setTocouSlug] = useState(false)
  const [disponibilidade, setDisponibilidade] = useState<Disponibilidade>('curto')
  const [error, setError] = useState<string | null>(null)
  const [enviando, startEnvio] = useTransition()
  const [, startConferencia] = useTransition()

  // O endereço acompanha o nome ATÉ a pessoa editá-lo à mão. Depois disso ele
  // é dela: continuar sobrescrevendo apagaria o que ela acabou de escrever, a
  // cada tecla do campo de cima.
  useEffect(() => {
    if (!tocouSlug) setSlug(name.trim().length >= 2 ? slugify(name) : '')
  }, [name, tocouSlug])

  // Conferência com atraso, para não disparar uma chamada por tecla.
  useEffect(() => {
    if (slug.length < 3) {
      setDisponibilidade('curto')
      return
    }

    setDisponibilidade('conferindo')
    const timer = setTimeout(() => {
      // A action vai dentro de startTransition por vir de um efeito, que é o
      // contrato documentado do Next 16.3.5.
      startConferencia(async () => {
        const result = await checkSlugAction(slug)
        setDisponibilidade(result.ok && result.data ? 'livre' : 'ocupado')
      })
    }, 400)

    return () => clearTimeout(timer)
  }, [slug])

  function submit() {
    setError(null)
    startEnvio(async () => {
      const result = await redeemPlatformInviteAction({ token, name, slug })
      if (result.ok) {
        // `comecar` são os passos 2 e 3. O restaurante JÁ EXISTE aqui: o que
        // vem depois é edição, e por isso pode ser pulado.
        router.replace(`/restaurantes/${result.data.restaurantId}/comecar`)
      } else {
        // Endereço em uso chega aqui. O convite NÃO foi consumido — a função
        // no banco desfaz a transação inteira —, então tentar outro nome
        // funciona sem precisar de link novo.
        setError(result.error)
        setDisponibilidade('ocupado')
      }
    })
  }

  const aviso: Record<Disponibilidade, { texto: string; tom: string }> = {
    curto: {
      texto: 'Vai aparecer aqui conforme você digitar o nome.',
      tom: 'text-muted-foreground',
    },
    conferindo: { texto: 'Conferindo…', tom: 'text-muted-foreground' },
    livre: { texto: 'Este endereço está livre.', tom: 'text-status-active' },
    ocupado: {
      texto: 'Este endereço já está em uso. Tente outro.',
      tom: 'text-destructive',
    },
  }

  return (
    <form
      action={submit}
      className="space-y-6"
      aria-busy={enviando ? 'true' : undefined}
    >
      <fieldset disabled={enviando} className="space-y-6">
      <IconField
        id="nome"
        label="Nome do restaurante"
        icon={<RiStore2Line />}
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Cantina do Zé"
        maxLength={120}
        autoFocus
        required
      />

      <div>
        <label htmlFor="slug" className="text-small font-medium">
          Endereço do seu cardápio
        </label>
        <div className="mt-1.5 flex items-center gap-0.5 rounded-md border border-input bg-transparent px-3 py-2 text-small focus-within:ring-2 focus-within:ring-ring">
          <span className="shrink-0 text-muted-foreground">{rootDomain}/</span>
          <input
            id="slug"
            value={slug}
            onChange={(event) => {
              setTocouSlug(true)
              // Passa pelo mesmo slugify do servidor: o campo não aceita
              // digitar algo que o banco recusaria depois.
              setSlug(slugify(event.target.value))
            }}
            className="min-w-0 flex-1 bg-transparent outline-none"
            aria-describedby="slug-aviso"
          />
          {disponibilidade === 'livre' ? (
            <RiCheckLine
              className="size-4 shrink-0 text-status-active"
              aria-hidden="true"
            />
          ) : disponibilidade === 'ocupado' ? (
            <RiCloseLine
              className="size-4 shrink-0 text-destructive"
              aria-hidden="true"
            />
          ) : null}
        </div>
        <p
          id="slug-aviso"
          aria-live="polite"
          className={`mt-1.5 text-small ${aviso[disponibilidade].tom}`}
        >
          {aviso[disponibilidade].texto}
        </p>
      </div>
      </fieldset>

      {error ? (
        <p role="alert" className="text-small text-destructive">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        className="w-full"
        disabled={enviando || disponibilidade !== 'livre' || name.trim().length < 2}
      >
        {enviando ? <Spinner className="size-4" aria-hidden="true" /> : null}
        {enviando ? 'Criando restaurante…' : 'Criar restaurante'}
      </Button>

      {/* O endereço congela depois daqui. Dizer isto agora, e não descobrir
          depois, é a diferença entre uma escolha e uma surpresa. */}
      <p className="text-small text-muted-foreground">
        O endereço não muda depois. O nome, sim.
      </p>
    </form>
  )
}
