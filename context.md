# FounderStage — current state

**Last verified:** 2026-08-25 against commit `b6a07b7` (the only commit on `master`).

This file is a factual inventory, not a plan. It records what is on disk and what runs, so that
nobody has to re-derive it. Where something is half-built or dangling, it says so. The product
requirements live in [docs/PRD.md](docs/PRD.md); the reasoning behind each architectural choice
lives in [docs/adr/](docs/adr/).

---

## One-paragraph summary

FounderStage is a premium founder-ecosystem app — one codebase targeting Android, iOS and Expo Web,
with Supabase as the backend. It is currently a **foundation with no working backend and no product
features**. The design system, error model, logging, storage, navigation shell, query client, cache
persistence, and type-level contracts are real and tested. Authentication does not authenticate, the
database has a `config.toml` but no migrations, and every product surface is a placeholder screen.
`npm run verify` is **not green** — Prettier reports 16 unformatted files and
`FileDropzone.test.native.tsx` fails on both ios and android projects (4 tests fail).

---

## Stack

| Concern      | Choice                                                                        |
| ------------ | ----------------------------------------------------------------------------- |
| Runtime      | Expo SDK `~57.0.15`, React Native `0.86.2`, React `19.2.3`, Hermes            |
| Arch         | New Architecture only — SDK 57 removed the legacy opt-out                     |
| Routing      | `expo-router ~57.0.15`, `typedRoutes: true`                                   |
| Targets      | iOS, Android, Web (`output: 'single'` — static SPA, ADR-0012)                 |
| Backend      | Supabase (`@supabase/supabase-js ^2.112.3`) — **client written, no database** |
| Server state | TanStack Query `^5.102.2` + `persist-client` + `async-storage-persister`      |
| Local state  | Zustand `^5.0.15` — used only by the onboarding draft store                   |
| Validation   | Zod `^4.4.3` + `react-hook-form ^7.86.0`                                      |
| Lists        | `@shopify/flash-list 2.0.2` — **installed, not yet used**                     |
| Errors       | Sentry `~7.11.0`                                                              |
| Theme        | Single light theme, no dark mode (ADR-0013)                                   |

Recently installed for chat work and **not yet used anywhere**: `expo-file-system ~57.0.5`,
`expo-notifications ~57.0.14`, `expo-image-picker ~57.0.13`, `expo-document-picker ~57.0.1`,
`expo-audio ~57.0.4`. Their config-plugin entries and iOS permission strings are in `app.config.ts`.

---

## What is real and tested

### `src/core/` — 106 files

| Module           | State          | What it is                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `config/`        | ✅ tested      | `env.ts` validates every `EXPO_PUBLIC_*` at import time. Refuses to boot if the anon key carries a `service_role` claim.                                                                                                                                                                                                                                                                                                                                           |
| `design-system/` | ✅ tested      | 21 components, 7 token groups, `createStyles` (per-theme `WeakMap`), `useTheme`, `useBreakpoint`. 9 component test suites + 2 theme tests.                                                                                                                                                                                                                                                                                                                         |
| `errors/`        | ✅ tested      | `AppError` with 11 closed kinds, `userMessage` vs `message`, `retryable`/`reportable`; `toAppError`; `normalise`.                                                                                                                                                                                                                                                                                                                                                  |
| `observability/` | ✅ tested      | `logger` + `redact` + transports. `console.*` is a lint error everywhere else.                                                                                                                                                                                                                                                                                                                                                                                     |
| `storage/`       | ✅ tested      | `KeyValueStore` port; `createChunkedStore` (1800-byte chunks — Android SecureStore rejects >2048); `secureStore` native+web; `appStore`; `STORAGE_KEYS`.                                                                                                                                                                                                                                                                                                           |
| `database/`      | ⚠️ partial     | `client.ts` (one Supabase client, PKCE, secure session storage) and `errors.ts` (454 lines mapping PostgREST/SQLSTATE/GoTrue → `AppErrorKind`) are done and tested. `schema.ts` is a **hand-written placeholder** — no generated types, because there is no database.                                                                                                                                                                                              |
| `encoding/`      | ✅ tested      | `base64url` that works on all three targets (no `Buffer`, no `atob`).                                                                                                                                                                                                                                                                                                                                                                                              |
| `haptics/`       | ✅ tested      | Thin wrapper, already used by `Select`.                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `navigation/`    | ✅             | `AppHeader`, `ScreenHeader`, `SideRail`, `TabBar`, `NavIndicator`, `NavItem`, `destinations.ts`. 10 files.                                                                                                                                                                                                                                                                                                                                                         |
| `query/`         | ✅ implemented | `client.ts` (full `QueryClient` with retry policy, rate-limit awareness, exponential backoff), `persister.ts` (whitelist-only persistence for `static`/`reference` tiers), `reset.ts` (sign-out cache clearing + session removal), `repository-query.ts` (wrapper with timing, normalisation, slow-call logging), `cache-policy.ts` (7 tiers), `cursor.ts` (keyset cursor codec). **Not yet wired into `_layout.tsx`** — the `QueryClientProvider` is not mounted. |
| `crypto/`        | ⚠️ port only   | `MessageCipher` port + `PlainCipher` identity impl — the seam that keeps an E2EE retrofit possible.                                                                                                                                                                                                                                                                                                                                                                |
| `ids/`           | ✅             | Branded ID types (`unique symbol`) + `newUuid()` via `expo-crypto`.                                                                                                                                                                                                                                                                                                                                                                                                |
| `realtime/`      | ⚠️ port only   | `transport.ts` — a generic port with `unknown` payloads and an `onGap` callback for reconnect gaps. **No implementation.**                                                                                                                                                                                                                                                                                                                                         |

