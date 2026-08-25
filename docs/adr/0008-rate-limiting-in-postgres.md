# ADR-0008 — Rate limiting in Postgres; Supabase Auth owns auth throttling

- **Status:** Accepted
- **Date:** 2026-08-24

## Context

Rate limiting must be server-side — a client-side limiter is a UX affordance, not a control, since
an attacker simply does not run our client.

The requirements list login, OTP, password reset and signup among the actions to rate limit,
alongside application actions like post creation, comments, follows, search, upload and messaging.

That list conflates two different things:

- **Auth endpoints** (`/token`, `/otp`, `/recover`, `/signup`) are served by **GoTrue**, Supabase's
  auth service. Our client never mediates them. We _cannot_ rate limit them from application code,
  and reimplementing a limiter in front of them would be both bypassable and weaker than the one
  already there.
- **Application actions** run through PostgREST or our own Edge Functions, which we do control.

## Decision

### Auth throttling: configure, don't build

Set in `supabase/config.toml` (and mirrored in the dashboard for hosted projects):

```toml
[auth.rate_limit]
sign_in_sign_ups   = 30    # per 5 min per IP
token_refresh      = 150   # per 5 min per IP
otp               = 30    # per hour
verify            = 30     # per 5 min per IP
email_sent        = 10     # per hour
```

These are reviewed as part of `docs/SECURITY.md`. They are configuration, not code.

### Application actions: fixed-window counters in Postgres

An `UNLOGGED` counter table plus a `SECURITY DEFINER` function:

```sql
-- UNLOGGED: no WAL, not replicated. Losing counters on crash is acceptable
-- for rate limits and removes the dominant write cost.
create unlogged table rate_limit.buckets (
  bucket       text        not null,
  subject      text        not null,   -- user id, or hashed IP for anonymous
  window_start timestamptz not null,
  count        integer     not null default 0,
  primary key (bucket, subject, window_start)
);

create function rate_limit.consume(
  p_bucket  text,
  p_subject text,
  p_limit   integer,
  p_window  interval
) returns boolean
language plpgsql security definer set search_path = '' as $$ ... $$;
```

Called at the top of any `SECURITY DEFINER` RPC that mutates state, and from Edge Functions. Limits
live in one table keyed by bucket name, so tuning `post.create` does not require a deploy.

Expired rows are swept on a schedule; because the table is `UNLOGGED`, the sweep is cheap.

### The port

`src/core/security/rate-limiter.ts` defines the interface the client uses to _interpret_ limit
responses (HTTP 429 / `RateLimitError`, retry-after handling, backoff, user-facing copy). The
enforcement is server-side; the client only reacts. Swapping the server driver to Redis later does
not touch client code. See [ADR-0007](0007-no-redis-no-bloom-filters.md).

## Consequences

- No second datastore. Limits are transactional with the data they guard.
- Auth throttling is as strong as the platform's, because it _is_ the platform's.
- Fixed windows allow up to 2× the limit across a boundary. Accepted — for abuse prevention this is
  immaterial, and a sliding window costs more than it returns here.
- Cost: counter writes hit Postgres. `UNLOGGED` removes the WAL cost; contention is the documented
  trigger for revisiting.

## Alternatives considered

- **Redis / Upstash now.** [ADR-0007](0007-no-redis-no-bloom-filters.md).
- **Sliding-window log.** One row per request. Far more expensive for a rounding-error gain.
- **Rate limit at the CDN/WAF edge.** Complementary and worth adding later for volumetric attacks,
  but it cannot see application identity (`user_id`), so it cannot enforce per-user limits.
- **Client-side limiting only.** Not a control.
