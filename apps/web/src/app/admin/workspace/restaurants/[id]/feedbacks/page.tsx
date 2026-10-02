import { notFound } from 'next/navigation'
import { uuidSchema } from '@/domain/common'
import { FeedbacksScreen } from '@/features/feedback/components/feedbacks-screen'
import { getFeedback, listFeedback } from '@/server/dal/feedback'
import { getRestaurantWorkspace } from '@/server/dal/restaurant-workspace'

export const metadata = { title: 'Feedbacks' }

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) notFound()

  // Só administradores: os outros papéis nem veem o item, e o endereço
  // digitado cai na 404, como nas outras telas de administrador.
  const workspace = await getRestaurantWorkspace(parsed.data)
  if (!workspace || !workspace.canEdit) notFound()
  const restaurantId = workspace.restaurant.id

  const { f } = await searchParams
  const focusId = typeof f === 'string' && uuidSchema.safeParse(f).success ? f : null
  const [page, focused] = await Promise.all([
    listFeedback({ restaurantId, filter: 'all' }),
    focusId ? getFeedback({ restaurantId, feedbackId: focusId }) : Promise.resolve(null),
  ])

  return (
    <FeedbacksScreen
      restaurantId={restaurantId}
      initialPage={page}
      focus={focusId ? { id: focusId, feedback: focused } : null}
    />
  )
}
