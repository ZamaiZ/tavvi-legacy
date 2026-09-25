# Tavvi Mobile Express Backend Implementation Plan

> **For agentic workers:** Implement one task at a time, review the changed files after each task, and preserve the constraints below. Do not run git, typecheck, build, lint, or tests.

**Goal:** Move every current Tavvi Mobile backend operation into an independently runnable Express service under `tavvi-backend/` while keeping the mobile app's API v1 behavior and Supabase security model.

**Architecture:** The Express service owns the versioned HTTP API, session operations, per-request authorization, and domain services. It accesses Supabase using the anon key and the user's bearer token, preserves RLS, and never needs a service-role key. The Expo app stores access and refresh tokens in SecureStore and calls only the Express API.

**Tech Stack:** Expo SDK 57 / React Native 0.86, TypeScript, pnpm, Express 5, Supabase JS, Zod, SecureStore, TanStack Query, Supabase RPCs.

**Spec:** `docs/superpowers/specs/2026-09-24-tavvi-mobile-express-backend-design.md`

## Global Constraints

- Scope is the Tavvi Mobile app and its Express service; the web product contract must keep working.
- The native app communicates with Supabase only through Express.
- The app stores Supabase access and refresh tokens through the existing SecureStore adapter.
- The Express server uses only `SUPABASE_URL` and `SUPABASE_ANON_KEY`; do not add or use a service-role key.
- Confirm `platform_admin` on every protected operation; continue using user-scoped Supabase clients and RLS.
- Preserve existing API v1 DTOs and response envelopes. Add refresh and logout session endpoints.
- Invite create, rotate, and revoke operations must leave mutation and audit in one database transaction.
- Keep link tokens, passwords, access tokens, refresh tokens, and invite URLs out of logs and errors.
- Do not choose or configure a production hosting provider in this plan.
- Do not run `git`, typecheck, build, lint, or tests. The user has explicitly excluded tests.
- Do not publish the service or apply a production database migration as part of implementation.

## Review Focus (manual review only)

- Missing, expired, malformed, or revoked credentials must not reach a protected controller; the app clears local state after permanent `401`/`403` responses.
- A concurrent burst of `401` responses must share one refresh attempt and retry each original request no more than once.
- A successful invitation mutation must have an audit row from the same database transaction; a failed audit must roll back the mutation.
- A malformed UUID, invalid e-mail, or expiry outside 1–30 days must return the existing safe error envelope without querying or changing data.
- A spoofed forwarded-IP header must not determine rate-limit/audit identity unless it came through a configured trusted proxy.

---

## File and Module Map

### Express service

- Create `tavvi-backend/tsconfig.json`, `.env.example`, `src/index.ts`, and `src/app.ts` for Node compilation, startup, middleware order, health route, and graceful server shutdown.
- Create `tavvi-backend/src/config/env.ts` for validated server configuration.
- Create `tavvi-backend/src/http/` for request types, error types/handler, response envelope, async route adaptation, request IDs, and rate-limit/IP helpers.
- Create `tavvi-backend/src/integrations/supabase/` for typed database definitions and anonymous/user-scoped client factories.
- Create `tavvi-backend/src/features/auth/`, `invitations/`, and `restaurants/` with route modules, controllers, schemas, services, and focused DTO mapping.
- Create `tavvi-backend/src/routes/mobile-v1.routes.ts` to mount the versioned domain routers.
- Modify `tavvi-backend/package.json` and `pnpm-lock.yaml` for server scripts and runtime/development packages.

### Supabase migration

- Create `supabase/migrations/0017_mobile_admin_atomic_invite_writes.sql` with additive, authenticated RPCs for invite creation and revocation; leave existing functions intact.

### Expo app

- Modify `src/contracts/mobile-api.ts` only if adding the explicit refresh/session fields required by the same response shape; keep it client-safe.
- Create `src/lib/session-store.ts` over `secureStoreAdapter` for session get/set/clear.
- Rewrite `src/lib/api-client.ts` for Express URL, bearer injection, one shared refresh, and one retry.
- Modify `src/features/auth/auth-context.tsx` to use the Express API plus the session store; remove direct Supabase session APIs.
- Modify `src/lib/supabase.ts` (then remove it) and `package.json`/`pnpm-lock.yaml` to remove the app's Supabase SDK dependency and public Supabase variables.
- Keep invitation and restaurant query hooks on the same `/api/mobile/v1` paths; change them only if DTO naming requires a compatible adapter.
- Remove `src/app/api/mobile/v1/` and `src/server/` after client cutover.
- Modify `app.json`, `.env.example`, `README.md`, and `docs/deployment/eas-hosting.md` so Expo no longer claims to host API routes and local setup describes the separate service.

