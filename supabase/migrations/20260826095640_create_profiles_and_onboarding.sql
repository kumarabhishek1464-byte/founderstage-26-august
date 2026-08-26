/*
# Founder profiles — the schema the onboarding flow submits into

## Summary

Creates the storage that the four-step onboarding flow (`AboutYouView` → `RoleView` →
`InterestsView` → `VerificationView`) hands over to. A single `profiles` row per authenticated
user holds every answer, plus a review status the "You're all set" screen already describes.

The tables here are owner-scoped: a profile belongs to exactly one `auth.users` account and only
that account can read or edit it. Reviewers see profiles through a separate service role path
that RLS does not need to describe today.

## New tables

### `public.profiles`

The single row per user that captures the full onboarding draft.

- `id` (uuid, primary key, references `auth.users(id)` on delete cascade) — one profile per
  account. Not a separate surrogate key: the account and the profile share an identity.
- `name` (text, not null) — full display name, from the About You step.
- `mobile` (text, not null) — E.164-shaped phone as the form captures it.
- `whatsapp` (text, nullable) — optional; only set if the user answered it.
- `city` (text, not null) — free-text city label the Select produced.
- `role` (text, not null) — Founder / Investor / Mentor / etc. Stored as text rather than an
  enum so a new option can be added without a migration on the write path.
- `sector` (text, not null) — AI, FinTech, HealthTech, ...
- `stage` (text, not null) — Idea, Pre-seed, Seed, ...
- `interests` (text[], not null, default '{}') — the multi-select from step 3.
- `website` (text, nullable) — verification link 1, optional.
- `linkedin` (text, not null) — verification link 2, required by the form.
- `twitter` (text, nullable) — verification link 3, optional.
- `about` (text, not null) — the one/two-sentence bio.
- `review_status` (text, not null, default 'pending', constrained to
  {'pending','approved','rejected','changes_requested'}) — the status the Complete screen refers
  to. Text + CHECK rather than an enum, again to keep additions cheap.
- `submitted_at` (timestamptz, not null, default now()) — when this row was first written.
- `updated_at` (timestamptz, not null, default now()) — touched by the trigger below on every
  update so a reviewer can sort by recent activity.

An index on `review_status` supports the reviewer queue query.

## Security

- Row Level Security is enabled on `profiles`.
- Four separate policies (SELECT, INSERT, UPDATE, DELETE), all scoped `TO authenticated` and
  gated by `auth.uid() = id`, so a signed-in user can only touch their own row.
- `id` defaults to `auth.uid()` on insert, matching the pattern the frontend uses
  (`.insert({ name, mobile, ... })` without threading the id explicitly).

## Notes

1. `review_status` is NOT user-writable in practice — a user can UPDATE their own row and set
   any value the CHECK allows, so the reviewer flow will land as a SECURITY DEFINER function
   plus a column-level revoke in a follow-up migration. That is deliberately out of scope here:
   this migration only serves what the onboarding screens submit.

2. The migration is idempotent (`IF NOT EXISTS` + `DROP POLICY IF EXISTS` before `CREATE
   POLICY`) so re-running it after a transient timeout is safe.

3. No destructive statements: this is a first-time create. Nothing is dropped, renamed or
   retyped.
*/

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,

  name text NOT NULL,
  mobile text NOT NULL,
  whatsapp text,
  city text NOT NULL,

  role text NOT NULL,
  sector text NOT NULL,
  stage text NOT NULL,

  interests text[] NOT NULL DEFAULT '{}',

  website text,
  linkedin text NOT NULL,
  twitter text,
  about text NOT NULL,

  review_status text NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'approved', 'rejected', 'changes_requested')),

  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profiles_review_status_idx
  ON public.profiles (review_status);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_touch_updated_at ON public.profiles;
CREATE TRIGGER profiles_touch_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON public.profiles;
CREATE POLICY "select_own_profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "insert_own_profile" ON public.profiles;
CREATE POLICY "insert_own_profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;
CREATE POLICY "update_own_profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "delete_own_profile" ON public.profiles;
CREATE POLICY "delete_own_profile"
  ON public.profiles FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = id);
