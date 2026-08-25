# ADR-0016 — A hand-written logger, with redaction as an unavoidable chokepoint

- **Status:** Accepted
- **Date:** 2026-08-24

## Context

CLAUDE.md states the constraint without qualification:

> **Never log** passwords, access tokens, refresh tokens, OTP codes, or payment secrets.

The requirement is easy to state and hard to hold, because nobody writes
`logger.info('token', { accessToken })`. Tokens reach log aggregators by a different route:

```ts
logger.debug('sign-in response', { response }); // response.data.session.access_token
logger.error('mutation failed', error, { variables }); // variables.password
logger.info('request', { headers }); // headers.Authorization
```

Every one of those is a reasonable thing to write while debugging. Each puts a live credential into
whatever the log destination is — and once React Native's console output is piped to Sentry
breadcrumbs, "the log destination" is a third-party service with its own retention.

The second constraint is quieter but decides the design. Logging must be _centralised_ under rule 3,
which means there has to be a mechanism that a call site cannot bypass and a future transport cannot
forget.

Discipline alone does not survive contact with 100k MAU and a growing team. A mechanism does.

## Decision

`src/core/observability/` contains a hand-written logger — roughly eighty lines — with a transport
seam, and redaction applied **once**, inside the logger, before any transport is called.

### 1. No logging library

`winston` and `pino` are both Node-oriented. Bundling either into a React Native app pulls in a
stream implementation and a transport system to do less than this file does: the app needs level
filtering, redaction, bound child context, and a transport interface. `react-native-logs` is closer
to the target but still would not redact, which is the only part that is load-bearing here.

Against the seven questions in [CONTRIBUTING.md](../CONTRIBUTING.md), a logging dependency scores
badly: it is not hard to get right, it does not do the security-critical part, and it is on the hot
path of every screen. Written out, the whole thing is auditable in one screen of code.

### 2. The `no-console` override is what makes the chokepoint real

`no-console: 'error'` applies to all of `src/`, with exactly one exception:

```js
{ files: ['src/core/observability/**/*.ts'], rules: { 'no-console': 'off' } }
```

This is a deliberately load-bearing lint rule rather than a convention. It means the _only_ way to
produce output anywhere in the codebase is to call the logger, and the only way to call the logger
is to pass through `emit`, and `emit` redacts. There is no code path that reaches a console without
passing the redactor. That inversion — the ESLint config forcing the module's location, rather than
the module's location being a preference — is the whole reason the guarantee holds.

It also means the directory is the right home by construction: moving the logger anywhere else would
require either widening the override or defeating the rule.

### 3. Redaction happens once, in `emit`, not in each transport

```ts
const entry: LogEntry = {
  level: entryLevel,
  message,
  context: redactContext(merged),
  …
};

for (const transport of transports) { try { transport.write(entry); } catch { /* swallowed */ } }
```

The alternative — each transport redacting for itself — fails in two ways. A transport added later
can forget, and until it is noticed the failure is silent and retroactive. And a transport that
redacts for itself has already _seen_ the unredacted value, so a Sentry breadcrumb adapter with a
bug attaches the raw object before redacting it.

`LogEntry.context` is documented as already-redacted, so a transport author has no reason to think
about redaction at all. The test that carries the most weight in the suite is the one asserting a
spy transport never observes an unredacted value; a mutation probe — deleting the `redactContext`
call — confirms three tests fail, which is what makes the assertion load-bearing rather than
incidental.

### 4. Two redaction mechanisms, because keys alone are insufficient

**By key name**, matched as a substring of the key with whitespace, `_`, `.` and `-` stripped and
lowercased — so `access_token`, `accessToken`, `ACCESS-TOKEN` and `x-access-token` are one entry.
Plus a short exact-match list (`pin`, `cvv`, `ssn`, `jwt`, `auth`, `key`, …) for names too short to
match as substrings without hitting `pinned` and `spinner`.

**By value shape**, which is the mechanism that catches the case key matching structurally cannot:

```ts
redact({ data: 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.sig' }); // → { data: '[redacted]' }
```

The field name says nothing. This is how a token actually escapes — inside a logged response body,
under a key like `data` or `result`. Three patterns: a JWT (`eyJ` + three base64url segments), a
Supabase `sb_secret_` / `sb_publishable_` key, and a bare `Bearer …` string. All three are specific
enough that a false positive is close to impossible.

### 5. Redaction targets credentials, not PII — deliberately

`email` and `userId` are **not** redacted. This is a considered scope, not an omission.

A `userId` is the single most useful field in a log: without it, correlating a user's report with
what the app actually did is guesswork. An `email` is what a support conversation starts from.
Neither grants access to anything — they are identifiers, not credentials — and redacting them would
make the logger materially worse at its job while adding no security.

PII in logs is a real concern, and it is a **retention and access** concern rather than a redaction
one: who can read the aggregator, and for how long the data is kept. That belongs with the
observability transport configuration, not here. Should a jurisdiction requirement change this, the
place to change it is one function.

The line drawn: **if it grants access, redact it. If it identifies, keep it.**

### 6. Over-redaction is treated as a real cost, and the trade is recorded

