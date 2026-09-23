# SDD ledger — plan: docs/superpowers/plans/2026-09-22-tavvi-mobile-admin.md

Execution mode: inline/native, explicitly chosen by the user.

Ruling: no worktree, commits, task-start or task-done scripts — `AGENTS.md` explicitly prohibits every `git` command — cost if wrong: changes remain in the shared working directory instead of an isolated branch.
Ruling: no automated tests or TDD cycle — `AGENTS.md` and the user explicitly prohibit tests — replacement gate: static inspection, Expo development start, Metro/API observation and manual acceptance checklist — cost if wrong: no automated regression safety net.
Ruling: UI/UX Pro Max search unavailable because Python is not installed — use the approved spec, extracted `nfc-menu` tokens and Expo mobile guidance as visual authority — cost if wrong: no additional catalog match influences the art direction.

Pre-flight Task 1 → Tasks 2–10: aliases and SDK-compatible dependencies match every later import; no conflict.
Pre-flight Task 2 → Tasks 6–10: theme provider, typed palettes and primitives satisfy all visual consumers; no conflict.
Pre-flight Task 3 → Tasks 5–9: mobile DTOs and authenticated HTTP client match API/auth/feature consumers; no conflict.
Pre-flight Task 4 → Task 5: server auth, response and security helpers match route/service consumers; no conflict.
Pre-flight Task 5 → Tasks 6, 8, 9: endpoint envelopes and DTOs match auth and query consumers; no conflict.
Pre-flight Task 6 → Tasks 7–9: auth states and protected route groups match shell and screen consumers; no conflict.
Pre-flight Task 7 → Tasks 8–9: protected shell owns dock/safe-area clearance used by both lists; no conflict.

Task 1: complete — dependencies, aliases, app config and `.env.example` applied; Metro started on port 8082 without the original alias error.
Task 2: complete — typed palettes, theme persistence, Inter typography and accessible primitives applied.
Task 3: complete — DTOs, A/B secure storage, Supabase auth client, HTTP refresh single-flight, memory-only Query Client and formatters applied.
Task 4: complete — server-only schema snapshot, env validation, uniform responses, auth context, rate limit and audit helpers applied.
Task 5: complete — session, invitation and restaurant services/routes applied; unauthenticated probes returned 401/no-store.
Task 6: complete — providers, auth state machine and protected route groups applied.
Task 7: complete — mobile login, adaptive blur, safe-area dock and account/menu overlays applied.
Task 8: complete — invitation list, state derivation, create sheet, one-time link handling and revocation UI applied.
Task 9: complete — read-only restaurant list/cards and presentation states applied.
Task 10: complete — Tavvi monogram assets/config, README and EAS Hosting notes applied; unused starter images removed; no tests/lint/typecheck/build/Git executed.
