'use client'

import type { PlatformInviteDTO } from '@/domain/invite'
import { DetailDrawer } from '../detail-drawer'
import { InviteDetail } from './invite-detail'

// O convite chega completo pela lista: o drawer abre já preenchido.
export function InviteDrawer({ invite, onClose }: { invite: PlatformInviteDTO | null; onClose: () => void }) {
  if (!invite) return null
  return <DetailDrawer label="Convite" width={380} onClose={onClose}>
    <InviteDetail key={invite.id} invite={invite} />
  </DetailDrawer>
}
