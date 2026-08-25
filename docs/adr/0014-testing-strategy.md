# ADR-0014 — Testing strategy: pgTAP for RLS, jest-expo for the shared codebase

- **Status:** Accepted
- **Date:** 2026-08-24

## Context

The requirement is a testing foundation _before_ features, so tests are a habit rather than a
retrofit. The interesting question is not "which runner" but **where the bugs will actually be** in
this architecture, because that is where the tests belong.

Three areas carry disproportionate risk:

1. **Row Level Security.** RLS is the real authorization boundary
   ([ADR-0009](0009-roles-in-jwt.md)). A policy bug is a data breach, it is invisible to TypeScript,
   and it is invisible to a UI test — the app looks correct while leaking. **No amount of
   application testing can find it.**
2. **Cross-platform divergence.** One codebase runs on Android, iOS and web with `.native.tsx` /
   `.web.tsx` splits. A test suite that only runs one platform's resolution silently stops covering
   the others.
3. **Core primitives.** The chunked storage adapter, the error normaliser, the cursor codec. Every
   feature depends on them, and their failure modes are boundary conditions rather than happy paths.

Feature screens, by contrast, are the _least_ valuable place to test — they are thin by construction
([ADR-0011](0011-repository-pattern.md)), and there are none yet.

## Decision

| Layer              | Tool                              | Covers                                                                |
| ------------------ | --------------------------------- | --------------------------------------------------------------------- |
| Database / RLS     | **pgTAP** via `supabase test db`  | Policies, `has_role()`, the access-token hook, `rate_limit.consume()` |
| Unit / integration | **jest-expo** multi-project       | Core primitives, mappers, hooks, components                           |
| Component          | **@testing-library/react-native** | Behaviour and accessibility, not snapshots                            |
| Network            | **MSW**                           | Supabase HTTP boundary, error and offline paths                       |
| E2E mobile         | **Maestro**                       | Critical flows on a real build                                        |
| E2E web            | **Playwright**                    | Same flows in a browser                                               |

### 1. RLS is tested adversarially, not optimistically

Every policy gets a test that asserts a **denial**, not just an allow:

```sql
-- authenticate as user A, attempt to read user B's private row
select is_empty(
  $$ select id from private_notes where owner_id = '<user-b>' $$,
  'user A cannot read user B private notes'
);
```

A test suite that only proves "the owner can read their own row" passes against a policy of
`using (true)`. The denial assertion is the one that has any value, and it is the one usually
missing.

The access-token hook gets its own tests asserting a user cannot cause roles they do not hold to be
minted — the escalation path that would compromise everything downstream.

### 2. jest-expo runs three platform projects

```js
projects: [
  { preset: 'jest-expo/ios' },
  { preset: 'jest-expo/android' },
  { preset: 'jest-expo/web' },
];
```

Platform-specific files resolve per project, so a broken `.web.tsx` fails in CI instead of in a
browser. This is the only mechanism that keeps the cross-platform claim honest as the codebase
grows.

### 3. `jest` is pinned to 29

`jest-expo@57.0.4` depends on `@jest/globals`, `babel-jest` and `jest-environment-jsdom` on the
`^29.2.1` line. `jest` is therefore an **explicit** devDependency at `^29.7.0` and `@types/jest` at
`^29.5.14` — not left transitive, and not upgraded to 30. Types from a different major than the
runtime describe APIs that do not exist, which is worse than no types: it type-checks and then fails
at runtime.

### 4. Behaviour, not snapshots

Snapshot tests on design-system components would fail on every intentional token change while
catching almost no real defect. Component tests assert what a user can perceive: rendered text,
accessible role and label, whether `onPress` fires, whether the disabled state actually blocks
interaction.

### 5. Accessibility is asserted in the shared components

Because the shared components are where it can be _enforced once_. A `Button` test asserts
`accessibilityRole`, an accessible name, and a ≥44pt hit target. Every feature that uses `Button`
then inherits compliance rather than re-earning it.

### 6. What is deliberately not tested

- Screens. Thin by construction, and none exist yet.
- Third-party behaviour. We do not test that TanStack Query caches.
- Coverage thresholds are **not** set during the foundation phase. A threshold on a codebase with no
  features drives tests written to raise a number. Thresholds arrive with the first feature slice.

## Consequences

- The highest-risk surface (authorization) is covered by the only tool that can see it.
- Cross-platform breakage surfaces in CI rather than in a browser.
- pgTAP requires Docker for local runs (`supabase start`), which is a genuine developer-setup cost
  and is documented in `README.md`.
- CI runs `db:test` against a throwaway Postgres, so RLS is verified on every push.

## Alternatives considered

- **Test RLS through the client with two authenticated `supabase-js` sessions.** Works, and is far
  slower, harder to reason about, and cannot easily assert the SQL-level behaviour of
  `SECURITY DEFINER` functions or the token hook. pgTAP runs in-database against the real policies.
- **Detox instead of Maestro.** More powerful and considerably heavier to configure and keep green.
  Maestro's YAML flows are readable by non-specialists, which matters more for the small number of
  critical flows we will actually maintain.
- **Vitest.** Faster, and it does not have `jest-expo`'s platform presets or React Native transform
  handling. The platform-project matrix is worth more here than raw speed.
- **High coverage thresholds from day one.** Produces tests that assert implementation details of
  code with no users yet. Deferred, deliberately.