**Design-system components available:** `Avatar` `Banner` `Button` `Card` `Checkbox` `Chip`
`Divider` `FileDropzone` `FocusRing` `Icon` `IconButton` `Marquee` `ProgressSteps` `Screen` `Select`
`Skeleton` `Spinner` `Stack` `Text` `TextField` `TextLink` `Wordmark`.

`Stack` carries a token-only `style` escape hatch, and `createStyles` is exported to features — so
feature UI can be built without adding design-system components and without importing `View`.

### 22 test files → 55 test suites (3-project matrix) → 1263 tests

Test files: `env`, `errors` (database), 9 design-system components (`Button`, `Card`, `Divider`,
`FileDropzone`, `Icon`, `Screen`, `Skeleton`, `Spinner`, `Text`), `theme`, `use-breakpoint`,
`base64url`, `app-error`, `normalise`, `haptics`, `logger`, `redact`, `cursor`, `chunked-store`,
`secure-store`.

Native-only rendering suites use `*.test.native.tsx` (ADR-0019). Jest runs a three-project matrix
(ios, android, web), so 22 test files produce 55 suites.

**Current test status:** 53 suites pass, 2 fail (`FileDropzone.test.native.tsx` on ios and android —
"Optional" text assertion mismatch). 1222 tests pass, 4 fail, 37 skipped.

---

## What is a shell

### `src/features/` — 29 files

