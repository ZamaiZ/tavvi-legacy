# Repository instructions

## Project scope

This workspace contains the Next.js web application in `apps/web`, its Express Web Push service in `apps/backend`, shared palette logic in `packages/theme-core`, and Supabase configuration/schema in `supabase/`. Responsive mobile layouts inside `apps/web` are part of the Web product and are not a native mobile app.

## Commands and validation

- Do not run Git commands, typecheck, build, lint, or test commands.
- Do not add or run tests.
- Use static inspection to review changes and report what could not be validated.
- Use pnpm for workspace dependency changes and synchronize the root lockfile.

## Next.js

Before changing Next.js code, read the relevant guide under `apps/web/node_modules/next/dist/docs/`. This repository uses Next.js 16, whose APIs and conventions may differ from earlier versions.

## Supabase

- `supabase/migrations/0001_web_baseline.sql` is the clean-install schema for the current Web product and is intended for a new, empty project.
- Do not apply the baseline over a database with existing data. Existing environments require a deliberate rebuild and project identification.
- The bootstrap SQL for the first platform administrator is manual; do not grant the initial platform-admin role automatically.
- Keep panel and platform-admin cookie sessions separate. Local logout is local to the current browser; global logout remains an explicit action.
- Public menu and public request flows must not create authenticated user sessions.
- The backend retains only Web Push delivery and health monitoring. Keep VAPID private values and `APP_SERVER_KEY` server-side.
