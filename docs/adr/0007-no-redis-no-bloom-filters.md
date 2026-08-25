# ADR-0007 — No Redis and no Bloom filters at launch; define the ports instead

- **Status:** Accepted
- **Date:** 2026-08-24

## Context

The requirements ask for Redis (rate limiting, hot cache, counters, locks, idempotency, trending,
aggregate caching) and note Bloom filters as a possibility for membership and duplicate checks. The
same requirements also state, unambiguously, that scalability does not mean adding every
distributed-systems technique immediately, and that Redis, Bloom filters and custom caching must not
be introduced unless they solve a real problem.

**These two instructions contradict each other.** It has to be resolved explicitly rather than split
down the middle, because "a bit of Redis" is the worst of both outcomes: real operational cost, no
measured benefit.

The deciding facts:

- There is **no traffic**. There are no measurements, so there is no bottleneck to point at.
- Redis is not free. It is a service to provision, secure, monitor, connect to from Deno, fail over,
  and pay for — plus a second source of truth that can now disagree with Postgres.
- Postgres at 100k MAU is nowhere near a wall for the workloads Redis was proposed for, provided
  indexes and pagination are correct — which is where the effort actually belongs.
- Bloom filters answer "probably present / definitely absent". Every use proposed for them
  (membership, blocked-user prechecks, spam filtering) is **security-adjacent**, and a false
  positive in a security decision is a bug. They would need an authoritative check behind them
  anyway, which is the query we were trying to avoid.

## Decision

**Ship neither.** Instead:

1. Define the **`RateLimiter` port** in `src/core/security/rate-limiter.ts` with a Postgres-backed
   driver ([ADR-0008](0008-rate-limiting-in-postgres.md)). An Upstash/Redis driver is then a new
   file implementing the same interface — not a refactor.
2. Caching is TanStack Query on the client and correct indexes plus tiered `staleTime` on the server
   ([ADR-0006](0006-tanstack-query-and-cache-tiers.md)).
3. Counters are **trigger-maintained denormalised columns**, not `COUNT(*)` on a hot path and not
   Redis `INCR`. They stay transactional and correct.
4. Redis appears in `docs/ARCHITECTURE.md` as a **documented future layer** with its insertion point
   named, so adding it later is a planned change rather than an emergency.
5. **Bloom filters are excluded entirely** — not deferred. If an existence check ever becomes
   genuinely expensive, a partial index or a covering index is the first answer.

### What would justify Redis

Written down now, so the decision is evidence-based later rather than a matter of taste:

- Rate-limit counter writes measurably contending in `pg_stat_statements`, **or**
- an aggregate query that cannot be made fast with an index and is hot enough to dominate cost,
  **or**
- a need for cross-instance distributed locks that advisory locks cannot serve, **or**
- Edge Function connection pressure traceable to counter writes.

## Consequences

- Fewer moving parts, no second datastore to secure or reconcile, no extra network hop on the auth
  path.
- Rate limiting is transactional with the data it protects.
- If a workload does outgrow Postgres, we implement one driver behind an existing interface.
- Cost: the Postgres limiter has a lower ceiling than Redis. Accepted; the ceiling is far above
  current and near-term load, and the trigger for revisiting is written above.

## Alternatives considered

- **Add Redis now "since we'll need it eventually".** This is the reasoning that produces
  infrastructure nobody can justify or safely remove. If it is needed later, the port makes it a
  small change.
- **Bloom filter for blocked-user prechecks.** A false positive silently hides content from a user
  who should see it, and the authoritative check is still required. All cost, no saving.
