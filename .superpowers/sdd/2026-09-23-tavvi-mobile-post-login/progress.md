# SDD ledger — plan: docs/superpowers/plans/2026-09-23-tavvi-mobile-post-login.md

Ruling: Work directly in the authorized workspace and do not use git/worktrees — AGENTS.md explicitly prohibits git commands.
Ruling: Do not write or execute tests — AGENTS.md explicitly states the project will not work with tests.
Ruling: Use existing Expo SDK 57 and installed @expo/ui BottomSheet where styleable; use its local published type declarations because the SDK site returns 404 for a version-wide llms index.
Ruling: `npx` is unavailable in this environment, so Plus Jakarta Sans and JetBrains Mono are loaded from their official package font files as local assets; no alternative package manager is used.
Ruling: Add a transferable Supabase migration for invite metadata and atomic rotation because `auth.users` is not accessible to the existing PostgREST client; P4 does not need a schema migration.
Decision: P1 approved as atomic replacement, preserving old invite when replacement creation fails.
Decision: P3 approved as environment-configured `EXPO_PUBLIC_MENU_BASE_URL`.
Decision: P4 uses the existing `memberships` table and `list_restaurant_members` RPC; no database migration.

## Implementation update — 2026-09-23

- Replaced the post-login palettes, typography, shell, lists, create sheet, invite detail/revocation, and restaurant detail flows per the approved spec.
- Added `supabase/migrations/0016_mobile_admin_invites.sql` for protected invite actor metadata and atomic pending invite rotation. Transfer and apply it in `nfc-menu` before deploying these API handlers.
- Added cache invalidation after create, discard, and completion; the one-time link completion CTA stays disabled until the link has been copied.
- Removed migrated legacy list/header/state components after confirming there are no remaining source references.
- Source scans found no retired teal values under `src/`, no old palette property accesses, and no client import of `src/server/*`.
- No tests, lint, typecheck, or build were run, per project instructions. The prototype was not visually compared on a browser/device in this session.
