# ADR-0009 — Roles in the JWT via a custom access token hook

- **Status:** Accepted
- **Date:** 2026-08-24

## Context

FounderStage needs an extensible role model — `founder`, `investor`, `advisor`, `mentor`,
`incubator`, `accelerator`, `partner`, `admin`, `moderator`, with more likely later. Roles must be
enforced in Row Level Security, because that is the only boundary an attacker cannot skip.

The obvious implementation puts roles in a table and joins it in every policy:

```sql
-- ❌ executes per row, for every query, on every table
create policy "moderators can update" on posts for update
  using (exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'moderator'
  ));
```

At 100k MAU this is the wrong shape twice over. The subquery runs per candidate row, and it runs on
every policy on every table — so the cost is multiplied by the number of protected tables a request
touches. It also means `user_roles` itself needs a policy, which risks recursion.

A second, related trap: `auth.uid()` written bare in a policy is re-evaluated **per row**. Wrapped
in a subselect, `(select auth.uid())`, Postgres hoists it into an InitPlan and evaluates it **once
per query**. On a 10,000-row scan that is a 10,000× reduction in calls, for a change of four
characters.

## Decision

### 1. Roles are stamped into the access token

A Supabase **custom access token hook** (`public.custom_access_token_hook`) adds the user's roles as
a claim at token-issue time:

```json
{ "sub": "…", "app_roles": ["founder", "moderator"], … }
```

Policies then read the claim — no join, no per-row subquery:

```sql
create policy "moderators can update" on posts for update
  using ( public.has_role('moderator') );

-- has_role() is IMMUTABLE-ish and claim-based: no table access
create function public.has_role(p_role text) returns boolean
language sql stable set search_path = '' as $$
  select coalesce(
    (select auth.jwt() -> 'app_roles') ? p_role,
    false
  );
$$;
```

`user_roles` remains the source of truth. The JWT is a cache of it.

### 2. `(select auth.uid())` is mandatory in policies

```sql
using ( user_id = (select auth.uid()) )      -- ✅ InitPlan, once per query
using ( user_id = auth.uid() )               -- ❌ once per row
```

Enforced by review checklist in `docs/SECURITY.md` and asserted by pgTAP tests.

### 3. Every RLS-filtered column is indexed

A policy is a `WHERE` clause. `user_id = (select auth.uid())` without an index on `user_id` is a
sequential scan on every read.

## Consequences

- Authorization checks in policies cost a JSON lookup on an already-parsed claim, not a join.
- **Role changes do not take effect until the access token is refreshed** (default ≤1 hour). This is
  the real trade-off. Mitigations:
  - Privilege _escalation_ is rare and can force a refresh (`refreshSession()`) at the point of
    grant.
  - Privilege **revocation** must be immediate for safety, so revocation-sensitive operations
    (moderation, admin actions, payments) additionally check the `user_roles` table directly. Those
    are low-frequency, so the join cost is irrelevant there.
  - `docs/SECURITY.md` lists which operations must not trust the claim.
- The hook is security-critical code. It is covered by pgTAP tests asserting that a user cannot
  cause roles they do not hold to be minted.

## Alternatives considered

- **Join `user_roles` in every policy.** Correct and immediately consistent, but the cost shape
  described above. Kept for the revocation-sensitive subset, where correctness dominates.
- **Roles in `raw_app_meta_data`.** Already in the JWT and not user-writable, so tempting. Rejected:
  no referential integrity, no enum constraint, awkward to query for admin screens, and it becomes a
  second source of truth. The hook reads a real table with real constraints.
- **Roles in `user_metadata`.** **Never.** It is user-writable. A user could grant themselves
  `admin`.
- **Permissions (not roles) in the JWT.** More granular, but the token grows without bound and every
  permission change forces a re-issue. Roles are in the token; the role→permission mapping lives in
  code ([ADR-0011](0011-repository-pattern.md) area) and in policies.
