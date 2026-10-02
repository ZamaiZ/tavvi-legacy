# Development and deployment

The workspace contains `apps/web` (Next.js), `apps/backend` (Express), and `packages/theme-core`. Supabase configuration and the clean-install migration live at the repository root.

Run these commands from the root:

```text
pnpm web
pnpm back
pnpm dev
pnpm ngrok
pnpm approve-build
```

`pnpm dev` runs Next and Express in parallel. Web domain data and Auth flows use the Next server-side DAL with Supabase; the browser does not call the Express API for application data. Express keeps `/healthz` and the internal Web Push delivery route only.

## Environment

Web requires `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_ROOT_DOMAIN`. It also uses server-only `APP_SERVER_KEY`, `API_BASE_URL`, and `NEXT_PUBLIC_VAPID_PUBLIC_KEY`. See `apps/web/.env.example`.

Backend requires `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `APP_SERVER_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT`. See `apps/backend/.env.example`. The backend does not need a Supabase secret key.

Keep `APP_SERVER_KEY` identical in the Web and Backend environments and in Supabase's `app_server_keys` table. To configure the database after installing the schema, run this in the Supabase SQL editor with the environment's key:

```sql
select public.set_app_server_key('<APP_SERVER_KEY>');
```

Generate one VAPID pair per environment with `pnpm --filter tavvi-backend push:keys`. Keep it stable; replacing it invalidates existing browser subscriptions until they subscribe again. The private key and subject stay in Backend environment variables; only the public key is exposed to Web.

Next calls `POST /api/v1/internal/push/deliver` with the `x-server-key` header after a notification-producing operation. Express claims pending notifications atomically from Supabase, sends browser Web Push, and removes expired subscriptions. The HTTP request returns before delivery completes, so the deployment must keep the Express service available for push delivery.

## Fresh Supabase project

The active migration is a clean baseline for the current Web-only product. It is intended for a new, empty database and replaces the old migration history. Do not apply it to an existing project or use it as a data-preserving upgrade. Rebuild the local/target database from scratch, then:

1. Apply `supabase/migrations/0001_web_baseline.sql` to the empty project.
2. Create the first Auth user through the Web sign-up flow.
3. Replace the example email in `supabase/seed/bootstrap-admin.sql` with the administrator's email and run that file manually in the Supabase SQL editor.
4. Set the project's `APP_SERVER_KEY` with `public.set_app_server_key` as described above.
5. In Supabase Realtime settings, disable public access. The app uses private notification and service-call Broadcast topics with user/restaurant membership checks.

The configured seed path points to the existing bootstrap file, but automatic seeding stays disabled because granting the first platform-admin role is a deliberate manual step.

## Supabase Auth behavior

Panel and platform-admin sessions use distinct host-only cookies, so one browser can hold a session for each territory. Local logout revokes only that browser's current session. The explicit global logout first removes that user's browser push subscriptions, then requests global Auth sign-out. If Auth sign-out fails after subscription cleanup, the UI reports the partial result and keeps the local cookie so the user can retry.

Public menu, feedback, and service-call pages use their scoped server/database operations without creating a user session. Actual simultaneous-session and token-expiry policy is controlled by the hosted Supabase Auth settings and must be set there for each project.
