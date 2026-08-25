# ADR-0006 — TanStack Query is the only server-state system; cache policy is a closed set

- **Status:** Accepted
- **Date:** 2026-08-24

## Context

Server state needs caching, deduplication, background refetch, pagination, optimistic updates and
invalidation. Hand-rolling this in `useEffect` is the single most common way a React Native codebase
becomes unmaintainable — every screen grows its own loading flags, its own retry, and its own subtly
different staleness behaviour.

A second, subtler failure: adopting TanStack Query but giving every query the **same** cache policy.
A notification badge and a country list do not have the same staleness semantics, and one global
`staleTime` guarantees that one of them is wrong.

## Decision

**TanStack Query v5 is the only server-state mechanism.** No `useEffect` fetching, no bespoke cache,
no server data in Zustand.

Cache policy is a **closed set of named tiers** in `src/core/query/cache-policy.ts`. A feature picks
a tier; it cannot invent one.

| Tier        | `staleTime` | `gcTime` | Persisted | For                                |
| ----------- | ----------- | -------- | --------- | ---------------------------------- |
| `static`    | 24 h        | 7 d      | ✅        | Enums, categories, countries       |
| `reference` | 1 h         | 24 h     | ✅        | Tags, industries, flag definitions |
| `profile`   | 5 min       | 30 min   | ❌        | Founder / company profiles         |
| `list`      | 60 s        | 10 min   | ❌        | Directories, search results        |
| `feed`      | 30 s        | 5 min    | ❌        | Timelines                          |
| `volatile`  | 0           | 60 s     | ❌        | Notifications, counters            |
| `sensitive` | 0           | 0        | ❌ never  | Payments, private data             |

Query keys come from a **per-feature factory**, hierarchical so invalidation can target a level:

```ts
export const accountKeys = {
  all: ['account'] as const,
  profile: (userId: UserId) => [...accountKeys.all, 'profile', userId] as const,
} as const;
```

**Every user-specific key includes the user id.** Not for cache correctness — for isolation. A key
of `['account','profile']` shared across two sign-ins on the same device serves one user's data to
another.

### Persistence is a whitelist

Offline cache persists **only** `static` and `reference`, via `shouldDehydrateQuery`. User-specific
and sensitive data never reaches disk. On sign-out: `queryClient.clear()` **and** a persister purge.
Without both, the next account on a shared device can read the previous user's cache — a real
vulnerability that ships in most scaffolds.

### One wrapper for every repository call

`createRepositoryQuery` wraps each call in a performance span and error normalisation, so API
latency is measured for every feature from one place, and no feature has to remember to instrument
itself.

## Consequences

- Loading, error, retry and refetch semantics are identical everywhere.
- Cache behaviour is reviewable as a table instead of scattered across call sites.
- Invalidation is predictable because keys are hierarchical.
- Cost: developers must pick a tier. That is the intended forcing function.

## Alternatives considered

- **Redux Toolkit Query.** Comparable capability, but pulls in a Redux store we otherwise do not
  need — Zustand covers the small amount of genuine client state.
- **SWR.** Weaker mutation, pagination and invalidation story.
- **One global cache policy.** The failure described above.
- **Supabase Realtime as the primary sync mechanism.** Rejected for general data: per-client
  subscriptions on feeds do not survive 100k MAU. Realtime is opt-in per channel for notifications
  and messaging only.
