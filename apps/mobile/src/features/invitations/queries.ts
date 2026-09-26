import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { API_ROUTES, type CreatedInvitation, type CreateInvitationInput, type PlatformInvitation, type RevokedInvitation } from '@tavvi/api-contracts'
import { apiRequest } from '@/lib/api-client'
export const invitationKeys = { all: ['platform', 'invitations'] as const }

export function useInvitations() {
  return useQuery({
    queryKey: invitationKeys.all,
    queryFn: () => apiRequest<PlatformInvitation[]>(API_ROUTES.platform.invitations),
  })
}

export function invitationDetailKey(id: string) {
  return [...invitationKeys.all, id] as const
}

export function useInvitation(id: string) {
  return useQuery({
    queryKey: invitationDetailKey(id),
    queryFn: () => apiRequest<PlatformInvitation>(API_ROUTES.platform.invitation(id)),
    enabled: Boolean(id),
  })
}
export function useRevokeInvitation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiRequest<RevokedInvitation>(API_ROUTES.platform.revokeInvitation(id), { method: 'POST' }),
    retry: false,
    onMutate: async (id) => {
      await client.cancelQueries({ queryKey: invitationKeys.all })
      const previousList = client.getQueryData<PlatformInvitation[]>(invitationKeys.all)
      const previousDetail = client.getQueryData<PlatformInvitation>(invitationDetailKey(id))
      const revokedAt = new Date().toISOString()
      client.setQueryData<PlatformInvitation[]>(invitationKeys.all, (current) => current?.map((invite) => invite.id === id ? { ...invite, revokedAt } : invite))
      client.setQueryData<PlatformInvitation>(invitationDetailKey(id), (current) => current ? { ...current, revokedAt } : current)
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
export function useRotateInvitation() {
  return useMutation({
    mutationFn: (id: string) => apiRequest<CreatedInvitation>(API_ROUTES.platform.rotateInvitation(id), { method: 'POST' }),
    retry: false,
  })
}

export function useCreateInvitation(onCreated: (invite: CreatedInvitation) => void) {
  return useMutation({
    mutationFn: async (input: CreateInvitationInput) => {
      const invite = await apiRequest<CreatedInvitation>(API_ROUTES.platform.invitations, {
        method: 'POST',
        body: JSON.stringify(input),
      })
      onCreated(invite)
      return { id: invite.id }
    },
    retry: false,
    gcTime: 0,
  })
}
