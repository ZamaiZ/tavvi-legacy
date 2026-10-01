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

Web push also requires `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` (`mailto:` or an `https://` URL that is not localhost). Generate one key pair per environment with `pnpm --filter @tavvi/web push:keys` and keep it stable: rotating it invalidates every subscription until each device reopens the app. The private key is server-only. Apply `supabase/migrations/0024_push_notifications.sql` before enabling push.

The canonical API target is `/api/v1`. During the incremental migration, Mobile still uses its existing route and Web still has unmigrated server-side Supabase data access. Do not remove either path until the corresponding migration phase and the Mobile minimum-version gate are complete.

The root `supabase/migrations/` directory is the single numbered migration history. Keep applied migration numbers and contents unchanged. Update generated `supabase/schema.sql` from that history instead of hand-editing it.
