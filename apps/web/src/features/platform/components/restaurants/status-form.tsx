'use client'

import { useTransition } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select'
import { toast } from '@/components/ui/toast'
import type { RestaurantStatus } from '@/domain/restaurant'
import {
  setRestaurantStatusAction,
  softDeleteRestaurantAction,
} from '@/server/actions/restaurants'

export function StatusForm({
  restaurantId,
  status,
}: {
  restaurantId: string
  status: RestaurantStatus
}) {
  const [pending, startTransition] = useTransition()

  function changeStatus(next: RestaurantStatus) {
    startTransition(async () => {
      const result = await setRestaurantStatusAction({
        restaurantId,
        status: next,
      })
      toast.add(
        result.ok
          ? { title: 'Situação atualizada', type: 'success' }
          : { title: result.error, type: 'error' },
      )
    })
  }

  function remove() {
    startTransition(async () => {
      const result = await softDeleteRestaurantAction(restaurantId)
      toast.add(
        result.ok
          ? { title: 'Restaurante removido', type: 'success' }
          : { title: result.error, type: 'error' },
      )
    })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="status" className="text-sm font-medium">
          Situação
        </label>
        <NativeSelect
          id="status"
          value={status}
          disabled={pending}
          onChange={(event) =>
            changeStatus(event.target.value as RestaurantStatus)
          }
        >
          <NativeSelectOption value="draft">
            Rascunho — invisível para o público
          </NativeSelectOption>
          <NativeSelectOption value="active">
            Ativo — cardápio no ar
          </NativeSelectOption>
          <NativeSelectOption value="suspended">
            Suspenso — cardápio fora do ar
          </NativeSelectOption>
        </NativeSelect>
      </div>

      <AlertDialog>
        <AlertDialogTrigger
          render={<Button variant="destructive" disabled={pending} />}
        >
          Remover restaurante
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover este restaurante?</AlertDialogTitle>
            {/* Diz a verdade sobre o que acontece: é remoção lógica,
                reversível por SQL, não por botão. Prometer "não pode ser
                desfeito" seria mentira, e prometer um botão de desfazer
                que não existe seria pior. */}
            <AlertDialogDescription>
              O cardápio sai do ar imediatamente e o restaurante deixa de
              aparecer na lista. Os dados continuam no banco, então isso pode
              ser desfeito — mas não pela interface.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
