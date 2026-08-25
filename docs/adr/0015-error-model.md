# ADR-0015 — One error class with a closed kind set, and a hard split between `message` and `userMessage`

- **Status:** Accepted
- **Date:** 2026-08-24

## Context

Failure is the part of an app that is written last and reviewed least, and it is where the two
requirements in CLAUDE.md that have no workaround meet:

> Never expose raw database or server errors to users. Normalise through `AppError`.

> A screen must contain no error-to-message mapping.

Both are really the same requirement seen from two ends. If a screen maps an error to a message,
then some screen will eventually render an upstream string, and an upstream string from PostgREST
looks like this:

```
duplicate key value violates unique constraint "profiles_handle_key"
DETAIL:  Key (handle)=(ada) already exists.
```

That single line hands an attacker a table name, a column name, a constraint name and confirmation
that the value exists. It is also incomprehensible to the person who typed a handle. There is no
version of "the screen decides what to show" that does not eventually ship it.

The failures the application layer has to survive arrive in genuinely unrelated shapes:

| Source         | Shape                                                      |
| -------------- | ---------------------------------------------------------- |
| PostgREST      | `{ code, message, details, hint }` — not an `Error` at all |
| `fetch`        | `TypeError`, message worded differently by every engine    |
| `AbortSignal`  | `DOMException` named `AbortError` or `TimeoutError`        |
| Zod            | A `ZodError` with an `issues` array                        |
| Native module  | An object with a `message` and no `Error` prototype        |
| Anything, ever | A thrown string, a thrown number, `undefined`              |

A `catch` block is typed `unknown` under [ADR-0004](0004-typescript-strictness.md), which is correct
and means every consumer would otherwise have to narrow all six shapes itself.

## Decision

One class, `AppError`, in `src/core/errors/`. Every failure is normalised into it by
`toAppError(value)` before it crosses out of `src/core`. A screen branches on `error.kind` and
renders `error.userMessage`. Nothing else.

### 1. A single branded class, not a discriminated union of interfaces

The idiomatic TypeScript answer is a union:

```ts
type AppError =
  | { kind: 'network' }
  | { kind: 'rate_limit'; retryAfterSeconds: number }
  | { kind: 'validation'; fieldErrors: Record<string, string> };
// … eleven members
```

It gives better per-kind payload typing, and it was rejected, because `instanceof Error` would no
longer hold. That single fact breaks four things at once:

- `throw` on a non-`Error` produces no stack trace, so the origin of the failure is lost
- React error boundaries and `ErrorUtils` expect an `Error`
- TanStack Query types `error` as `Error` by default, and every mutation would need a cast
- Sentry's `captureException` degrades a non-`Error` to a low-fidelity "unknown exception" with no
  stack, which is precisely the case where a stack matters most

Payload precision is bought back where it is actually needed with a narrowing predicate rather than
paid for everywhere:

```ts
if (isRateLimited(error)) {
  scheduleRetry(error.retryAfterSeconds); // number, not number | undefined
}
```

Two static factories exist — `AppError.rateLimit` and `AppError.validation` — and only because each
enforces a field that would otherwise be silently absent: a 429 whose `retryAfterSeconds` is missing
leaves the retry policy guessing, and a validation error without `fieldErrors` cannot drive a form.
There is deliberately **no** static per kind. `new AppError('not_found', …)` is already typed by the
closed union; a factory for each would be eleven functions that add nothing.

### 2. `kind` is closed, and each member earns its place by driving a different UI

`network` · `timeout` · `cancelled` · `auth` · `forbidden` · `not_found` · `conflict` · `validation`
· `rate_limit` · `server` · `unknown`

The test for membership is: **does the app do something visibly different?** A kind that behaves
identically to another kind is not a kind, it is a `code`. The pair worth naming explicitly:

- **`auth` vs `forbidden`.** Collapsing these is the most common error-model bug in an app with
  roles. `auth` means "not signed in" → route to sign-in. `forbidden` means "signed in, wrong role"
  → show a message. Routing a `forbidden` to sign-in creates a loop the user cannot escape: they
  sign in, they still lack the role, they are sent back. With roles in the JWT
  ([ADR-0009](0009-roles-in-jwt.md)) this is a real and frequent state, not a theoretical one.
- **`cancelled` is a kind, not a swallowed `null`.** A superseded request is not a failure, but the
  query layer has to _recognise_ it to avoid rendering an error state for something the user caused
  by navigating. Its `userMessage` is the empty string — the one kind that is never rendered.

### 3. `message` for developers, `userMessage` for users, and `userMessage` is never derived

`userMessage` comes from a static per-kind policy table. `toAppError` **never** promotes an incoming
message into it — not as a fallback, not "just for `unknown`". The upstream string is exactly the
thing that must not reach a user, so there is no code path where it can. It is preserved in
`message` and in `cause` for logs.