### API reference

- Create `docs/api/mobile-v1.md` documenting the stable endpoints, request/response DTOs, status/error envelope, and session lifecycle. Keep it synchronized with `src/contracts/mobile-api.ts` and backend DTOs.

## Task 1: Bootstrap the Node/Express service

**Files:**
- Modify: `tavvi-backend/package.json`
- Modify: `tavvi-backend/pnpm-lock.yaml`
- Create: `tavvi-backend/tsconfig.json`
- Create: `tavvi-backend/.env.example`
- Create: `tavvi-backend/src/index.ts`
- Create: `tavvi-backend/src/app.ts`
- Create: `tavvi-backend/src/config/env.ts`
- Create: `tavvi-backend/src/http/errors.ts`
- Create: `tavvi-backend/src/http/responses.ts`
- Create: `tavvi-backend/src/routes/health.routes.ts`

**Interfaces:**
- Produces `ServerEnv` with `port`, `nodeEnv`, `supabaseUrl`, `supabaseAnonKey`, `panelPublicUrl`, and optional trusted proxy/CORS settings.
- Produces `HttpError(status, code, message)`, `ok(data, status?)`, and a final Express error handler that emits `{ error: { code, message } }`.
- Produces `createApp(): Express`; `src/index.ts` validates environment before binding the HTTP listener.
- `GET /healthz` returns a minimal process-health response and does not require Supabase credentials or expose configuration.

- [ ] Add backend scripts for development (`tsx watch src/index.ts`), production compilation, and starting compiled Node output. Set `engines.node` to `>=18`, matching Express 5's package engine.
- [ ] Add backend runtime dependencies for `@supabase/supabase-js` and `zod`, and development dependencies for TypeScript, Node typings, and `tsx`; update only the backend lockfile.
- [ ] Configure strict Node TypeScript compilation with `src` as the input directory and `dist` as output. Do not extend the Expo tsconfig.
- [ ] Parse required environment values at startup, reject missing Supabase URL/key or invalid production panel URL with a safe configuration error, and never print secret values.
- [ ] Create the health router and application middleware in this order: request ID, bounded JSON body parser, optional configured CORS, health route, `/api/mobile/v1`, not-found handler, then error handler.
- [ ] Add `.env.example` with placeholders only and document that local backend and Expo processes run separately.
- [ ] Review package scripts, env names, middleware ordering, and health response by reading the changed files. Do not execute any prohibited command.

## Task 2: Add Supabase adapters and shared request security

**Files:**
- Create: `tavvi-backend/src/integrations/supabase/database.types.ts`
- Create: `tavvi-backend/src/integrations/supabase/client.ts`
- Create: `tavvi-backend/src/http/request-context.ts`
- Create: `tavvi-backend/src/http/auth.middleware.ts`
- Create: `tavvi-backend/src/http/security.ts`
- Modify: `tavvi-backend/src/app.ts`

**Interfaces:**
- `createAnonymousSupabaseClient(): SupabaseClient<Database>` creates a client with persistence and auto-refresh disabled.
- `createUserSupabaseClient(accessToken: string): SupabaseClient<Database>` adds only that user's bearer token to the anon-key client.
- `AdminContext` contains `user: { id: string; email: string }`, `accessToken`, the user-scoped Supabase client, and `trustedIp: string | null`.
- `requirePlatformAdmin` resolves a bearer token, calls `auth.getUser(token)`, checks `is_platform_admin`, and attaches `AdminContext` to the Express request.
- `enforceRateLimit(supabase, bucket, identifier)` preserves current limits: 10 login attempts and 60 mutations per 60-second bucket.

- [ ] Copy the existing `Database` snapshot from `src/server/database.types.ts` into the backend integration folder and retain only types used by the Express service.
- [ ] Implement both Supabase client factories with `persistSession`, `autoRefreshToken`, and URL detection disabled. Do not add a service-role configuration field.
- [ ] Extend Express request typing with an optional `adminContext` and make the authenticated middleware fail closed when the bearer header, user, e-mail, or admin RPC result is invalid.
- [ ] Translate a known invalid token to `401`, a confirmed non-admin to `403`, and Supabase authorization-check failures to a safe `500` without forwarding provider text.
- [ ] Derive IP only from Express `req.ip` under an explicit trusted-proxy configuration; with no trusted proxy, ignore `cf-connecting-ip`, `x-forwarded-for`, and client-supplied alternatives.
- [ ] Wrap `check_rate_limit` and `record_audit` with typed helpers; map false rate-limit results to `429` and RPC failures to opaque safe errors.
- [ ] Keep passwords, credentials, bearer tokens, refresh tokens, invite links, and provider errors out of request logs. Review middleware and helper code statically.

