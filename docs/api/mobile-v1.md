# Tavvi Mobile API v1

Base path: `/api/mobile/v1`. The app connects to the Express service using the absolute origin in `EXPO_PUBLIC_API_URL`.

## Authentication

All endpoints except password login, token refresh, biometric device login, and device-contract revocation require `Authorization: Bearer <accessToken>`. The server validates the Supabase user and, for every administrative operation, confirms the `platform_admin` role. App logout only clears the local session; it does not revoke the provider session needed by the device contract.

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
| `503` | Authentication provider or device-contract persistence is temporarily unavailable; retry or use password login. |

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

If the old refresh token belongs to an active device contract, the backend atomically replaces its hash and encrypted token before returning the session. Password-only sessions work as before.

### `POST /session/device`

Public biometric login. Limited to 10 requests per minute per trusted client IP and per device proof. Invalid, missing, or revoked contracts return the same `401 INVALID_DEVICE_CONTRACT` response. A valid contract rotates its Supabase refresh token, confirms the same user and current `platform_admin` role, synchronizes the encrypted token, and returns `MobileSession`.

```json
{ "deviceId": "550e8400-e29b-41d4-a716-446655440000", "deviceSecret": "64-lowercase-hex-characters" }
```

### `POST /session/device-contract`

Requires a valid bearer session. The supplied refresh token is rotated and checked against the bearer user's ID and admin role before the server stores the device contract. Registering again on the same account and installation replaces that installation's previous secret.

```json
{
  "deviceId": "550e8400-e29b-41d4-a716-446655440000",
  "deviceSecret": "64-lowercase-hex-characters",
  "refreshToken": "..."
}
```

Returns the rotated `MobileSession`. The API never returns the secret hash or encrypted refresh token.

### `GET /session`

Admin-only session validation. Returns `SessionInfo`.

### `DELETE /session`

Authenticated-user acknowledgement for local app logout. The app clears its local session and query cache while the backend retains the device contract. Already-issued access tokens remain valid until their normal expiry.

Returns:

```json
{ "data": { "signedOut": true } }
```

### `DELETE /session/device-contract`

Public so the current device can be unlinked after logout. Requires the same high-entropy device proof and is rate-limited. Only after the server confirms revocation should the app delete the protected local secret. A failed/network request leaves the shortcut in place for retry.

```json
{ "deviceId": "550e8400-e29b-41d4-a716-446655440000", "deviceSecret": "64-lowercase-hex-characters" }
```

Returns `{ "data": { "revoked": true } }`. The device ID is an installation label; the device secret is the proof of possession. Email/password remains the recovery path. The secret is protected by native biometric authentication in SecureStore and is not a hardware-bound signing key.

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

The existing Supabase `check_rate_limit` RPC applies 10 password/device login and device-unlink attempts per 60-second window and 60 invitation mutations per 60-second window. Invite creation, rotation, and revocation write their audit event in the same database transaction as the mutation. Rotation uses the existing `rotate_platform_admin_invite` RPC; migration `0017_mobile_admin_atomic_invite_writes.sql` adds atomic creation and revocation RPCs without changing legacy function contracts.

Migrations `0017_mobile_admin_atomic_invite_writes.sql` and `0018_mobile_device_contracts.sql` must be applied through the shared Supabase database change process before production API cutover. They are not applied by the Express process. The device-contract table is not granted to client roles; RPCs expose only the fields required by the backend.