Because keys are normalised before matching, `access_token` becomes `accesstoken` and there is no
word boundary left. `tokenizer`, `passwordless` and `secretary` are therefore redacted too.

This is written down and **tested as expected behaviour**, rather than hidden:

```ts
it.each(['tokenizer', 'passwordless', 'secretary'])(
  'over-redacts %s, and that is the accepted trade',
  (key) => expect(redact({ [key]: 'visible' })).toEqual({ [key]: REDACTED })
);
```

The reason it is a cost worth naming: `[redacted]` on a field that needed reading is how an engineer
concludes the logger is in the way and starts working around it, which is a far worse outcome than
either over- or under-redaction. So the denylist is kept narrow where it can be — `refresh` is
deliberately absent, since `refresh_token` is already caught by `token` while `refresh` alone would
redact `refreshedAt` and `isRefreshing` and make the query layer's own logs unreadable.

The test suite asserts **both** directions with roughly equal weight. A suite that only proved
secrets get redacted would pass against `redact = () => REDACTED`.

### 7. The logger cannot throw, and cannot be a performance excuse

- Every `transport.write` is wrapped in a `try/catch` that swallows. A logger that can throw adds a
  second failure mode to every `catch` block in the app, and the likeliest moment for a transport to
  fail is while already handling an error. A throwing transport also must not prevent the remaining
  transports from receiving the entry — both are tested.
- The level check is the **first** statement in `emit`, before the merge, before redaction, before
  the timestamp. A production bundle runs at `warn`, so a `logger.debug` on a list-render path costs
  one integer comparison against a precomputed rank and allocates nothing. Tested by asserting a
  suppressed level never constructs an entry at all.
- `createLogger` reads no configuration. It is a factory; a factory that reaches for `env` cannot be
  tested at a level it was not configured for. Composition — which level, which transports — happens
  once in `index.ts`, which is also where the `logger` singleton lives.

### 8. `logger.error` takes `unknown`

```ts
error(message: string, error?: unknown, context?: Record<string, unknown>): void;
```

`unknown` because that is what a `catch` block gives you
([ADR-0004](0004-typescript-strictness.md)). It is normalised through `toAppError`
([ADR-0015](0015-error-model.md)) inside the logger, so no call site has to remember to, and so
`entry.error.kind` and `entry.error.reportable` are available to a crash-reporting transport for
free — which is exactly the filtering ADR-0015 §4 puts on the error.

The error's own `context` is merged **under** the call site's, so an explicit value at the call site
wins, and both are redacted together.

## Consequences

**Accepted costs**

- **A denylist only knows the names it was told.** The first field called `walletSeed` sails
  through. This is why the module's header says it is a safety net, not a licence, and why the
  CONTRIBUTING rule "do not put a secret in a log call" still stands. What it buys is protection
  against the _realistic_ accident — logging a whole response or form object — not against a
  determined mistake.
- **Over-redaction of substring collisions**, per §6.
- **A hand-written logger is code to maintain**, and it will grow when structured aggregation
  arrives. The transport seam is where that growth is meant to land.
- **`MAX_DEPTH = 6` and `MAX_ARRAY_ITEMS = 20` truncate.** A deeply nested response is logged as
  `[max depth]` past six levels. Chosen because a pathological structure must not be able to stall
  the UI thread from inside a log call; a log line is for diagnosis, not data transfer.
- **`Map`, `Set` and functions are described rather than serialised** (`[Map size=1]`,
  `[function]`). `JSON.stringify(new Map([['a', 1]]))` is `'{}'`, which reads in a log as "an
  object, and it was empty" when it was not — the tag says more than the empty braces.

**What this buys**

- One output path in the entire codebase, enforced by a lint rule rather than a convention.
- No transport, present or future, can see an unredacted credential.
- Level filtering, redaction and error normalisation each have one definition and are individually
  tested.
- Sentry breadcrumbs, a file sink and a test spy are all the same interface, so adding one touches
  no call site.

## Alternatives considered

| Alternative                                       | Why not                                                                                                                                                          |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pino` / `winston`                                | Node-oriented; ships a stream implementation into an RN bundle; does not do the redaction, which is the only security-critical part.                             |
| `react-native-logs`                               | Closer fit, still no redaction. The remaining value is level filtering and a transport interface — about forty lines.                                            |
| Redaction in each transport                       | A transport added later can forget, silently and retroactively; and it has already seen the raw value before deciding to redact it.                              |
| Redaction at the aggregator (Sentry `beforeSend`) | Too late — the value has left the device and crossed a network boundary. Also platform-specific, and does nothing for console output during development.         |
| An allowlist of loggable keys                     | Safer in principle. In practice every new context field is `[redacted]` until someone updates a central list, so the logger stops being used. Rejected under §6. |
| Redacting `email` and `userId` too                | Removes the fields that make a log correlatable, for no access-control gain. PII exposure is a retention and access-control problem — see §5.                    |
| Allowing `console.*` in development only          | The chokepoint is only a chokepoint if it has no exceptions. A dev-only bypass is where the habit forms, and habits ship.                                        |