| Feature       | Reality                                                                                                                                                                                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth/`       | **UI only.** `WelcomeView`, `LoginView`, `SignupView` + two RHF/Zod form hooks + helper components (`LegalNote`, `OrDivider`, `WelcomeHero`). `onSubmit` is a _parameter_ — there is no repository, no session, no Supabase call. Signing in is not implemented.                |
| `onboarding/` | **UI only.** 5 step views (`AboutYouView`, `CompleteView`, `InterestsView`, `RoleView`, `VerificationView`), an `OnboardingLayout`, a Zustand draft store, and the real taxonomies (10 roles, sectors, 7 stages, cities, 5 interest categories). Nothing is persisted anywhere. |
| `messaging/`  | **Types only.** 7 files: `enums`, `ids`, `permission`, `profile`, `message`, `conversation`, `attachment`. No api, no hooks, no components, no screens.                                                                                                                         |

### `src/app/` — 18 routes

`_layout.tsx` installs `ThemeProvider` + `StatusBar` + `Stack` and **nothing else** — no query
client provider, no auth provider. Its docblock says the provider wrapper arrives "query client in
stage 5, auth in stage 6".

- 5 tab routes — `index` (Home), `capital`, `tools`, `hire`, `marketplace` — all placeholders
- `chat.tsx` — placeholder reading "No conversations yet"
- `notifications.tsx` — placeholder
- `welcome`, `login`, `signup` — wired to the auth views, which do not authenticate
- 5 `onboarding/*` routes (`about-you`, `complete`, `interests`, `verification`, `your-role`)
- `+html.tsx`

### `src/test/` — 2 files

Shared test infrastructure: `index.ts` and `render.tsx` (custom render helpers).

---

## What is absent

- **No database migrations.** `supabase/` exists with `config.toml` only (project `founderstage`,
  `schemas = ["public", "graphql_public"]`, `max_rows = 200`). No migrations, no RLS, no RPCs, no
  seed data. The `db:start` / `db:reset` / `db:types` / `db:test` / `db:lint` npm scripts all point
  at a schema that does not exist.
- **No `src/core/auth/`** — the directory does not exist. No session provider, no auth hooks.
- **No `src/core/network/`** — the directory does not exist. Referenced by the `fetch` ban in
  eslint.config.js but never created.
- **No Supabase realtime adapter** and no subscription manager (only the generic transport port).
- **No product features at all**: feed, funding, events, jobs, marketplace, profiles, incubators,
  tools, notifications. Every one is a placeholder screen.
- **`src/core/database/types.generated.ts`** — the `db:types` output. Cannot be generated without
  migrations.
- **`QueryClientProvider` not mounted** — `src/core/query/` is fully implemented but not wired into
  the app's component tree.

---

## Known dangling references

Two places name a file or module that does not exist:

| Location               | Points at               | Status                                                                                |
| ---------------------- | ----------------------- | ------------------------------------------------------------------------------------- |
| `CLAUDE.md:118`        | `docs/DESIGN_SYSTEM.md` | ❌ missing — `docs/` holds only `CONTRIBUTING.md`, `ENVIRONMENT.md`, `PRD.md`, `adr/` |
| `eslint.config.js:209` | `@/core/network`        | ❌ missing — the `fetch` ban tells you to use a module nobody wrote                   |

Neither breaks the build. The `fetch` ban is still correct in effect: `supabase-js` does its own
fetching, and local file bytes are read through `expo-file-system`, so no caller currently needs an
HTTP client.

---

## Build health

```
typecheck    ✅  passes
lint         ✅  passes
format       ❌  16 files have formatting issues (app.config.ts, context.md, docs/PRD.md,
                  src/app/login.tsx, src/app/signup.tsx, 5 onboarding routes,
                  FileDropzone test, 3 onboarding components, onboarding/model/schemas.ts,
                  tsconfig.json)
arch:check   ✅  passes (1 warning: orphan src/core/realtime/transport.ts)
test         ❌  2 suites fail (FileDropzone.test.native.tsx on ios + android, 4 tests)
```

`npm run verify` is **not green**. Fix with `npm run format:write` (formatting) and updating the
FileDropzone test assertion for the "Optional" text.

---

## Enforcement that actually works

Enforced by `eslint.config.js` + `.dependency-cruiser.cjs`:

- `@supabase/supabase-js` importable **only** from `src/core/database/**` and
  `src/features/*/api/repository.ts`
- No `View`/`Text`/`Pressable`/`StyleSheet`/… from `react-native` outside the design system
- No hex literals, no raw spacing/radius/fontSize numbers in styles
- No `any`; `interface` not `type` for object shapes; separate-style `import type`
- `process.env` readable only in `src/core/config/env.ts`
- No `select('*')` in repositories
- `console.*` only in `src/core/observability/**`
- Features must not import each other; `src/core` must not import up
- **`no-circular` is an _error_** with `tsPreCompilationDeps: true` — type-only imports count as
  graph edges, so a cycle through types alone fails the build
- `strict-boolean-expressions` (no truthiness on strings or numbers), `noUncheckedIndexedAccess`

**19 ADRs**, `0001`–`0019`. They are immutable — supersede with a new one rather than editing.

---

## Blockers

| Blocker                                                                                                                                 | Consequence                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Docker Desktop daemon not running** (`docker --version` reports 29.6.1; `docker info` fails with "Docker Desktop is unable to start") | `supabase start`, `db reset`, `db lint`, `test db` cannot run. Any SQL written is **unverified** until this is up.           |
| **No APNs/FCM credentials**                                                                                                             | Push notification delivery cannot be tested end to end, regardless of code.                                                  |
| **`npm run verify` is not green**                                                                                                       | Prettier formatting (16 files) and FileDropzone test failure (4 tests) need fixing before any work can be committed cleanly. |

---

## The honest next steps

1. **Fix verify.** Run `npm run format:write` and fix the FileDropzone test so the pipeline is
   green.
2. **Wire the query client.** Mount `PersistQueryClientProvider` in `_layout.tsx` — the module is
   fully implemented in `src/core/query/`, it just needs a provider.
3. **Make sign-in real.** Create `src/core/auth/` with a session provider, and wire `login.tsx` /
   `signup.tsx` to Supabase. Nothing user-specific can work until there is a user.
4. **Stand up the database.** Write migrations with `profiles`, RLS and the chat tables; then
   `npm run db:types` so `schema.ts` stops being a placeholder.
