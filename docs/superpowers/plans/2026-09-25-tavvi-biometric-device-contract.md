# Contrato biométrico por dispositivo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir login administrativo após logout por biometria e segredo individual por instalação, com contrato revogável no backend e perfil EAS que gera APK Android.

**Architecture:** O aparelho armazena apenas um segredo aleatório de contrato em uma chave SecureStore que exige autenticação. O Express guarda o hash desse segredo e o refresh token Supabase cifrado com AES-256-GCM, renova e revalida o usuário em cada login por dispositivo e sincroniza a rotação dos refresh tokens. O logout limpa a sessão local sem destruir o contrato biométrico.

**Tech Stack:** Expo SDK 57, `expo-local-authentication`, `expo-secure-store`, `expo-crypto`, React Native, Expo Router, Express 5, Supabase Auth/Postgres/RPC, Zod, Node `crypto`, EAS Build APK.

**Spec:** `docs/superpowers/specs/2026-09-25-tavvi-biometric-device-contract-design.md`

**Versioned references:** [LocalAuthentication SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/local-authentication/), [SecureStore SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/securestore/), [Crypto SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/crypto/), and [EAS JSON](https://docs.expo.dev/eas/json/).

## Global Constraints

- Não executar `git`, testes, typecheck, build ou lint.
- Nunca persistir senha, segredo de contrato em claro fora do SecureStore biométrico, refresh token em claro no banco, nem segredo/ciphertext em logs.
- Confirmar `platform_admin` no backend para login por senha, login por dispositivo e renovações.
- Usar envelopes HTTP existentes `{ data }` e `{ error }`, mensagens opacas e `Cache-Control: no-store`.
- Usar APIs da documentação do Expo SDK 57; não alterar `ios/` ou `android/` manualmente.
- Manter fallback por senha se biometria, armazenamento seguro ou rede não estiverem disponíveis.
- Configurar APK com `android.buildType: "apk"` e `EXPO_PUBLIC_API_URL` HTTPS estável no ambiente EAS de preview.
- Descrever o segredo como bearer revogável, não como chave não exportável nem garantia contra aparelho comprometido.

## Review Focus

- O refresh token Supabase enviado no cadastro pertence à mesma conta do bearer atual; cadastro rejeita qualquer divergência antes de substituir contrato.
- Falha de rede ou gravação depois da rotação externa do refresh token não deixa o app declarar login pronto com sessão não persistida; senha permite recuperar o contrato.
- Cancelamento, biometria indisponível, troca de digital/rosto e valor SecureStore invalidado preservam o acesso por senha e não deixam chave local apontar para contrato revogado.
- Logout deve preservar contrato; desvincular só apaga chave local depois de confirmação do backend, inclusive em falha de rede.
- APK deve incorporar a URL HTTPS correta; ngrok efêmero expirado ou alterado exige hostname reservado ou novo APK.

---

## File Structure

- `supabase/migrations/0018_mobile_device_contracts.sql` — tabela privada e RPCs para cadastro, lookup, refresh cifrado, revogação e rate limit.
- `tavvi-backend/src/features/auth/device-contract-crypto.ts` — envelope AES-256-GCM e validação da chave server-only.
- `tavvi-backend/src/features/auth/device-contract.service.ts` — registro/login/refresh/revogação dos contratos por instalação.
- `tavvi-backend/src/features/auth/auth.schemas.ts`, `auth.controller.ts`, `auth.routes.ts`, `auth.service.ts` — validação, endpoints, integração com Supabase e logout local.
- `tavvi-backend/src/contracts/mobile-api.ts`, `src/contracts/mobile-api.ts` — DTOs HTTP sincronizados entre backend e app.
- `tavvi-backend/src/config/env.ts`, `tavvi-backend/src/integrations/supabase/database.types.ts` — chave AES e tipos das RPCs.
- `src/lib/device-contract-store.ts` — metadados não secretos da instalação e uma chave SecureStore biométrica apenas para o segredo; separado do armazenamento da sessão corrente.
- `package.json`, `pnpm-lock.yaml` — adicionar `expo-crypto` usando o instalador compatível com Expo SDK 57 para gerar o segredo.
- `src/features/auth/auth-context.tsx` — inscrição após login por senha, login biométrico, logout local e revogação deste aparelho.
- `src/features/auth/biometric-button.tsx`, `login-form.tsx`, `login-screen.tsx` — disponibilidade, prompt e feedback de estados biométricos.
- `app.json`, `eas.json` — permissão/backup existentes e perfil Android APK.
- `docs/api/mobile-v1.md`, `docs/deployment/express-backend.md`, `tavvi-backend/.env.example` — novos endpoints, logout, chave de cifragem e URL de build.

## Task 1: Persistência privada e cifra do token Supabase

**Files:**
- Create: `supabase/migrations/0018_mobile_device_contracts.sql`
- Create: `tavvi-backend/src/features/auth/device-contract-crypto.ts`
- Modify: `tavvi-backend/src/config/env.ts`
- Modify: `tavvi-backend/src/integrations/supabase/database.types.ts`

**Interfaces:**
- Produces `EncryptedRefreshToken = { version: 1; ciphertext: string; nonce: string; tag: string }`, codificado em base64.
- Produces `encryptDeviceRefreshToken(refreshToken: string): EncryptedRefreshToken` and `decryptDeviceRefreshToken(envelope: EncryptedRefreshToken): string`.
- Adds required environment property `deviceContractEncryptionKey: Buffer`, loaded from server-only `DEVICE_CONTRACT_ENCRYPTION_KEY` as base64 encoding of exactly 32 bytes.

- [x] **Step 1: Add the private device-contract table and restricted RPCs**

Create `platform_admin_device_contracts` with `id uuid`, `user_id uuid references auth.users on delete cascade`, `device_id uuid`, `device_secret_hash bytea`, `refresh_token_hash bytea`, `refresh_token_ciphertext bytea`, `refresh_token_nonce bytea`, `refresh_token_tag bytea`, `created_at`, `updated_at`, `last_used_at`, and `revoked_at`. Add a unique constraint on `(user_id, device_id)`, a unique index on active `device_secret_hash`, and an index on `refresh_token_hash`. Enable RLS and grant no direct table access to `anon` or `authenticated`.

Add `SECURITY DEFINER` functions with empty `search_path`: authenticated `register_mobile_device_contract(...)` requires `auth.uid()` and `is_platform_admin()`; anonymous `get_mobile_device_contract(device_id, secret_hash)` returns only user ID and encrypted token envelope for an active matching row; `replace_mobile_device_refresh(old_hash, new_hash, ciphertext, nonce, tag)` only updates the matching active row; and `revoke_mobile_device_contract(device_id, secret_hash)` revokes only a matching contract. Reuse the existing rate-limit RPC for public device lookup using an IP bucket in Express plus a hash-derived bucket identifier. Revoke default `PUBLIC` execution and grant only the roles each function needs.

- [x] **Step 2: Add authenticated AES-256-GCM helpers**

Use Node's built-in `node:crypto`, a random 12-byte nonce per encryption, 16-byte authentication tag, and base64 encoding. Reject an unsupported envelope version, malformed base64, a key with the wrong decoded length, or authentication-tag failure; never log the token, key, or envelope.

```ts
export type EncryptedRefreshToken = {
  version: 1
  ciphertext: string
  nonce: string
  tag: string
}

export function encryptDeviceRefreshToken(refreshToken: string): EncryptedRefreshToken
export function decryptDeviceRefreshToken(envelope: EncryptedRefreshToken): string
```

- [x] **Step 3: Validate the backend encryption environment**

Parse `DEVICE_CONTRACT_ENCRYPTION_KEY` from base64 and reject startup if it is absent or does not decode to 32 bytes. The backend exposes device-contract endpoints in this release, so it must fail startup if the required key is missing or malformed; password fallback remains available when the service is configured correctly but one stored contract cannot be decrypted.

- [x] **Step 4: Add precise RPC result types**

Update `database.types.ts` with exact args and returns for the four new RPCs. Model bytea fields using the same string representation used by the existing generated Supabase types, and keep the record out of the app-facing contract.

- [x] **Step 5: Review migration and crypto boundaries statically**

Confirm table grants do not expose rows, all definer functions set `search_path = ''`, every contract lookup is hash based, ciphertext uses a fresh nonce, and the decoded key never enters client DTOs. Do not run SQL tests or project commands.

## Task 2: Express device-contract API and refresh rotation

**Files:**
- Create: `tavvi-backend/src/features/auth/device-contract.service.ts`
- Modify: `tavvi-backend/src/features/auth/auth.schemas.ts`
- Modify: `tavvi-backend/src/features/auth/auth.controller.ts`
- Modify: `tavvi-backend/src/features/auth/auth.routes.ts`
- Modify: `tavvi-backend/src/features/auth/auth.service.ts`
- Modify: `tavvi-backend/src/contracts/mobile-api.ts`

**Interfaces:**
- `DeviceContractRegistrationInput = { deviceId: string; deviceSecret: string; refreshToken: string }`.
- `DeviceContractLoginInput = { deviceId: string; deviceSecret: string }`.
- `registerDeviceContract(context, input): Promise<MobileSession>` verifies/renews the supplied refresh token and binds it to the bearer user's ID.
- `signInWithDeviceContract(input, ip): Promise<MobileSession>` finds/decrypts/renews the active contract session and confirms admin.
- `revokeDeviceContract(input: { deviceId: string; deviceSecret: string }): Promise<{ revoked: true }>` uses the device proof and affects only that installation, including after logout.

- [x] **Step 1: Add bounded Zod inputs and client-safe DTOs**

Validate UUID `deviceId`, `deviceSecret` as exactly 64 lowercase hexadecimal characters (32 random bytes), refresh token up to 4096 characters, and optional label up to 80 characters with control characters removed. Do not define any request/response type that contains the encryption key or ciphertext in the mobile contract.

- [x] **Step 2: Implement contract registration with same-user verification**

Require authenticated context and current admin identity. Call Supabase `refreshSession` with the supplied refresh token, verify the resulting user ID equals `context.user.id`, verify `platform_admin` on the new access token, encrypt the new refresh token, and persist hashes/envelope through the authenticated RPC. Return the renewed `MobileSession` so the app replaces its current session. On mismatch, revoke the newly obtained remote session and reject without replacing any existing contract.

- [x] **Step 3: Implement biometric device login**

Rate-limit the request by trusted IP and a hash of `deviceId`/secret. Call the public lookup RPC using `SHA-256(deviceSecret)`; return one uniform unauthorized error for missing/revoked contracts. Decrypt the refresh token, renew through Supabase Auth, require both the recorded user ID and `platform_admin` to match, encrypt the newly rotated refresh token, update the row by the old refresh hash, then return `MobileSession`. If any authorization or persistence step fails, do not return the new session and attempt remote cleanup where safe.

- [x] **Step 4: Keep contract ciphertext synchronized in normal refresh**

Preserve the existing public refresh behavior for password-only sessions. After successful Supabase refresh, compute the old refresh-token hash and attempt the atomic contract update RPC. If no active device contract matches, return the normal session unchanged. If a contract matches but encryption/persistence fails, fail the refresh response so the client does not accept a session that cannot be used for future biometric login.

- [x] **Step 5: Add routes and controller wiring**

Mount `POST /device` and `POST /device-contract` under the existing `/session` router. Mount `DELETE /device-contract` as a public route requiring `{ deviceId, deviceSecret }`, with constant-shape failure responses and rate limit, so unlink works after logout. Keep the existing `/session` `GET` admin check.

- [x] **Step 6: Change logout to preserve the device contract**

Update `signOut` to return `{ signedOut: true }` without calling Supabase remote logout. This route only acknowledges local app sign-out; access tokens already issued remain subject to their normal expiry. Device-contract revocation is the explicit way to prevent future biometric sign-ins for this installation.

- [x] **Step 7: Review backend state transitions statically**

Trace password login → registration → authenticated refresh → logout → device login → contract revoke. Confirm the same-user check, admin check, rate limiting, uniform invalid-secret response, no token logs, and no service-role key. Do not run backend compile or tests.

## Task 3: SecureStore contract and mobile API client

**Files:**
- Create: `src/lib/device-contract-store.ts`
- Modify: `src/contracts/mobile-api.ts`
- Modify: `src/lib/api-client.ts`
- Modify: `src/features/auth/auth-context.tsx`

**Interfaces:**
- `deviceContractStore.getMetadata(): Promise<{ deviceId: string; registered: boolean } | null>` reads non-secret installation metadata without prompting.
- `deviceContractStore.ensureDeviceId(): Promise<string>` creates/persists a random UUID when metadata is absent.
- `deviceContractStore.getSecret(): Promise<string | null>` reads the separate biometric-protected SecureStore key.
- `deviceContractStore.setSecret(secret): Promise<void>` stores only the secret using `requireAuthentication: true` and the Portuguese authentication prompt.
- `deviceContractStore.markRegistered(registered): Promise<void>` updates the non-secret metadata flag; `clearSecret(): Promise<void>` removes only the protected secret. Keep `deviceId` so password re-enrollment updates the same installation record.
- Auth context adds `signInWithBiometrics()`, `disableBiometrics()`, and internally attempts `enrollDeviceContract(session)` after successful password sign-in.

- [x] **Step 1: Create a dedicated one-key biometric store**

Store metadata `{ deviceId, registered }` under a normal SecureStore key and store only `deviceSecret` under a separate versioned key (`tavvi.mobile.device-secret.v1`) with `requireAuthentication: true`. Validate both values with Zod; invalid metadata is regenerated and a missing/invalid protected secret clears only the registered flag. Pass the same options to protected reads/writes/deletes: `requireAuthentication: true`, `authenticationPrompt: 'Confirme sua identidade para entrar na Tavvi'`, and `WHEN_UNLOCKED_THIS_DEVICE_ONLY` on iOS. Do not use the chunked `secureStoreAdapter` for the protected secret.

```ts
export const deviceContractStore = {
  getMetadata(): Promise<{ deviceId: string; registered: boolean } | null>
  ensureDeviceId(): Promise<string>
  getSecret(): Promise<string | null>
  setSecret(secret: string): Promise<void>
  markRegistered(registered: boolean): Promise<void>
  clearSecret(): Promise<void>
}
```

- [x] **Step 2: Extend mobile API DTOs**

Add exact request types for device login and registration. Continue using `MobileSession`, `ApiSuccess` and `ApiFailure`. The `EncryptedRefreshToken` stays backend-only.

- [x] **Step 3: Add password-login enrollment**

Add `expo-crypto` with `npx expo install expo-crypto` (the repository has `pnpm-lock.yaml` and no Bun lockfile). Generate the device ID with `Crypto.randomUUID()` and exactly 32 secret bytes with `Crypto.getRandomBytesAsync(32)`, encoding the secret as 64 lowercase hexadecimal characters. After password login stores `MobileSession`, read non-secret contract metadata. If it is not marked registered, check native platform, hardware, enrollment, and `SecureStore.canUseBiometricAuthentication()`. For iOS call `LocalAuthentication.authenticateAsync` before creating the protected entry; for Android let the protected SecureStore write trigger its own prompt, avoiding a duplicate prompt. Reuse/create the metadata `deviceId`, store the local secret, call registration, replace the session with the rotated `MobileSession`, then mark metadata registered. If registration fails, remove the local secret and keep password login authenticated with a clear message that biometric activation did not finish.

- [x] **Step 4: Implement biometric login state transition**

Read the secret (native prompt is triggered by SecureStore) and `deviceId` from non-secret metadata, call `POST /session/device`, store returned `MobileSession`, clear query cache, set user/status authenticated. On cancel, preserve the contract and keep the login form available. On definitive unauthorized/forbidden or key invalidation, remove the protected secret, set `registered: false`, clear any active session, preserve `deviceId`, and ask for password. On network error, preserve the contract and show retry/fallback.

- [x] **Step 5: Preserve biometric contract on sign-out and implement unlink**

Change `signOut()` so it does not call the Supabase-revoking `DELETE /session`; clear `sessionStore`, query cache, user, and auth status only. `disableBiometrics()` reads the proof from SecureStore, calls the revocation endpoint, and only after confirmed success removes the protected secret and sets `registered: false`; retain `deviceId` for later re-enrollment.

- [x] **Step 6: Coordinate refresh persistence**

When `api-client.ts` refreshes a session, replace `sessionStore` with returned tokens as today. The backend has already synchronized the encrypted biometric refresh token. Keep the current single-flight refresh and compare-before-replace protections unchanged.

- [x] **Step 7: Review local secret handling statically**

Confirm the biometric key is a single item with authentication required, generated secret uses cryptographic randomness, raw secret appears only in the API body and protected store, password is never stored, and normal logout does not delete the contract. Do not run tests or Expo commands.

## Task 4: Login UI states and recovery

**Files:**
- Modify: `src/features/auth/biometric-button.tsx`
- Modify: `src/features/auth/login-form.tsx`
- Modify: `src/features/auth/login-screen.tsx`
- Modify: `src/features/auth/auth-context.tsx`

**Interfaces:**
- Biometric button receives `hasDeviceContract`, `onBiometricSignIn`, and `onDisableBiometrics` in addition to the current palette.
- States are `checking`, `available-with-contract`, `available-without-contract`, `unavailable`, `authenticating`, and `error`.

- [x] **Step 1: Replace the informational button behavior**

When non-secret metadata says a contract exists, label the accessible button with the detected modality and invoke biometric login; do not read the protected key just to render the screen. Without a registered contract, hide the shortcut or keep it disabled without claiming it can sign in. Keep hardware/enrollment reasons available to the form after password login.

- [x] **Step 2: Present post-password enrollment feedback**

During first successful password login, show the native enrollment prompt and prevent duplicate submissions. If canceled or unsupported, finish sign-in and show a short non-blocking message that biometric login is not activated. If successful, only show authenticated app screens after the backend registration and new session are safely stored.

- [x] **Step 3: Add current-device unlink affordance**

When a local contract exists, provide “Desativar biometria neste aparelho” on the login form. On success, hide the biometric button and confirm removal. On network failure, preserve the contract and explain that server revocation could not be confirmed.

- [x] **Step 4: Keep email/password recovery visible**

Keep form entry available on every signed-out state, including biometrics canceled, locked out, or unavailable. Do not auto-loop the biometric prompt or store email/password for convenience.

- [x] **Step 5: Review observable UI states manually by source**

Inspect labels, disabled/busy state, keyboard behavior, accessibility roles, cancel/error messages, and login fallback. No UI tests or visual build are run under project instructions.

## Task 5: APK profile and stable API origin

**Files:**
- Create: `eas.json`
- Modify: `app.json`
- Modify: `docs/deployment/express-backend.md`

- [x] **Step 1: Add Android application ID**

Set a stable reverse-domain ID, initially `com.tavvi.mobile`, under `expo.android.package`. Confirm it has not already been assigned to another published Tavvi app before the first store release; changing it after distribution creates a different Android app identity.

- [x] **Step 2: Add EAS APK profile**

Create the following minimal `eas.json` profile configured for internal distribution and APK output:

```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "environment": "preview",
      "android": { "buildType": "apk" }
    }
  }
}
```

Do not add an arbitrary EAS project UUID. `extra.eas.projectId` is currently absent, so document that the project must be linked to EAS before invoking a cloud build.

- [x] **Step 3: Configure the preview API environment**

Document the EAS `preview` environment variable `EXPO_PUBLIC_API_URL` as the full HTTPS origin of the Express service, without trailing slash or API path. The current `.env.local` host uses `ngrok-free.dev`; copy its full current origin into the EAS `preview` environment or reserve a stable ngrok hostname. The EAS cloud environment does not inherit the local file automatically. If the ngrok host changes, update EAS and create a new APK.

- [x] **Step 4: Preserve native biometric plugins and backup behavior**

Keep existing `expo-local-authentication` Face ID permission and `expo-secure-store` Android backup configuration. Verify no native project directories are manually edited and no additional Android permission is introduced without SDK 57 docs requiring it.

- [x] **Step 5: Review generated build configuration statically**

Read `eas.json` and `app.json` as JSON and confirm profile name, APK build type, package ID, native plugins, and URL variable instructions. Do not run EAS, Expo prebuild, or a build command.

## Task 6: API and operations documentation

**Files:**
- Modify: `docs/api/mobile-v1.md`
- Modify: `docs/deployment/express-backend.md`
- Modify: `tavvi-backend/.env.example`
- Modify: `tavvi-backend/src/config/env.ts`

- [x] **Step 1: Document session/device endpoints**

Add payloads, authentication requirements, response DTOs, status codes, rate limits, role validation and revocation behavior for register/login/unlink. Clarify that device ID is an installation label, unlink is public but requires the high-entropy device secret, and password remains the fallback.

- [x] **Step 2: Clarify logout semantics**

State that app logout clears local access/session/cache while retaining the device contract. Explicitly distinguish logout from “Desativar biometria neste aparelho,” which revokes future device login. Mention issued access tokens expire normally and no immediate provider-session revocation is promised.

- [x] **Step 3: Document encryption-key provisioning and recovery**

Add `DEVICE_CONTRACT_ENCRYPTION_KEY=` to `tavvi-backend/.env.example` with a comment that it must be a base64 value decoding to 32 random bytes and must never be copied into the mobile app. Document generation in a backend secret manager and the exact consequence of losing/changing it: existing ciphertexts cannot decrypt and users must sign in by password and enroll again. For this first version, key rotation is a controlled maintenance window that deliberately requires device re-enrollment; do not promise ciphertext backfill.

- [x] **Step 4: Document EAS APK workflow requirements without running it**

Explain `preview` creates APK, requires EAS project linking, requires `EXPO_PUBLIC_API_URL` in EAS `preview` environment, and needs a stable HTTPS API hostname. Do not claim the profile or APK was built successfully.

- [x] **Step 5: Cross-check docs against DTOs and configuration**

Review endpoint names, JSON field names, error envelope, environment variable spelling, package ID and profile name against source files. No tests or builds.

## Manual acceptance matrix for the user after a future APK build

This is a hand-run acceptance checklist, not a test suite or command to execute during implementation:

1. On a real Android phone with biometrics enrolled, sign in with email/password; verify the OS prompt appears and a device contract registers.
2. Sign out, then tap the biometric button; verify one biometric prompt and successful authenticated app entry without form credentials.
3. Cancel/lock out the prompt; verify the password form remains usable and no session is granted.
4. Disable biometrics while signed out; verify the API confirms revocation before the local shortcut disappears.
5. Change enrolled biometrics or clear app data; verify stale protected storage falls back to password and can register again.
6. Disconnect the network during biometric login and revocation; verify retry behavior and that failed revocation does not falsely clear the contract.
7. Remove the user's admin role or revoke the contract server-side; verify biometric login is rejected and local shortcut is cleared.
8. Verify APK requests the intended current HTTPS ngrok hostname; change the hostname in EAS environment and note that an already-created APK still contains the previous value.
