# Environment

Every value the app needs at runtime, where it comes from, and how it is validated.

---

## The prefix rule

Expo inlines any variable starting with `EXPO_PUBLIC_` into the **client bundle at build time**.
Anyone who downloads the app or opens the web bundle can read it.

| Prefix          | Ships to client          | Use for                                              |
| --------------- | ------------------------ | ---------------------------------------------------- |
| `EXPO_PUBLIC_*` | **Yes — world-readable** | Supabase URL, anon key, Sentry DSN, environment name |
| no prefix       | No                       | Build-time only (EAS secrets, CI tokens)             |

> The Supabase **anon key is safe to expose** — it is designed for it, and Row Level Security is
> what actually protects data. The **`service_role` key is not** and must never appear anywhere
> under `src/`. Startup validation refuses to boot if the anon-key variable carries the
> `service_role` claim (see [Validation](#validation)); a CI secret scan is a second layer that
> arrives with the pipeline.

---

## Variables

### Required

| Variable                        | Example                  | Notes                                             |
| ------------------------------- | ------------------------ | ------------------------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`      | `http://127.0.0.1:54321` | Local stack, or `https://<ref>.supabase.co`       |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOi…`            | Public by design. Printed by `npm run db:start`.  |
| `EXPO_PUBLIC_ENV`               | `development`            | One of `development` \| `preview` \| `production` |

### Optional

| Variable                       | Default                        | Accepted values                                   |
| ------------------------------ | ------------------------------ | ------------------------------------------------- |
| `EXPO_PUBLIC_SENTRY_DSN`       | unset                          | A DSN URL. Crash reporting is disabled when unset |
| `EXPO_PUBLIC_LOG_LEVEL`        | `debug` in dev, `warn` in prod | `trace` \| `debug` \| `info` \| `warn` \| `error` |
| `EXPO_PUBLIC_ENABLE_DEV_TOOLS` | `false` — opt in explicitly    | `true` \| `false`                                 |

`EXPO_PUBLIC_LOG_LEVEL` has no `silent`. Suppressing logging entirely is a property of the logger's
transport, not of a level, so it will arrive as a no-op adapter in the observability stage rather
than as a sixth enum member. The list above is the enum in `src/core/config/env.ts`; any other value
fails startup validation.

`EXPO_PUBLIC_ENABLE_DEV_TOOLS` does **not** default to `true` in development. It defaults to `false`
in every environment and must be set explicitly, so that a screenshot or a screen-share from a dev
build never shows a devtools panel nobody asked for.

**A blank value means unset.** `KEY=` in a dotenv file produces `''`, not `undefined` — so the
validator collapses empty strings to `undefined` before parsing. Leaving any optional variable blank
therefore gets you the default. The two required variables still reject blank.

There is no `EXPO_PUBLIC_API_URL`. Edge Function URLs are derived from the Supabase URL by the
client in `src/core/database/`; nothing reads a separate base-URL override, and a value set for one
would be silently discarded by the schema.

### Server-side only — never `EXPO_PUBLIC_`

These live in EAS secrets, Supabase Function secrets, or CI — **never in `.env.local`, never in the
bundle.**

| Variable                    | Used by                       |
| --------------------------- | ----------------------------- |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions only           |
| `SENTRY_AUTH_TOKEN`         | EAS Build — source map upload |
| `EXPO_TOKEN`                | CI — EAS authentication       |

---

## Files

| File           | Committed     | Purpose                                                 |
| -------------- | ------------- | ------------------------------------------------------- |
| `.env.example` | ✅            | Variable **names** and shapes. No real values, ever.    |
| `.env.local`   | ❌ gitignored | Your machine's actual values                            |
| EAS secrets    | ❌            | Preview/production values, set with `eas secret:create` |

Expo loads `.env.local` automatically. Restart the dev server after changing it — values are inlined
at bundle time, not read at runtime.

---

## Validation

Configuration is validated **once, at startup**, in `src/core/config/env.ts` using Zod. If a
required variable is missing or malformed, the app fails immediately with a readable message naming
the variable — rather than throwing `undefined is not a function` somewhere deep in the Supabase
client twenty minutes later.

```ts
// src/core/config/env.ts — the ONLY file allowed to read process.env
import { env, isProduction, logLevel } from '@/core/config/env';

env.EXPO_PUBLIC_SUPABASE_URL; // string, guaranteed present and a valid URL
isProduction; // boolean
logLevel; // 'trace' | 'debug' | 'info' | 'warn' | 'error'
```

Fields keep their full `EXPO_PUBLIC_` names rather than being renamed to `supabaseUrl`, so that
grepping for a variable finds both its declaration and every use of it. The derived values
(`isDevelopment`, `isPreview`, `isProduction`, `logLevel`) are separate named exports, not
properties of `env`.

`process.env` is lint-banned everywhere else. Import `env` instead.

Validation also refuses a `service_role` key in `EXPO_PUBLIC_SUPABASE_ANON_KEY` by reading the
token's `role` claim. A legacy `service_role` key is a structurally perfect JWT, and
`supabase start` prints it on the line next to the anon key — so structural checks alone cannot
catch the one substitution that would ship an RLS-bypassing credential to every device.

**Fail-safe behaviour today:** the error is thrown at module load, in every environment, before any
screen mounts. The message names each failing variable and never echoes a value.

A production build therefore shows the platform's own crash screen rather than a designed one, and
nothing is reported anywhere — Sentry is not wired up yet. The generic "configuration error" screen
and the crash report arrive with the error boundary and the observability adapters. Until then, a
misconfigured production build fails visibly but not gracefully. Accepted for the foundation phase:
this failure mode is reachable only by shipping a build whose environment was never checked once.

---

## Getting local values

```bash
npm run db:start
```

The Supabase CLI prints `API URL` and `anon key`. Copy them into `.env.local`:

```bash
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<the anon key printed above>
EXPO_PUBLIC_ENV=development
```

> On a physical device, `127.0.0.1` points at the phone, not your machine. Use your LAN IP (e.g.
> `http://192.168.1.20:54321`) instead.

---

## Environments

|                | development           | preview                   | production               |
| -------------- | --------------------- | ------------------------- | ------------------------ |
| Backend        | local Docker Supabase | staging project           | production project       |
| Sentry         | disabled              | enabled, high sample rate | enabled, low sample rate |
| Log level      | `debug`               | `warn`                    | `warn`                   |
| Dev tools      | off unless set        | off unless set            | off unless set           |
| EAS profile    | `development`         | `preview`                 | `production`             |
| Update channel | —                     | `preview`                 | `production`             |

Preview logs at `warn`, the same as production, because a preview build **is** a release build and
its log output should be the output you are actually shipping. When a preview build needs to be
debugged, raise it for that build by setting `EXPO_PUBLIC_LOG_LEVEL` in the EAS `preview` profile —
which is the mechanism, rather than a default that makes preview quietly unlike production.

The Sentry row describes the intended configuration, not code that exists yet.

See [DEPLOYMENT.md](DEPLOYMENT.md) for how each is built and released.
