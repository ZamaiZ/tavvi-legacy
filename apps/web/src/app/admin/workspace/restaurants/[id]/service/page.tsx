import { notFound, redirect } from 'next/navigation'
import { uuidSchema } from '@/domain/common'

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) notFound()
  redirect(`/restaurantes/${parsed.data}`)
}
