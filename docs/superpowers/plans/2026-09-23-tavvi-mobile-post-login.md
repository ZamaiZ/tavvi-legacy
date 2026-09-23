# Tavvi Mobile Post-Login Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the post-login screens and shell with the approved lime and ink design from `Redesign de login Tavvi/post-login/Tavvi App.dc.html` while preserving the existing login appearance and API security rules.

**Architecture:** Update theme tokens and shared primitives first, then the shell and list routes, followed by create/detail flows. Keep all database access inside the existing server API modules; the mobile app consumes typed endpoints through React Query. Use the existing `memberships` table and `list_restaurant_members` RPC for restaurant responsible people; no Supabase migration is needed for P4.

**Tech Stack:** Expo SDK 57, React Native 0.86, Expo Router, React Query, `@expo/ui` BottomSheet, React Native SVG, Reanimated, Lucide, Safe Area Context.

**Spec:** User-provided “Spec — Redesign do app Tavvi Mobile (pós-login)” in the conversation.

## Global Constraints

- Do not execute `git`, `typecheck`, `build`, `lint`, or `test` commands; the project instructions explicitly prohibit them and tests are out of scope.
- Before writing code that touches Expo/React Native APIs, read the Expo SDK 57 docs and the relevant specific docs.
- Keep the login visual unchanged; Plus Jakarta Sans replaces Inter only after checking login typography dependencies and loading all requested weights.
- Do not import `src/server/*` from client code.
- Persist only the existing invite token hash; do not add a recoverable pending-link endpoint.
- Keep `EXPO_PUBLIC_MENU_BASE_URL` configurable per environment, as approved by the user.
- Add a transferable migration for protected invite actor metadata and atomic invite rotation; `nfc-menu` already has restaurant memberships, so P4 requires no schema migration.

## Review Focus

- The approved pending invite action is to generate a replacement and revoke the old one; rotation must be atomic so a failed create does not strand the user.
- Restaurant member roles in current migrations use `admin`, `cashier`, `attendant`, and `waiter`; map these literally and do not label them as owners.
- Public menu copying needs the deployment domain supplied through `EXPO_PUBLIC_MENU_BASE_URL`.
- The approved HTML is present on disk, but no browser is connected in this session; source inspection was used for this plan.

---

### Task 1: Theme tokens, fonts, and color migration

**Files:**
- Modify: `src/theme/tokens.ts`
- Modify: `src/theme/typography.ts`
- Modify: `src/theme/theme-context.tsx`
- Modify: `src/providers/app-providers.tsx`
- Modify: `src/features/auth/login-theme.ts`
- Modify: all current consumers of old `colors.*` and status tokens under `src/`

**Interfaces:**
- Preserve `brand.*` names and values for the login.
- Export the new `palettes.dark/light` shapes, `radii`, and existing `spacing`/`motion` with all call sites migrated.
- Add Plus Jakarta Sans weights 400/500/600/700/800 and JetBrains Mono 500 using the SDK 57 documented font-loading API. Do not change login layout or colors.

- [ ] Replace the palette and radii with the values in §§1–2 of the spec.
- [ ] Update CSS variables to the new token names and remove old palette accessors.
- [ ] Migrate every consumer of `primary`, `accent`, `border`, `mutedForeground`, `surface2`, and `status*` to the new names.
- [ ] Load fonts at the root and map typography tokens to Plus Jakarta Sans; use JetBrains Mono only for invite links and slugs.
- [ ] Search source text for the four retired teal values and remove all occurrences.

### Task 2: Shared post-login primitives and shared hero path

**Files:**
- Create: `src/components/primitives/primary-cta.tsx`
- Create: `src/components/primitives/secondary-cta.tsx`
- Create: `src/components/primitives/compact-cta.tsx`
- Create: `src/components/primitives/tonal-button.tsx`
- Create: `src/components/primitives/icon-button.tsx`
- Create: `src/components/primitives/search-field.tsx`
- Create: `src/components/primitives/filter-chips.tsx`
- Create: `src/components/primitives/list-row.tsx`
- Create: `src/components/primitives/skeleton-row.tsx`
- Create: `src/components/primitives/state-card.tsx`
- Create: `src/components/primitives/info-list.tsx`
- Create: `src/components/primitives/section-card.tsx`
- Create: `src/components/primitives/detail-hero.tsx`
- Create: `src/components/shell/notched-path.ts`
- Modify: `src/components/primitives/status-badge.tsx`
- Modify: `src/components/primitives/theme-toggle.tsx`
- Modify: `src/features/auth/login-hero.tsx`