## Task 3: Implement session endpoints in Express

**Files:**
- Create: `tavvi-backend/src/features/auth/auth.schemas.ts`
- Create: `tavvi-backend/src/features/auth/auth.service.ts`
- Create: `tavvi-backend/src/features/auth/auth.controller.ts`
- Create: `tavvi-backend/src/features/auth/auth.routes.ts`
- Modify: `tavvi-backend/src/routes/mobile-v1.routes.ts`

**Interfaces:**
- `POST /session` accepts `{ email, password }`, validates input, rate-limits, authenticates, confirms platform-admin membership, and returns the existing `MobileSession` DTO.
- `POST /session/refresh` accepts `{ refreshToken }` and returns a refreshed `MobileSession` only after admin authorization succeeds.
- `GET /session` is protected by `requirePlatformAdmin` and returns `{ user: { id, email } }`.
- `DELETE /session` accepts the current bearer token, asks Supabase Auth to revoke the remote session, and returns `{ signedOut: true }`; the app still clears local state if this request fails.

- [ ] Define Zod schemas for login and refresh token input, trimming and limiting e-mail and password lengths to the existing API limits.
- [ ] Implement login with an anonymous Supabase client, login rate limit keyed by trusted IP or the existing shared-local fallback, and a user client to check `is_platform_admin`.
- [ ] Keep invalid credentials indistinguishable and return no session for an authenticated non-admin.
- [ ] Implement refresh with Supabase Auth's refresh-token flow, validate the refreshed access token and admin role, and return the same token fields used by the current `MobileSession` DTO.
- [ ] Implement session GET from `AdminContext`; implement DELETE as best-effort remote revocation without logging supplied credentials.
- [ ] Mount the auth router under `/api/mobile/v1/session`, with public POST login/refresh and protected GET/DELETE routes.
- [ ] Read the changed auth files and compare every response field and status with `src/contracts/mobile-api.ts`; do not run tests or typecheck.

## Task 4: Add transactional invitation writes and Express invitation routes

**Files:**
- Create: `supabase/migrations/0017_mobile_admin_atomic_invite_writes.sql`
- Modify: `tavvi-backend/src/integrations/supabase/database.types.ts`
- Create: `tavvi-backend/src/features/invitations/invitation.schemas.ts`
- Create: `tavvi-backend/src/features/invitations/invitation.service.ts`
- Create: `tavvi-backend/src/features/invitations/invitation.controller.ts`
- Create: `tavvi-backend/src/features/invitations/invitation.routes.ts`
- Modify: `tavvi-backend/src/routes/mobile-v1.routes.ts`

**Interfaces:**
- Keep `GET /invites`, `POST /invites`, `GET /invites/:id`, `POST /invites/:id`, and `POST /invites/:id/revoke` DTOs and status semantics aligned with `src/contracts/mobile-api.ts`.
- `createInvitation(context, input)` validates input, enforces mutation rate limit, generates 32 random bytes, hashes the token with SHA-256, calls `create_platform_admin_invite`, and returns `{ id, link }` once.
- `rotateInvitation(context, id)` calls existing `rotate_platform_admin_invite` and returns the new link once; the existing SQL function owns transaction and audit.
- `revokeInvitation(context, id)` calls `revoke_platform_admin_invite` and preserves idempotent repeat behavior.

