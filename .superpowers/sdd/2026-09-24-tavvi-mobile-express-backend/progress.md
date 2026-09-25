# SDD ledger — plan: docs/superpowers/plans/2026-09-24-tavvi-mobile-express-backend.md

Ruling: Skip the Git worktree and git-based plan scripts — repository instructions prohibit every `git` command, so execution stays in the approved workspace — cost if wrong: uncommitted changes are not isolated from other workspace edits.

Pre-flight shared interfaces:
- Task 1 → Task 2: `ServerEnv`, `HttpError`, response helpers, and `createApp()` are consumed by Supabase factories, security middleware, and domain routes; plan names align.
- Task 2 → Tasks 3–5: `AdminContext`, `requirePlatformAdmin`, typed Supabase clients, rate limit, and audit helpers are consumed by auth/invitation/restaurant services; plan names align.
- Tasks 3–5 → Task 6: session/feature endpoint DTOs are consumed by app auth and query hooks; API contracts are mirrored in the app package and backend docs.
- Tasks 6–7 → Task 8: environment names, auth lifecycle, route inventory, and removal of Expo server code feed API/deployment documentation; plan names align.

Constraint: No test, typecheck, build, lint, or git commands. Review changed source and docs statically only.

Ruling: Make the invite-create RPC accept `expires_in_days` and compute the expiry in SQL — validating a server-computed timestamp against a strict 1-day minimum would reject valid requests due to network latency; DB-side integer validation also protects direct RPC callers — cost if wrong: expiry calculation shifts by the short interval between validation and insert (which is negligible and gives one consistent DB timestamp).

Ruling: Let logout middleware require a valid user session but not `platform_admin` — revocation must remain available after admin role removal; all data operations continue requiring admin — cost if wrong: a valid non-admin can revoke only their own session, which is the expected account control.

Ruling: Pass the Express-derived trusted IP into the new atomic invitation RPCs for audit — this preserves the existing server audit metadata while taking the value from the socket or configured proxy, never from the JSON payload — cost if wrong: an authenticated administrator could call the public Supabase RPC directly and spoof only their own audit IP.

Static review completed: active app code references only the Express API for session, invitation, and restaurant operations; the Supabase SDK, embedded `src/server/`, and Expo API routes are absent. Backend route mounts, service DTOs, RPC names/arguments, migration signatures, and server environment names align. Added a repository ignore rule for nested `.env` files and changed backend scripts to load an optional local `.env` with Node 22.9+, matching the documented runtime while preserving externally injected production variables. No tests, typecheck, build, lint, Git, deployment, or remote migration commands were run. Registry package installation was not completed because pnpm reported the backend `node_modules` virtual store points outside this project; no dependency addition was retained.
