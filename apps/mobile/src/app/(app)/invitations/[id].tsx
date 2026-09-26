import { useLocalSearchParams } from 'expo-router'
import { InvitationDetailScreen } from '@/features/invitations/invitation-detail-screen'

export default function InvitationDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <InvitationDetailScreen id={id} />
}