The `userMessage` strings themselves are written to be true without being specific: they must not
imply a cause the app cannot actually distinguish. "You appear to be offline" for `network` is
honest — a transport-level `fetch` rejection genuinely cannot be distinguished from offline.

`options.userMessage` can override, for the case where a feature has genuinely better copy. The
field's doc comment states the one rule: never pass an upstream `error.message` to it.

### 4. `reportable` is part of the model, not a Sentry filter

Every kind carries `retryable` and `reportable`.

`reportable: false` on `network`, `cancelled`, `auth`, `forbidden`, `not_found`, `conflict`,
`validation` and `rate_limit` is a scale decision. At 100,000 MAU, offline events alone would be the
single largest category in crash reporting, and they say something about the user's train tunnel
rather than about a defect. Left unfiltered they exhaust the error budget and bury the `server` and
`unknown` events that are the only ones anybody can act on.

Putting the decision on the error rather than in Sentry's configuration means it is visible in code
review, testable, and identical across the three platforms. `timeout` is reportable while `network`
is not, because a timeout against a reachable server is usually a slow query.

### 5. Transport-specific mapping lives with the transport

`src/core/errors/` knows about **platform** failure shapes — a rejected `fetch`, an aborted signal —
because those are properties of the runtime.

It deliberately does **not** know PostgREST codes, Postgres SQLSTATEs, or HTTP statuses.
`23505 → conflict` lives in `src/core/database/`; `429 → rate_limit` lives with the HTTP client.
Teaching `core/errors` about `23505` would put Postgres knowledge in the module whose entire purpose
is to be the backend-agnostic vocabulary, and would make the repository seam
([ADR-0011](0011-repository-pattern.md)) leak in the one direction it exists to prevent. Swapping
the backend should change one directory, not two.

### 6. `toAppError` is total

Every JavaScript value maps to an `AppError`. No branch returns `null`, and no branch throws — a
normaliser that throws while normalising turns a handled failure into an unhandled one, and it would
do so inside a `catch` block, which is the worst possible place. This is why `describeUnknown`
guards `JSON.stringify` against cycles and throwing `toJSON`, and why re-normalising an existing
`AppError` returns the **same instance** rather than a copy: wrapping would discard
`retryAfterSeconds` and downgrade the kind, which is how a rate-limit backoff silently stops
working.

## Consequences

**Accepted costs**

- **`instanceof` assumes a single module instance.** Two copies of `app-error.ts` in one bundle
  would make `isAppError` return `false` for a genuine `AppError`. Metro deduplicates by resolved
  path and there is one path, so this holds — but it is an assumption, and it is why the constructor
  restores its prototype explicitly: Babel downlevelling `class` to ES5 for an older web
  browserslist target loses the prototype link, and the resulting bug (silent double-wrapping) would
  never be connected to a build-target change.
- **`Object.assign` past `readonly`** in the two factories. The alternative is a constructor
  signature carrying every kind's optional payload, which makes all eleven construction sites
  advertise fields they must not set. Contained to two adjacent lines with a comment.
- **Kind payloads are optional on the type.** `error.retryAfterSeconds` is `number | undefined`
  everywhere except behind `isRateLimited`. This is the price of item 1 and it is charged at one
  call site.
- **A wrong kind is a real bug.** `retryable: true` on something permanent means the client hammers
  the server. This moves correctness pressure onto the mapping layers, which is why they are the
  part with adversarial tests.

**What this buys**

- A screen cannot leak a database error, because it has no access to one.
- Retry policy, crash-report filtering and user copy each have exactly one definition.
- Adding a kind is a visible, deliberate change: `APP_ERROR_KINDS` is a tuple that the union type is
  derived from, `KIND_POLICY` is `Record<AppErrorKind, …>` so TypeScript refuses a missing entry,
  and the test suite iterates the tuple — so a new kind without a considered policy fails the build
  in three places.

## Alternatives considered

| Alternative                              | Why not                                                                                                                                                                                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Discriminated union of eleven interfaces | Loses `instanceof Error`: no stack, breaks error boundaries, TanStack Query typing and Sentry fidelity. Precision recovered via predicates.                                                                                           |
| One class per kind (`NetworkError`, …)   | Eleven files and eleven `instanceof` checks to express what one closed field expresses. Adding a kind touches every consumer's switch.                                                                                                |
| `neverthrow` / `Either` result types     | A better model for a codebase built around it. Grafted onto React Query, error boundaries and Supabase — all of which throw — it means adapting at every boundary. Rejected under [ADR-0002](0002-expo-sdk-and-dependency-policy.md). |
| Error codes as bare strings              | No payload, no policy, no exhaustiveness. Every consumer re-derives retryability and copy — the mapping-in-screens problem with extra steps.                                                                                          |
| `userMessage` falling back to `message`  | This is the leak. A fallback is indistinguishable from the intended path until the day it fires in production.                                                                                                                        |
