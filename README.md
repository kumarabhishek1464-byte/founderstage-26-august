# FounderStage

A premium founder ecosystem platform — founders, investors, incubators, accelerators, advisors,
funding, events, jobs, tools and deals — running from **one codebase** on **iOS, Android and Web**.

This repository currently contains the **core platform foundation only**. Product features are built
on top of it and are deliberately not implemented yet. See [`docs/adr/`](docs/adr/) for why each
decision was made.

---

## Status

| Area             | State                                       |
| ---------------- | ------------------------------------------- |
| Foundation       | In progress — see [Stage plan](#stage-plan) |
| Product features | Not started, by design                      |

---

## Requirements

| Tool                 | Version     | Notes                                                                                        |
| -------------------- | ----------- | -------------------------------------------------------------------------------------------- |
| Node                 | `>=20.19.4` | Verified on 24.11.0                                                                          |
| npm                  | `>=10`      | **Use npm, not pnpm/yarn** — see [ADR-0002](docs/adr/0002-expo-sdk-and-dependency-policy.md) |
| Docker Desktop       | any recent  | Required for the local Supabase stack (must be _running_)                                    |
| JDK 17 + Android SDK | optional    | Only for local Android builds; otherwise use EAS                                             |
| macOS + Xcode        | optional    | Only for local iOS builds; otherwise use EAS                                                 |

> This project is developed on Windows. Local native builds are **not** available without a JDK and
> Android SDK, and iOS builds are never available on Windows. Native builds run on
> [EAS Build](https://docs.expo.dev/build/introduction/). See
> [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run start
```

Press `w` for web, `a` for Android, `i` for iOS (macOS only).

### Local backend

Requires Docker Desktop to be running.

```bash
npm run db:start
```

Then regenerate the database types whenever migrations change:

```bash
npm run db:types
```

---

## Scripts

| Script                            | Purpose                                           |
| --------------------------------- | ------------------------------------------------- |
| `npm run start`                   | Expo dev server                                   |
| `npm run web` / `android` / `ios` | Start on a specific platform                      |
| `npm run typecheck`               | `tsc --noEmit`                                    |
| `npm run lint`                    | ESLint, including architecture boundary rules     |
| `npm run format`                  | Prettier check                                    |
| `npm run arch:check`              | Circular-dependency and layer violation check     |
| `npm run test`                    | Jest (unit + component, all platforms)            |
| `npm run verify`                  | **Everything above.** Run before pushing.         |
| `npm run doctor`                  | `expo-doctor` dependency/config health            |
| `npm run db:start` / `db:stop`    | Local Supabase stack                              |
| `npm run db:reset`                | Drop and re-apply all migrations + seed           |
| `npm run db:types`                | Regenerate `src/core/database/types.generated.ts` |
| `npm run db:test`                 | pgTAP tests — **includes RLS policy tests**       |

---

## Architecture in one screen

```
src/app/        Expo Router routes. Thin. Composes screens only.
    ↓
src/features/   Domain slices. api/ components/ hooks/ model/ + index.ts
    ↓
src/core/       Cross-cutting platform capability. Never imports features.
    ↓
Expo · React Native · Supabase · Sentry

supabase/       Server-side. Migrations, Edge Functions, pgTAP tests.
                Never imported by src/.
```

Three rules that are **enforced by ESLint**, not by convention:

1. `src/core/**` may never import from `src/features/**`.
2. The Supabase client may only be imported by `src/core/database/**` and
   `src/features/*/api/repository.ts`. Screens physically cannot write queries.
3. Raw `react-native` UI primitives (`Text`, `Image`, `Button`, `FlatList`, …) may not be imported
   inside `src/features/**` or `src/app/**`. Use the design system.

Full detail: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Documentation

| Doc                                       | Contents                                                   |
| ----------------------------------------- | ---------------------------------------------------------- |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md)   | Layers, dependency rules, data flow, portability contract  |
| [SECURITY.md](docs/SECURITY.md)           | Threat model, RLS strategy, rate limiting, secret handling |
| [DATABASE.md](docs/DATABASE.md)           | Schema, RLS policies, indexes, migration discipline        |
| [DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | Tokens, components, variants, accessibility                |
| [API.md](docs/API.md)                     | Repository contracts, query keys, cache tiers, error model |
| [TESTING.md](docs/TESTING.md)             | Test layers, coverage gates, how to test RLS               |
| [ENVIRONMENT.md](docs/ENVIRONMENT.md)     | Every environment variable and how it is validated         |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md)       | EAS profiles, channels, OTA updates, web hosting           |
| [CONTRIBUTING.md](docs/CONTRIBUTING.md)   | **Read before writing code.** The non-negotiable rules.    |
| [adr/](docs/adr/)                         | Why each architectural decision was made                   |

---

## Stage plan

The foundation is built in gated stages. A stage is not complete until its gate passes.

| Stage | Scope                                               | Gate                                            |
| ----- | --------------------------------------------------- | ----------------------------------------------- |
| 0     | Repo, docs, ADRs                                    | Docs reviewable                                 |
| 1     | Tooling, strict TS, lint/boundaries, env validation | `verify` green, web boots                       |
| 2     | Errors, logging, storage, network, utils            | Unit tests ≥90% on errors/logging               |
| 3     | Design system — tokens + 34 components              | Renders on iOS/Android/Web, a11y asserted       |
| 4     | Supabase — migrations, RLS, generated types         | pgTAP RLS tests pass                            |
| 5     | TanStack Query, cache tiers, repositories           | Repository tests pass, cache purges on sign-out |
| 6     | Auth, authorization, validation                     | Protected routes redirect, authz tests pass     |
| 7     | Lists, images, uploads, bottom sheet, keyboard      | Sheet works on all 3 platforms                  |
| 8     | Sentry, analytics port, perf spans, feature flags   | Test crash reported, flag eval tested           |
| 9     | E2E scaffolds, CI, reference docs                   | Full Definition of Done re-run                  |

---

## License

Proprietary. All rights reserved.
