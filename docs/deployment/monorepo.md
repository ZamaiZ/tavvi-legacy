# Monorepo development and deployment

The workspace contains three independently deployable applications: `apps/backend` (Express), `apps/mobile` (Expo), and `apps/web` (Next.js). Shared runtime-neutral packages live in `packages/`. Supabase configuration and its ordered migration history are owned at the repository root.

Run `pnpm install` at the root to resolve and install dependencies for every application and package in the workspace. Use these root commands during development:

```text
pnpm back
pnpm expo
pnpm web
pnpm dev
pnpm dev:back-web
pnpm dev:back-expo
pnpm dev:web
pnpm dev:mobile
pnpm ngrok
pnpm approve-build
```

`pnpm back`, `pnpm expo`, and `pnpm web` run one app. `pnpm dev` runs all three development processes; `pnpm dev:web` and `pnpm dev:back-web` run Express and Next, while `pnpm dev:mobile` and `pnpm dev:back-expo` run Express and Mobile. The short aliases reuse the existing pair commands. The pnpm recursive parallel runner prefixes process output and stops sibling processes when one exits. `pnpm ngrok` targets backend port 3002. `pnpm approve-build` is a workspace alias for pnpm 10.34.5's built-in `pnpm approve-builds` command, which records approved dependency scripts in the root configuration.

Use independent deployment settings for each app. For a given environment, set the Web server-only `API_BASE_URL` and Mobile `EXPO_PUBLIC_API_URL` to the same Express API origin. Do not put server credentials or access/refresh tokens in public environment variables.

Web's current Supabase SSR environment also requires `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_ROOT_DOMAIN`. Backend values are documented in `apps/backend/.env.example`; Mobile values are documented in `apps/mobile/.env.example`. Local values belong in ignored `.env` files and must not be committed.

Push delivery (browsers and the Expo console app) runs on Express. Web only signals it: after any action that creates a notification, Web calls `POST /api/v1/internal/push/deliver` on `API_BASE_URL` with the `x-server-key` header. Express claims pending notifications once and sends them through Web Push and the Expo Push Service.

Web Push needs one VAPID key pair per environment. Generate it with `pnpm --filter tavvi-backend push:keys` and keep it stable: rotating it invalidates every subscription until each device reopens the app.
- Backend: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (server-only), and `VAPID_SUBJECT` (`mailto:` or an `https://` URL that is not localhost).
- Web: only the public key, as `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.

Notifications and anonymous feedback require `APP_SERVER_KEY`, the same value on Web and on Backend (server-only, at least 32 characters).
1. Generate one per environment with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.
2. Set it on Web and on Backend.
3. Run `select public.set_app_server_key('<the same key>');` in the Supabase SQL editor.

The database stores only the key's SHA-256 hash; rotating means repeating all three steps.

Apply these migrations in order:
1. `supabase/migrations/0029_notifications.sql`.
2. `0030_restaurant_feedback.sql`.
3. `0031_push_subscriptions.sql`. It recreates the push subscription table and functions from 0024 without the retired `push_events` part, and is safe where 0024 was already applied.
4. `0032_test_notification.sql`, for the "Enviar notificação de teste" button.
5. `0033_mobile_push.sql`, for Expo push tokens and the two-channel claim.

In Supabase, open Realtime → Settings and turn off "Allow public access" so that only private channels exist. After applying migrations, regenerate `supabase/schema.sql` from the history.

Push on the Expo console app (`expo-notifications`) needs a development build, not Expo Go. Run every step with `apps/mobile` as the project root.
1. **Android.** Create a Firebase project with the Android package `com.tavvi.mobile`.
   - Download `google-services.json` into `apps/mobile/` and set `"googleServicesFile": "./google-services.json"` under `expo.android` in `app.json`. This file holds public identifiers and may be committed. Without it, the app shows "falta o google-services.json".
   - Upload the FCM V1 service account key through `eas credentials` → Android → Google Service Account → "Push Notifications (FCM V1)". Never commit the service account JSON.
2. **iOS.** A paid Apple Developer account is required. Accept "Setup Push Notifications for your project" on the first `eas build`.
3. **Build.** Run `eas build --profile development` and install the build on the device.
4. **Optional hardening.** Turn on "enhanced push security" in EAS (Access tokens) and set `EXPO_ACCESS_TOKEN` on Backend.

The canonical API target is `/api/v1`. During the incremental migration, Mobile still uses its existing route and Web still has unmigrated server-side Supabase data access. Do not remove either path until the corresponding migration phase and the Mobile minimum-version gate are complete.

The root `supabase/migrations/` directory is the single numbered migration history. Keep applied migration numbers and contents unchanged. Update generated `supabase/schema.sql` from that history instead of hand-editing it.
