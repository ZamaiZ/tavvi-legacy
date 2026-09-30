import { notFound } from 'next/navigation'
import { SettingsMobile } from '@/features/workspace/components/mobile/settings-mobile'
import { uuidSchema } from '@/domain/common'
import { requireUser } from '@/server/dal/auth'
import { getRestaurantWorkspace } from '@/server/dal/restaurant-workspace'

export const metadata = { title: 'Ajustes' }

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

  return <SettingsMobile />
}