- [ ] Add `create_platform_admin_invite(p_email, p_expires_in_days, p_token_hash, p_trusted_ip)` as an additive authenticated `SECURITY DEFINER` RPC with empty `search_path`, returning only `id uuid`; validate `auth.uid()`, platform-admin role, non-null 32-byte hash, and integer expiry from 1 to 30 days, then compute `expires_at` inside the transaction. Pass only the proxy-validated IP derived by Express; use null if unavailable.
- [ ] In the create RPC, insert the platform invite and call `record_audit('invite.created', ...)` in the same transaction. Return only the new invite ID and let transaction rollback cover audit failure.
- [ ] Add `revoke_platform_admin_invite(p_invite_id, p_trusted_ip)` as an additive authenticated RPC returning `id uuid, revoked_at timestamptz`, with admin check, platform-invite scoping, row lock/state checks, idempotency for an already-revoked invite, and same-transaction `record_audit` for a first successful revocation. Pass only the proxy-validated IP derived by Express; use null if unavailable. Use `P0002` for not found and `P0001` for a non-pending invite, matching the existing rotation RPC.
- [ ] Revoke public execute and grant execute to authenticated users for the two new functions. Do not modify current RPCs or web contracts.
- [ ] Add the RPC signatures to the backend `Database` snapshot, preserving SQL argument/return names exactly.
- [ ] Move token creation, SHA-256 hashing, link assembly, expiry validation, and DTO mapping from `src/server/invitations.ts` into the backend invitation service. Keep the clear token only in the current response.
- [ ] Map RPC state errors to the existing `404` and `409` codes; never expose SQL details. Ensure audit failures do not return a success response.
- [ ] Add protected routes and controllers for list/create/detail/rotate/revoke, each consuming `AdminContext`. Review whether every mutation is rate-limited and every token is excluded from logs.

## Task 5: Migrate restaurant reads and finish API v1 routing

**Files:**
- Create: `tavvi-backend/src/features/restaurants/restaurant.service.ts`
- Create: `tavvi-backend/src/features/restaurants/restaurant.controller.ts`
- Create: `tavvi-backend/src/features/restaurants/restaurant.routes.ts`
- Modify: `tavvi-backend/src/routes/mobile-v1.routes.ts`
- Modify: `tavvi-backend/src/app.ts`

**Interfaces:**
- `GET /restaurants` returns `MobileRestaurant[]` with only `id`, `name`, `slug`, `segment`, `status`, and `deletedAt`.
- `GET /restaurants/:id` returns `MobileRestaurantDetail` with dates and member DTOs; UUID validation and existing not-found/error semantics remain.
- All restaurant routes require `AdminContext` and make no writes.

- [ ] Port the two existing selects and `list_restaurant_members` RPC from `src/server/restaurants.ts` to a backend service using the user-scoped Supabase client.
- [ ] Preserve current ordering, soft-deleted status display, and member fallback name mapping; do not add fields from full restaurant rows.
- [ ] Validate `:id` as UUID before querying and map missing restaurant to `404 RESTAURANT_NOT_FOUND`.
- [ ] Mount restaurant routes behind `requirePlatformAdmin` and attach `Cache-Control: no-store` to API responses.
- [ ] Read all mounted route declarations and compare the complete route inventory in the spec against the Express router tree.

## Task 6: Replace the app's Supabase session dependency with Express session storage

**Files:**
- Create: `src/lib/session-store.ts`
- Modify: `src/lib/api-client.ts`
- Modify: `src/features/auth/auth-context.tsx`
- Modify: `src/contracts/mobile-api.ts`
- Remove: `src/lib/supabase.ts` after its imports are gone
- Modify: root `package.json` and `pnpm-lock.yaml`

**Interfaces:**
- `sessionStore.get(): Promise<MobileSession | null>`, `sessionStore.set(session): Promise<void>`, and `sessionStore.clear(): Promise<void>` use the existing `secureStoreAdapter` and one fixed key.
- `publicApiRequest<T>(path, init?)` calls the Express origin without bearer auth for login/refresh.
- `apiRequest<T>(path, init?)` loads the stored access token, injects the bearer header, coordinates a module-wide refresh promise after `401`, stores rotated tokens, and retries once.
- `registerSessionInvalidator(handler)` continues to let the auth provider clear user state and TanStack Query cache after permanent invalidation.

- [ ] Create session-store functions over the existing SecureStore adapter. Do not move tokens to AsyncStorage or persist administrative query data.
- [ ] Replace the API client's import of `publicEnv`/Supabase with a minimal `EXPO_PUBLIC_API_URL` config and session-store access.
- [ ] Add refresh coordination so simultaneous `401`s reuse one `POST /session/refresh`; if refresh fails, clear stored credentials, notify the invalidator, and do not retry a second time.
- [ ] Keep request bodies, response parsing, error codes, offline handling, mutation `retry: false`, and response envelope behavior compatible with current query hooks.
- [ ] Update `AuthProvider`: load stored session at startup, validate through `GET /session`, call Express for sign-in, use Express for remote sign-out, and always clear local session/cache on logout or permanent invalidation.
- [ ] Remove all `supabase.auth.*` calls and `@/lib/supabase` imports. Preserve app background validation without starting Supabase SDK auto-refresh.
- [ ] Remove `@supabase/supabase-js` from the root app dependencies and update only the root pnpm lockfile; keep the dependency inside `tavvi-backend`.
- [ ] Review all auth states, temporary network failure behavior, invalidation paths, and token clearing by reading changed files.

