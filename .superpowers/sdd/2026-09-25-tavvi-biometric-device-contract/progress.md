# SDD ledger — plan: docs/superpowers/plans/2026-09-25-tavvi-biometric-device-contract.md

Ruling: Run in the existing checkout without a worktree, tests, verification commands prohibited by AGENTS.md, or commits — the repository instructions explicitly forbid `git`, tests, typecheck, build and lint, overriding the execution skill's normal workflow — cost if wrong: no isolated diff history and no automated runtime evidence.

Ruling: Keep an installation ID in non-authenticated SecureStore metadata and the bearer secret in a separate `requireAuthentication` entry — reading the secret only when the user taps biometric avoids an unsolicited prompt when rendering the login screen — cost if wrong: the metadata flag can become stale and must be reconciled on credential rejection.

Ruling: Follow the approved design spec endpoint mapping (`POST /session/device` logs in and `POST /session/device-contract` registers) where it conflicts with the plan's reversed names — the spec was the binding artifact approved by the user — cost if wrong: a client built against the plan's route naming will need its route updated.

Ruling: Implement without TDD runs because AGENTS.md explicitly prohibits tests and commands; review behavior via source tracing and config/document inspection only — cost if wrong: runtime regressions can remain undiscovered until device acceptance.

Pre-flight interface: Task 1 → Task 2: crypto envelope `version/ciphertext/nonce/tag`, environment key and typed Supabase RPCs; align exact base64 field names before service implementation.

Pre-flight interface: Task 2 → Task 3: device register/login/revoke payloads use `{ deviceId, deviceSecret, refreshToken? }`; device login returns `MobileSession`, registration also returns the rotated `MobileSession`; client must store session before marking local contract registered.

Pre-flight interface: Task 3 → Task 4: `AuthContext` owns enrollment, device login and unlink; the login button reads non-secret metadata only and calls the exposed methods.

Pre-flight interface: Task 5 → Task 6: EAS profile name is `preview`, uses APK output, and consumes `EXPO_PUBLIC_API_URL` from EAS's preview environment; deployment docs must state the `.env.local` value is not inherited by cloud builds.

Task 1: implemented; statically reviewed crypto boundaries, environment validation, RPC grants/signatures, and migration. Remote migration remains unapplied.
Task 2: implemented; statically traced password login → registration → refresh sync → local logout → device login → revocation. Route names follow the approved spec.
Task 3: implemented; secret is isolated in one biometric-protected SecureStore entry; password is not persisted; refresh client behavior remains single-flight.
Task 4: implemented; login shortcut, native enrollment prompt, failure recovery, password fallback, busy state, and unlink action reviewed by source.
Task 5: implemented; app ID and EAS `preview` APK profile parsed as JSON; cloud API URL and EAS project linking are documented.
Task 6: implemented; endpoint, logout, key recovery, migration and APK operations docs cross-checked against source/config.

Final review: self-review (no subagent dispatch; workspace instructions prohibit git-based diff review and multi-agent instructions disallow delegation). No Critical or Important findings remain after the final pass. No runtime build/device acceptance was performed.

Validation policy: Static source/config/document review only. No tests, typecheck, lint, build, EAS commands or git commands. Static checks confirmed valid JSON config, `com.tavvi.mobile`, `preview` APK output, installed `expo-crypto`, and one non-empty local key decoding to 32 bytes. Expo SDK 57 docs were consulted for SecureStore and LocalAuthentication.
