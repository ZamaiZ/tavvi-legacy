# Tavvi Mobile API v1

Base path: `/api/mobile/v1`. The app connects to the Express service using the absolute origin in `EXPO_PUBLIC_API_URL`.

## Authentication

All endpoints except login and token refresh require `Authorization: Bearer <accessToken>`. The server validates the Supabase user and, for every administrative operation, confirms the `platform_admin` role. Logout requires a valid authenticated user but does not require the admin role so a demoted user can revoke their session.

The app stores the returned access/refresh tokens in SecureStore. It never calls Supabase directly. After an authorized request returns `401`, the client shares one in-flight token refresh and retries the original request once. A network or server failure during refresh keeps the stored session; a definitive `401` or `403` clears it.

## Response format

Successful API responses use `{ "data": ... }`. Errors use `{ "error": { "code": "...", "message": "..." } }`. API responses use `Cache-Control: no-store`. The health endpoint is the exception and returns `{ "status": "ok" }` without a data envelope.

| Status | Meaning |
|---|---|
| `400` | Malformed JSON. |
| `401` | Missing or invalid session/credentials. |
| `403` | Authenticated account lacks platform-admin access. |
| `404` | Resource not found. |
| `409` | Resource state does not allow the requested mutation. |
| `413` | Request body exceeds the configured limit. |
| `422` | Input validation failed. |
| `429` | Rate limit reached. |
| `500` | Opaque server failure. |

Provider errors, SQL, tokens, invite hashes, secrets, and stack traces are not returned in error messages.

## Endpoints

### `GET /healthz`

Unauthenticated process-health response: `{ "status": "ok" }`. This checks that the HTTP process is answering, not the remote Supabase status.

### `POST /session`

Public; rate-limited by trusted client IP or a shared local bucket.

Request:

```json
{ "email": "admin@example.com", "password": "..." }
```

Returns `MobileSession` only after Supabase Auth succeeds and `platform_admin` is confirmed. Invalid credentials use a uniform `401 INVALID_CREDENTIALS`; valid non-admin accounts receive `403 FORBIDDEN` without a session response.

### `POST /session/refresh`

Public; accepts a refresh token and returns a newly authorized `MobileSession`.

```json
{ "refreshToken": "..." }
```

### `GET /session`

Admin-only session validation. Returns `SessionInfo`.

### `DELETE /session`

Authenticated-user session revocation. The app clears SecureStore and in-memory queries even if this best-effort remote revocation cannot reach Supabase.

Returns:

```json
{ "data": { "signedOut": true } }
```

### `GET /invites`

Admin-only list of platform invites, newest first. Never returns token hashes or clear invite tokens.

### `POST /invites`

Admin-only creation. Mutation does not retry automatically. `email` can be omitted or an empty string; `expiresInDays` is an integer from 1 to 30.

```json
{ "email": "admin@example.com", "expiresInDays": 7 }
```

Returns `201` with `CreatedInvite`. The clear token appears only in this response and the in-memory open invite panel. Storage and audit are one database transaction.

### `GET /invites/:id`

Admin-only lookup of one platform invite. Invalid UUIDs return `422`; a missing/non-platform invite returns `404`.

### `POST /invites/:id`

Admin-only rotation of a pending invite. The old link is invalidated atomically. Returns a replacement `CreatedInvite` one time. Expired, redeemed, or revoked invites return `409 INVITE_NOT_PENDING`.

### `POST /invites/:id/revoke`

Admin-only revocation of a pending platform invite. Repeating a revocation returns its original timestamp. The mutation and first audit record commit in the same database transaction. Expired or redeemed invites return `409 INVITE_NOT_PENDING`.

### `GET /restaurants`

Admin-only read-only list. Each `MobileRestaurant` contains only:

```ts
type MobileRestaurant = {
  id: string
  name: string
  slug: string
  segment: string | null
  status: 'draft' | 'active' | 'suspended'
  deletedAt: string | null
}
```

### `GET /restaurants/:id`

Admin-only read-only detail. Returns `MobileRestaurantDetail`, which extends `MobileRestaurant` with `createdAt`, `updatedAt`, and:

```ts
members: {
  id: string
  name: string
  email: string
  role: 'admin' | 'cashier' | 'attendant' | 'waiter'
}[]
```

## DTOs

```ts
type MobileUser = { id: string; email: string }

type MobileSession = {
  accessToken: string
  refreshToken: string
  expiresAt: number
  expiresIn: number
  tokenType: 'bearer'
  user: MobileUser
}

type SessionInfo = { user: MobileUser }

type MobileInvite = {
  id: string
  email: string | null
  expiresAt: string
  redeemedAt: string | null
  revokedAt: string | null
  createdAt: string
  createdByEmail: string
  redeemedByEmail: string | null
}

type CreatedInvite = { id: string; link: string }
type RevokedInvite = { id: string; revokedAt: string }
```

## Rate limits and database migration

The existing Supabase `check_rate_limit` RPC applies 10 login attempts and 60 invitation mutations per 60-second window. Invite creation, rotation, and revocation write their audit event in the same database transaction as the mutation. Rotation uses the existing `rotate_platform_admin_invite` RPC; migration `0017_mobile_admin_atomic_invite_writes.sql` adds atomic creation and revocation RPCs without changing legacy function contracts.

The additive migration must be applied through the shared Supabase database change process before production API cutover. It is not applied by the Express process.
