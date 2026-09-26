# Tavvi Workspace

Tavvi is a pnpm monorepo containing the Expo mobile app, the Next.js web app, the Express API, and shared packages. Apps keep independent deployment configurations; Web and Mobile will use the same Express API origin and `/api/v1` contract as their migration completes.

## Workspace

- `apps/backend`: Express API and Supabase server integration.
- `apps/mobile`: Expo Router application.
- `apps/web`: Next.js application and server-side transport adapter.
- `packages/api-contracts`: shared request, response, and error contracts.
- `packages/theme-core`: shared panel palette calculations.
- `supabase`: canonical project configuration, migration history, seed data, and generated schema.

## Local setup

Use Node.js 22.9 or newer and pnpm 10.34.5. Install the workspace from the repository root with `pnpm install`.

Create `apps/backend/.env` from `apps/backend/.env.example`, `apps/mobile/.env.local` from `apps/mobile/.env.example`, and `apps/web/.env.local` from `apps/web/.env.example`. Use the same Supabase project values where applicable. Set Mobile's `EXPO_PUBLIC_API_URL` and Web's server-only `API_BASE_URL` to the Express API origin for that environment.

Run apps individually or use one root command for the processes you need:

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

`pnpm dev` starts all three apps. `pnpm dev:web` or `pnpm dev:back-web` starts Express and Next; `pnpm dev:mobile` or `pnpm dev:back-expo` starts Express and Mobile. The parallel runner prefixes each process and stops sibling processes when one exits. `pnpm ngrok` creates a tunnel to backend port 3002. `pnpm approve-build` calls pnpm 10.34.5's built-in `pnpm approve-builds` command and records selected dependency build approvals at the root.

The API migration is incremental. Existing Mobile API calls remain on the current route until the common `/api/v1` cutover phase; Web domain data continues to use its existing server-side data layer until each domain is migrated.

## Security and deployments

Supabase service and signing secrets belong only in server environment variables. Never commit local environment files. Configure Web and Mobile with the same environment-specific API origin while retaining separate app deployments. See `docs/deployment/monorepo.md` and `docs/deployment/express-backend.md`.
