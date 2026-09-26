import type { PlatformInvitation } from '@tavvi/api-contracts'

export type InviteState = 'pending' | 'redeemed' | 'revoked' | 'expired'

export function getInviteState(invite: PlatformInvitation, now: number): InviteState {
  if (invite.redeemedAt) return 'redeemed'
  if (invite.revokedAt) return 'revoked'
  if (Date.parse(invite.expiresAt) <= now) return 'expired'
  return 'pending'
}
