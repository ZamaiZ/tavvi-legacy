'use client'

import { useConsoleInvite } from '@/components/shell/console-shell'
import { InviteSheet } from './invite-sheet'

export function PlatformInviteOverlay() {
  const { request, onClose } = useConsoleInvite()
  return <InviteSheet request={request} onClose={onClose} />
}
