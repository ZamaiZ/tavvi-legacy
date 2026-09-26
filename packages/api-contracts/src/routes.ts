const apiRoot = '/api/v1'

const withId = (collection: string, id: string) => `${collection}/${encodeURIComponent(id)}`

export const API_ROUTES = {
  auth: {
    login: `${apiRoot}/auth/login`,
    signup: `${apiRoot}/auth/signup`,
    refresh: `${apiRoot}/auth/refresh`,
    session: `${apiRoot}/auth/session`,
    deviceLogin: `${apiRoot}/auth/device-contract/login`,
    deviceContract: `${apiRoot}/auth/device-contract`,
  },
  platform: {
    invitations: `${apiRoot}/platform/invitations`,
    invitation: (id: string) => withId(`${apiRoot}/platform/invitations`, id),
    revokeInvitation: (id: string) => `${withId(`${apiRoot}/platform/invitations`, id)}/revoke`,
    rotateInvitation: (id: string) => `${withId(`${apiRoot}/platform/invitations`, id)}/rotate`,
    restaurants: `${apiRoot}/platform/restaurants`,
    restaurant: (id: string) => withId(`${apiRoot}/platform/restaurants`, id),
  },
} as const
