const apiRoot = '/api/v1'

const withId = (collection: string, id: string) => `${collection}/${encodeURIComponent(id)}`

export const API_ROUTES = {
  auth: {
    login: `${apiRoot}/auth/login`,
    signup: `${apiRoot}/auth/signup`,
    refresh: `${apiRoot}/auth/refresh`,
    session: `${apiRoot}/auth/session`,
    sessions: `${apiRoot}/auth/sessions`,
    deviceLogin: `${apiRoot}/auth/device-contract/login`,
    deviceContract: `${apiRoot}/auth/device-contract`,
    deviceContractStatus: (deviceId: string) => withId(`${apiRoot}/auth/device-contract`, deviceId),
  },
  platform: {
    invitations: `${apiRoot}/platform/invitations`,
    invitation: (id: string) => withId(`${apiRoot}/platform/invitations`, id),
    revokeInvitation: (id: string) => `${withId(`${apiRoot}/platform/invitations`, id)}/revoke`,
    rotateInvitation: (id: string) => `${withId(`${apiRoot}/platform/invitations`, id)}/rotate`,
    restaurants: `${apiRoot}/platform/restaurants`,
    restaurant: (id: string) => withId(`${apiRoot}/platform/restaurants`, id),
  },
  notifications: {
    // Montada à mão: o URLSearchParams do React Native não é completo.
    list: (cursor?: { createdAt: string; id: string }) => cursor
      ? `${apiRoot}/notifications?createdAt=${encodeURIComponent(cursor.createdAt)}&id=${encodeURIComponent(cursor.id)}`
      : `${apiRoot}/notifications`,
    count: `${apiRoot}/notifications/count`,
    read: (id: string) => `${withId(`${apiRoot}/notifications`, id)}/read`,
    readAll: `${apiRoot}/notifications/read-all`,
    test: `${apiRoot}/notifications/test`,
    devices: `${apiRoot}/notifications/devices`,
    device: (token: string) => withId(`${apiRoot}/notifications/devices`, token),
  },
} as const
