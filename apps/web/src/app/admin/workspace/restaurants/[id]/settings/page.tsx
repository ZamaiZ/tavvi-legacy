import { notFound, redirect } from 'next/navigation'
import { uuidSchema } from '@/domain/common'
import { requireUser } from '@/server/dal/auth'
import { getRestaurantWorkspace } from '@/server/dal/restaurant-workspace'

export const metadata = { title: 'Cardápio' }

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireUser()

  const { id } = await params
  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) notFound()

  // Os dados (e-mail, papel, restaurantes) já vêm do layout pelo contexto do
  // shell; aqui só se confirma que a pessoa participa do restaurante.
  const workspace = await getRestaurantWorkspace(parsed.data)
  if (!workspace) notFound()

  redirect(`/restaurantes/${workspace.restaurant.id}`)
}
