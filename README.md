# Tavvi

Tavvi is a pnpm workspace with a Next.js web application, a small Express service for Web Push delivery, and Supabase for Auth, Postgres, Storage, and Realtime.

## Workspace

- `apps/web`: Next.js application. Authenticated admin and restaurant-panel flows use Supabase SSR with separate host-only cookies; public menus and forms do not create an Auth session.
- `apps/backend`: Express health endpoint and server-only Web Push delivery endpoint.
- `packages/theme-core`: shared panel palette calculations.
- `supabase`: local project configuration, one clean-install migration, and the manual first-admin bootstrap SQL.

## Local setup

Use Node.js 22.9 or newer and pnpm 10.34.5. Install from the repository root with `pnpm install`.

Copy `apps/web/.env.example` to `apps/web/.env.local` and `apps/backend/.env.example` to `apps/backend/.env`. Use credentials for the same Supabase project. The backend requires the Web Push VAPID pair and `APP_SERVER_KEY`; keep private values server-side.

```text
pnpm web
pnpm back
pnpm dev
pnpm ngrok
```

`pnpm dev` starts the web app and backend. Web data access stays in the Next server DAL and talks to Supabase directly. Express receives only an internal push-delivery request from Next.

## Supabase setup

The migration in `supabase/migrations/` builds the current web schema for a new, empty Supabase project. Do not apply it over a database with data. Configure the local Supabase project with the CLI, apply the migration, create the first administrator using `supabase/seed/bootstrap-admin.sql` after creating that account, then set `APP_SERVER_KEY` in the database with `public.set_app_server_key`.

See [monorepo deployment](docs/deployment/monorepo.md) for environment variables, Web Push setup, and the clean database bootstrap procedure.
