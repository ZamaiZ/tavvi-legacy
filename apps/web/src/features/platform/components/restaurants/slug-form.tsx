'use client'

import { useActionState, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import type { ActionResult } from '@/server/actions/result'
import { updateRestaurantSlugAction } from '@/server/actions/restaurants'

type State = ActionResult | undefined

export function SlugForm({
  restaurantId,
  slug,
  rootDomain,
}: {
  restaurantId: string
  slug: string
  rootDomain: string
}) {
  const [value, setValue] = useState(slug)
  const [state, formAction, pending] = useActionState<State, FormData>(
    async (_prev, formData) =>
      updateRestaurantSlugAction({
        restaurantId,
        slug: formData.get('slug'),
      }),
    undefined,
  )

  useEffect(() => {
    if (state?.ok) toast.add({ title: 'Endereço atualizado', type: 'success' })
  }, [state])

  return (
    <form action={formAction} className="space-y-6">
      <Field>
        <FieldLabel htmlFor="slug">Endereço público</FieldLabel>
        <Input
          id="slug"
          name="slug"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          required
        />
        {/* Esta explicação não é enfeite: sem ela, a pessoa razoavelmente
            teme trocar o endereço e ter que reimprimir tudo. */}
        <FieldDescription>
          O cardápio fica em {rootDomain}/{value}. As plaquinhas continuam
          funcionando depois da troca, porque elas apontam para um código
          próprio e não para o endereço. Links compartilhados diretamente é
          que deixam de funcionar.
        </FieldDescription>
      </Field>

      {state && !state.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button
        type="submit"
        variant="outline"
        disabled={pending || value === slug}
      >
        {pending ? <Spinner className="size-4" /> : null}
        Alterar endereço
      </Button>
    </form>
  )
}