**Interfaces:**
- Shared primitives take theme colors from `useAppTheme()` and accept typed content/action props.
- Export `createNotchedPath({ width, height, radius, notchW, notchH, curve })`; preserve current login path geometry through its existing values.

- [ ] Implement the CTA, button, badge, search, filter, list, state, information, section, and detail primitives using the supplied dimensions.
- [ ] Use `boxShadow` only where React Native 0.86 supports the specified shadow; omit unsupported inset effects.
- [ ] Extract the SVG notch path and preserve the login's current measured path.
- [ ] Update ThemeToggle's large variant to the surface/line2 styling and radius 19.

### Task 3: Shell, pill dock, and floating panels

**Files:**
- Modify: `src/components/shell/mobile-dock.tsx`
- Modify: `src/components/shell/app-shell.tsx`
- Modify: `src/components/shell/adaptive-blur-surface.tsx` only as needed for panel fallback
- Modify: `src/components/primitives/theme-selector.tsx`

**Interfaces:**
- `MobileDock` continues receiving `{ panel, setPanel }` from `AppShell`.
- Use existing `useInvitations`/`useRestaurants` query cache only when already populated; do not create extra queries from the panel.

- [ ] Rebuild the solid 64px pill dock with account, labeled home, and menu controls at the specified safe-area offset.
- [ ] Render a scrim below the dock and above screen content whenever either floating panel opens.
- [ ] Rebuild the account panel with identity, three-way theme selector, and sign out.
- [ ] Rebuild navigation rows with `Mail`/`Store`, route-aware selected states, and cache-derived counts.
- [ ] Keep route-change close behavior and Android back handling.
- [ ] Add reduced-motion-aware panel transitions using existing motion constants.

### Task 4: List hero and invitations list

**Files:**
- Create: `src/components/shell/list-hero.tsx`
- Modify: `src/features/invitations/invitations-screen.tsx`
- Remove after migration: `src/features/invitations/invitation-card.tsx`
- Remove after migration: `src/components/primitives/screen-header.tsx`
- Remove after migration: `src/components/primitives/state-view.tsx`
- Remove after migration: `src/components/primitives/skeleton-card.tsx`

**Interfaces:**
- ListHero receives title, description, summary, optional CTA, and theme preference callbacks.
- Invitation list uses the existing query and `getInviteState` result; filters/search remain local.

- [ ] Implement the 226px dark list hero with shared path geometry, lime glow, clipped brandmark, and synchronized ThemeToggle.
- [ ] Replace invitation header/cards with ListHero, SearchField, FilterChips, ListRow, SkeletonRow, and StateCard.
- [ ] Derive total counts from all loaded invites before applying search/filter; derive row state from `getInviteState`.
- [ ] Add pull-to-refresh and enough bottom padding for the dock.
- [ ] Add Expo Router detail navigation to `/convites/[id]`.

### Task 5: Invitation creation sheet

**Files:**
- Modify: `src/features/invitations/create-invitation-sheet.tsx`
- Modify: `src/components/primitives/form-field.tsx` or create a reusable email field only if required
- Modify: `src/features/invitations/queries.ts`

**Interfaces:**
- Keep the existing `@expo/ui` BottomSheet and `useCreateInvitation` mutation contract.
- Preserve the existing one-time link discard warning.

- [ ] Restyle the BottomSheet to the approved surface, corner, handle, and spacing after checking SDK 57 `@expo/ui` docs.
- [ ] Replace numeric days input with a 1–30 stepper, hitSlop, haptics, and long-press repeat.
- [ ] Build the created-link state with dashed mono field, copy feedback, and completion action.
- [ ] Invalidate invitation queries when the user completes the link step.
- [ ] Preserve e-mail validation and API error copy.

### Task 6: Invitation detail and revoke dialog

