import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CreatedInvite, CreateInviteInput, MobileInvite, RevokedInvite } from '@/contracts/mobile-api'
import { apiRequest } from '@/lib/api-client'
export const invitationKeys = { all: ['mobile', 'invites'] as const }
export type InviteState = 'pending' | 'redeemed' | 'revoked' | 'expired'
export function getInviteState(invite: MobileInvite, now: number): InviteState { if (invite.redeemedAt) return 'redeemed'; if (invite.revokedAt) return 'revoked'; if (Date.parse(invite.expiresAt) <= now) return 'expired'; return 'pending' }
export function useInvitations() { return useQuery({ queryKey: invitationKeys.all, queryFn: () => apiRequest<MobileInvite[]>('/api/mobile/v1/invites') }) }
export function invitationDetailKey(id: string) { return [...invitationKeys.all, id] as const }
export function useInvitation(id: string) { return useQuery({ queryKey: invitationDetailKey(id), queryFn: () => apiRequest<MobileInvite>(`/api/mobile/v1/invites/${id}`), enabled: Boolean(id) }) }
export function useRevokeInvitation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiRequest<RevokedInvite>(`/api/mobile/v1/invites/${id}/revoke`, { method: 'POST' }), retry: false,
    onMutate: async (id) => {
      await client.cancelQueries({ queryKey: invitationKeys.all })
      const previousList = client.getQueryData<MobileInvite[]>(invitationKeys.all)
      const previousDetail = client.getQueryData<MobileInvite>(invitationDetailKey(id))
      const revokedAt = new Date().toISOString()
      client.setQueryData<MobileInvite[]>(invitationKeys.all, (current) => current?.map((invite) => invite.id === id ? { ...invite, revokedAt } : invite))
      client.setQueryData<MobileInvite>(invitationDetailKey(id), (current) => current ? { ...current, revokedAt } : current)
      return { previousList, previousDetail, id }
    },
    onError: (_error, _id, context) => {
      if (context?.previousList) client.setQueryData(invitationKeys.all, context.previousList)
      if (context?.previousDetail) client.setQueryData(invitationDetailKey(context.id), context.previousDetail)
    },
    onSettled: (_data, _error, id) => {
      void client.invalidateQueries({ queryKey: invitationKeys.all })
      void client.invalidateQueries({ queryKey: invitationDetailKey(id) })
    },
  })
}
export function useRotateInvitation() { return useMutation({ mutationFn: (id: string) => apiRequest<CreatedInvite>(`/api/mobile/v1/invites/${id}`, { method: 'POST' }), retry: false }) }
export function useCreateInvitation(onCreated: (invite: CreatedInvite) => void) { return useMutation({ mutationFn: async (input: CreateInviteInput) => { const invite = await apiRequest<CreatedInvite>('/api/mobile/v1/invites', { method: 'POST', body: JSON.stringify(input) }); onCreated(invite); return { id: invite.id } }, retry: false, gcTime: 0 }) }
