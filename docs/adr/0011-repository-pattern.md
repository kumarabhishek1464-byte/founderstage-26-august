# ADR-0011 — Repositories as the backend portability seam, enforced by lint

- **Status:** Accepted
- **Date:** 2026-08-24

## Context

Supabase is the current backend. The requirement is that a future backend change must not force a
rewrite of the presentation layer — the architecture should be

```
UI → hooks → repositories → infrastructure
```

and not

```
UI → Supabase everywhere
```

The difficulty is that `supabase-js` is _pleasant_. `supabase.from('founders').select('*')` in a
component works immediately, and nothing stops it. Every codebase that states this rule in a
document and enforces it in code review eventually leaks, because the rule competes with convenience
at the moment of writing and convenience wins on a deadline.

A second tension: a naive repository (`getAll`, `getById`) throws away PostgREST's ability to
express filtering, ordering and column selection, and then features route around it.

## Decision

### 1. The boundary is mechanical, not cultural

An ESLint `no-restricted-imports` rule permits importing the Supabase client from **exactly two**
locations:

- `src/core/database/**`
- `src/features/*/api/repository.ts`

Anywhere else it is a lint error, so `npm run verify` and CI both fail. **A screen cannot write a
database query even if someone wants it to.** This single rule is what makes the layering real
rather than aspirational.

### 2. Repositories accept typed filter objects, not query builders

The way to keep a repository expressive without leaking PostgREST:

```ts
export interface FounderListFilters {
  readonly stage?: FounderStage[];
  readonly industry?: IndustryId[];
  readonly query?: string;
  readonly sort?: 'recent' | 'alphabetical';
  readonly cursor?: Cursor | null;
  readonly limit?: number;
}
```

The repository translates that into a PostgREST query. Features get full expressiveness; no feature
learns PostgREST. A new filter is a field on an interface, not a new method.

### 3. Repositories return domain models, never `Row` types

```
Postgres → supabase gen types → Database['public']['Tables']['profiles']['Row']
                                              ↓ mapper (repository-owned)
                                        Founder  ← what features import
```

Column renames, added columns and denormalisation stop at the mapper. Without this, generated types
become the app's domain model and every schema change ripples into the UI — the coupling the
repository was meant to prevent.

### 4. Repositories are the only place raw errors exist

Every repository call is wrapped by `createRepositoryQuery`, which normalises PostgREST and Postgres
error codes into the `AppError` union and opens a performance span. So error handling and latency
measurement are uniform across every feature without any feature opting in.

### 5. Explicit column selection

`select('*')` is not used. Repositories name their columns. This keeps payloads small, makes
index-only scans possible, and means an added column does not silently widen every response.

## Consequences

- Replacing Supabase means rewriting `src/core/database/**` and each `features/*/api/repository.ts`.
  No screen, hook, or component changes.
- The layering survives deadline pressure, because bypassing it fails the build.
- Cost: a mapper per entity. This is the price of the decoupling and it is small.
- Cost: an exotic one-off PostgREST feature must be expressed as a repository method. Fine — that is
  the boundary doing its job, and it keeps the surface reviewable.

## Alternatives considered

- **Document the rule, enforce in review.** The failure mode described above. Reviewers are
  inconsistent and tired; lint is not.
- **Return generated `Row` types directly.** Removes the mapper boilerplate and reintroduces
  schema-to-UI coupling. The mapper is the point.
- **A generic `Repository<T>` base class.** Encourages `getAll`/`getById` uniformity that does not
  match real access patterns, and pushes features back toward ad-hoc queries. Repositories are
  hand-written per entity against real query shapes.