**Files:**
- Create: `src/app/(app)/convites/[id].tsx`
- Create: `src/features/invitations/invitation-detail-screen.tsx`
- Create: `src/features/invitations/revoke-dialog.tsx`
- Modify: `src/contracts/mobile-api.ts`
- Modify: `src/server/invitations.ts`
- Modify: `src/features/invitations/queries.ts`
- Create or modify: `src/app/api/mobile/v1/invites/[id]+api.ts`
- Create: `supabase/migrations/0016_mobile_admin_invites.sql`

**Interfaces:**
- Extend `MobileInvite` with `createdAt`, `createdByEmail`, and nullable `redeemedByEmail`; the nfc-menu schema already has `created_at`, `created_by`, and `redeemed_by`.
- Detail route uses `Stack` header hidden and keeps AppShell/dock visible.
- Pending-link CTA rotates the invite atomically and preserves email and remaining validity.

- [ ] Add a transferable migration with admin-checked invite list/detail functions and an atomic invite rotation function.
- [ ] Extend invite list server mapping to return creation and actor metadata through the protected RPC.
- [ ] Add authorized invite-by-id API and React Query detail lookup while keeping server modules out of client imports.
- [ ] Build custom top bar, DetailHero, InfoList, event timeline, and state-specific actions.
- [ ] Replace `Alert.alert` with the specified confirmation modal and optimistic revoked cache update.
- [ ] Implement pending invitation action as atomic replacement; preserve the old invite if replacement creation fails.
- [ ] Allow the regenerate action to prefill email and 7 days in the create sheet.

### Task 7: Restaurant list and detail

**Files:**
- Move: `src/app/(app)/restaurantes.tsx` to `src/app/(app)/restaurantes/index.tsx`
- Create: `src/app/(app)/restaurantes/[id].tsx`
- Modify: `src/features/restaurants/restaurants-screen.tsx`
- Create: `src/features/restaurants/restaurant-detail-screen.tsx`
- Remove after migration: `src/features/restaurants/restaurant-card.tsx`
- Modify: `src/contracts/mobile-api.ts`
- Modify: `src/server/database.types.ts`
- Modify: `src/server/restaurants.ts`
- Create: `src/app/api/mobile/v1/restaurants/[id]+api.ts`
- Modify: `src/features/restaurants/queries.ts`

**Interfaces:**
- Add `MobileRestaurantDetail` with timestamps and `members[] {name,email,role}`.
- The `nfc-menu` repository provides `memberships` and `list_restaurant_members(uuid)` returning `email`, `display_name`, `member_role`, and `joined_at`; no migration is required. Roles currently are `admin`, `cashier`, `attendant`, `waiter`.
- Public menu base comes from an explicit `EXPO_PUBLIC_MENU_BASE_URL` configuration value.

- [ ] Move the list route to the nested index and keep the path `/restaurantes` stable.
- [ ] Replace restaurant list header/cards with ListHero, SearchField, ListRow, SkeletonRow, and StateCard.
- [ ] Filter locally across name and slug; compute initials while ignoring `do/da/de/e`.
- [ ] Add authenticated restaurant detail endpoint, checking `platform_admin`, and load responsible members using the existing RPC.
- [ ] Build restaurant detail with public link copy, members section (including an empty state), InfoList, and read-only footer.
- [ ] Build the public menu URL from the configured base; do not hardcode a production domain.

### Task 8: Cleanup and review checklist

**Files:**
- Modify/remove obsolete shared components only after all imports are migrated.
- Review all files changed in Tasks 1–7.

- [ ] Remove old unused Surface, ScreenHeader, StateView, SkeletonCard, InvitationCard, and RestaurantCard where no references remain.
- [ ] Check all user-provided acceptance items by source inspection and a manual visual comparison when a browser/device is available.
- [ ] Do not run prohibited commands or tests.

## Decisions Recorded

1. P1: **Generate new link** by atomically revoking and replacing the pending invite with the same email and expiry.
2. P3: Build public links from `EXPO_PUBLIC_MENU_BASE_URL`, configured per environment.
3. P4: Use restaurant members from `memberships` and show the empty state when no member rows exist. No schema migration is required.