## Task 7: Switch app configuration and remove Expo-hosted server code

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `app.json`
- Modify: `docs/deployment/eas-hosting.md` or replace it with `docs/deployment/express-backend.md`
- Remove: `src/app/api/mobile/v1/`
- Remove: `src/server/`

**Interfaces:**
- Expo receives `EXPO_PUBLIC_API_URL` only for backend access; server variables live only in `tavvi-backend` environment.
- README explains separate local processes, LAN addressing for physical devices, and that Express deployment is provider-neutral until selected.

- [ ] Replace sample environment variables so the root app example contains `EXPO_PUBLIC_API_URL` and any currently used mobile-only public URL, but no Supabase URL/key or server-only values.
- [ ] Update README setup to start the backend separately from `npx expo start`; preserve Expo Go guidance only for modules already supported by the current app.
- [ ] Replace EAS Hosting/API-route deployment notes with Express API configuration, required server secrets, HTTPS requirement, and an explicit undecided hosting provider.
- [ ] Remove `web.output: "server"` only after checking the SDK 57 app-config docs and confirming no other web-server feature depends on it; retain ordinary Expo web support if configured.
- [ ] Once all client imports point to Express and route behavior is represented there, remove every file under `src/app/api/mobile/v1/` and `src/server/`.
- [ ] Remove obsolete references to `/api` being served by Expo and to server-only code living under the mobile bundle; use `rg` to review references without running any forbidden command.

## Task 8: Publish the API contract and finish static handoff review

**Files:**
- Create: `docs/api/mobile-v1.md`
- Modify: `README.md`
- Modify: `docs/deployment/express-backend.md`
- Review: `docs/superpowers/specs/2026-09-24-tavvi-mobile-express-backend-design.md`

**Interfaces:**
- API documentation lists all 12 methods/paths including health, session login/refresh/get/logout, invitations, and restaurants, with auth requirements, payloads, DTOs, errors, and cache behavior.
- Deployment notes distinguish local setup from production prerequisites without naming a provider.

- [ ] Document the exact mobile DTO fields for `MobileSession`, `SessionInfo`, `MobileInvite`, `CreatedInvite`, `RevokedInvite`, `MobileRestaurant`, and `MobileRestaurantDetail` from `src/contracts/mobile-api.ts`.
- [ ] Document request schemas, one-time invite-link return behavior, `401` refresh/retry behavior, admin-only routes, error envelope, and HTTP statuses.
- [ ] Document server configuration and the need to apply the additive Supabase migration through the existing database change process; do not apply it to a remote project.
- [ ] Review source references with `rg` for direct Supabase SDK imports in `src/`, stale Expo API route references, service-role strings, token logging, and untrusted forwarded-header parsing.
- [ ] Compare docs and route registrations against the spec. Record unresolved hosting/proxy/retention decisions as deployment prerequisites, not implementation defaults.
- [ ] Do not run automated tests, lint, typecheck, build, git, deploy, or database migration commands.

---

## Self-Review

- **Spec coverage:** Tasks 1–2 cover the standalone Node runtime, typed environment, Express plumbing, Supabase clients, admin authorization, request context, rate limit, proxy handling, and safe errors. Tasks 3–5 cover all session, invite, and restaurant endpoints, including rotation and detail. Task 4 adds atomic create/revoke RPCs and preserves the existing atomic rotation RPC. Tasks 6–7 remove direct app Supabase access and Expo-hosted server code after cutover. Task 8 documents contracts, configuration, and deployment prerequisites.
- **Placeholder scan:** No TBD, TODO, or generic “add appropriate validation” steps are present. Provider selection and production proxy configuration are explicit unresolved deployment decisions from the approved spec.
- **Type consistency:** Backend `ServerEnv`, `AdminContext`, Supabase client factories, session DTOs, invitation services, and restaurant DTOs are named consistently across tasks. Client session-store and API-client signatures are defined before the auth provider consumes them.
- **Review focus coverage:** Credential invalidation is covered by Tasks 2, 3, and 6; shared refresh by Task 6; atomic audit by Task 4; input validation by Tasks 3–5; trusted proxy identity by Task 2. These are source-review obligations only; the project explicitly excludes test execution.
- **Command constraints:** The plan has no commands to run `git`, tests, lint, typecheck, build, deployment, or remote database migration.
