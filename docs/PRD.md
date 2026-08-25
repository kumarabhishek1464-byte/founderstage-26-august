# FounderStage — Product Requirements

**Version:** 0.2 · **Date:** 2026-08-25 · **Status:** draft

For what is actually built today, see [context.md](../context.md). For architectural reasoning, see
[docs/adr/](adr/). This document says what the product should be and how we will know it works.

---

## 1. Product

FounderStage is a professional network for the startup ecosystem — founders, co-founders, investors,
angels, mentors, advisors, coaches and operators. It exists to make the introductions that currently
happen through warm intros and closed WhatsApp groups legible, searchable and open to people without
an existing network.

**One codebase, three targets:** Android, iOS, Expo Web.

### Who it is for

The role taxonomy is already encoded in `src/features/onboarding/model/options.ts` and is the
product's spine:

`founder` · `co_founder` · `investor` · `angel_investor` · `mentor` · `advisor` · `coach` ·
`operator` · `innovator` · `other`

Stages: `idea` · `pre_seed` · `seed` · `series_a` · `growth` · `scale_up` · `other`

Interests span five categories — startup journey, investing, business & skills, community, and
technology/impact sectors.

### What makes it different

Not another feed. The ecosystem's actual scarce resource is **a relevant conversation with someone
who has done the thing you are about to do**. Everything else in the product exists to produce that
conversation and then to make it useful.

That is why messaging is the first real feature, not the last.

---

## 2. Principles

1. **Security is not a UI concern.** Every access decision is enforced in Postgres RLS. A frontend
   restriction is a convenience, never a control.
2. **The screen is thin.** No screen contains a query, a retry, a validation schema or an
   error-to-message mapping. Those have exactly one home each in `src/core/`.
3. **Reuse before creating.** Extend a component with a variant. There is no `ButtonV2`.
4. **Restraint is the brand.** ~90% of any screen is white or neutral. Red `#E53935` is a signal —
   never a background. No gradients, no glassmorphism, no dark mode.
5. **Portability is a seam, not a promise.** Supabase is reachable only from `src/core/database/**`
   and a feature's `api/repository.ts`, so swapping the backend is a bounded change.
6. **Ship it working or say it isn't.** A feature is done when it is verified, not when it compiles.

**Priority order when these conflict:** security > correctness > reliability > maintainability >
performance > UX polish > speed of delivery.

---

## 3. Scope

### 3.1 Now — Messaging (v1)

The current build target. 1:1 and group chat.

**Must have**

| #   | Requirement                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | A signed-in user sees their conversations, most-recently-active first, with the last message and an unread count.                                             |
| M2  | Start a 1:1 conversation with any user found through people search. Starting a second one with the same person opens the existing thread — never a duplicate. |
| M3  | Create a group with a title and 2+ members.                                                                                                                   |
| M4  | Send and receive text messages. A sent message appears immediately (optimistic) and reconciles to its server row exactly once — never twice.                  |
| M5  | Messages arrive in real time without a refetch, in the same order on every device.                                                                            |
| M6  | Ordering is a per-conversation `seq`, assigned by Postgres. Device clocks are displayed, never trusted to sort.                                               |
| M7  | History paginates on a keyset cursor. No `OFFSET`.                                                                                                            |
| M8  | Read state is a watermark (`last_read_seq`) per member, not a row per message per member.                                                                     |
| M9  | Delivery state is visible on your own messages: pending → sent → read, and failed with a retry.                                                               |
| M10 | Group membership has roles — `member` · `moderator` · `admin` · `owner` — and permissions are minimum-role thresholds, evaluated server-side.                 |
| M11 | Every table denies by default. A non-member's read of a conversation returns nothing, and is indistinguishable from the conversation not existing.            |
| M12 | Sending is rate-limited in Postgres, and the client interprets the refusal as a real "slow down", not a generic error.                                        |
| M13 | Blocking prevents delivery server-side. Hiding it in the UI is not sufficient.                                                                                |

**Should have**

Editing and deleting your own messages (with a tombstone); replies quoting a parent; emoji reactions
aggregated into counts; typing indicators over Realtime broadcast (never database writes); message
requests from strangers held out of the main list.

**Deliberately deferred**

- **End-to-end encryption.** Dropped for v1 by decision. The `MessageCipher` port in
  `src/core/crypto/` is the retrofit seam, and the honest consequence is stated in §6.
- Attachments, voice notes, push notifications. The dependencies are installed; the features are not
  built. Push additionally needs APNs/FCM credentials that are not provisioned.
- Message search, multi-device key sync, disappearing messages, calls.

### 3.2 Next — Identity

Real authentication (the current sign-in screens do not authenticate), a `profiles` table, and
profile viewing. Messaging needs a real user; nothing else can be personalised until this exists.

### 3.3 Later — The ecosystem surfaces

Each is a placeholder route today: Home feed, Capital (funding), Hire (jobs), Marketplace, Tools,
Events, Incubators, Notifications. **No work should start on these until messaging and identity are
done.** They are named here so the architecture accommodates them, not to schedule them.

---

## 4. Messaging in detail

### 4.1 Data model — three decisions everything rests on

**Per-conversation `seq bigint`, not a timestamp.** `conversations.next_seq` is incremented under a
row lock inside the send RPC. This one column is simultaneously the sort key, the pagination cursor,
the sync watermark ("everything after seq N") and the dedupe key. Two devices with 400ms of clock
skew interleave wrongly on timestamps; a device with a badly wrong clock pins a message to the top
of the thread forever.

**Read receipts are watermarks, not rows.** `conversation_members.last_read_seq` and
`last_delivered_seq`. Per-message receipt rows are `members × messages` and do not survive a
200-person group. "Read by 5 of 8" is `count(*) where last_read_seq >= message.seq` — the same
information at bounded cost. Advanced with `greatest(last_read_seq, $1)` so an out-of-order call
from a slow network cannot un-read a conversation.

**Idempotency is a database constraint.** `unique (conversation_id, sender_id, client_message_id)`.
The send RPC does `on conflict do nothing` and returns the existing row, so a reconnect replay
returns the original message rather than creating a second one.

Typing and presence get **no tables** — Realtime broadcast and presence only.

### 4.2 Realtime

Supabase Realtime, opt-in per conversation. The load-bearing detail: **a socket that drops and
rejoins silently loses every broadcast sent while it was down.** So the transport reports a gap, and
the client refetches from its own `seq` watermark rather than assuming it missed nothing. Channels
are ref-counted, so navigating A→B→A does not double-subscribe and the last release closes the
socket.

Realtime events **patch the query cache** directly. A blanket invalidate on every message arrival
would refetch a page the socket already delivered.

### 4.3 Authorization

Permissions are **minimum-role thresholds with per-conversation overrides**, not a boolean matrix.
Defaults: send/edit-own/delete-own/react → `member`; delete-any/pin → `moderator`; membership and
group edits → `admin`; changing permissions → `owner`.

Two thresholds are deliberately **not** overridable: `group.change_permissions` (an admin who could
lower it could reach every other threshold) and `member.change_role` (it lets an admin mint another
admin). An actor may only act on someone of strictly lower rank.

`messaging.has_permission()` in Postgres is authoritative. The TypeScript copy in
`src/features/messaging/model/permission.ts` only hides affordances, and a test must assert the two
agree.

### 4.4 Interface

Pure white canvas. Own messages take a neutral tertiary fill with no border; theirs take white with
a hairline border. Radius 16, with the tail corner tightened. Metadata at caption size in tertiary
text. Consecutive messages from one sender group under a single avatar; date separators; an unread
divider.

Red appears on exactly three things: the send control, the unread badge, and destructive confirms.

Skeletons on first load, never spinners. The list is virtualized and inverted — and the reason
attachment dimensions are stored rather than probed is that reflow in an inverted virtualized list
is what makes a chat feel broken.

---

## 5. Non-functional requirements

| Area          | Requirement                                                                                                                                                       |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scale         | Designed for 100k+ MAU and millions of messages. Every query is index-backed; no `select('*')`; no `OFFSET`.                                                      |
| Latency       | A sent message renders locally within one frame. Delivery to another connected client within ~1s on a normal connection.                                          |
| Offline       | Composing offline queues the message; reconnecting sends it exactly once.                                                                                         |
| Memory        | A long-lived chat session must not grow without bound — dedupe structures are capped, channels are released.                                                      |
| Accessibility | Every control announces a role and an accessible name and has a ≥48pt target. Text meets AA contrast; tertiary text is AA-large only and never carries body copy. |
| Privacy       | Push payloads default to "New message" with preview opt-in.                                                                                                       |
| Cost          | No Redis. Rate limiting is Postgres (ADR-0007, ADR-0008).                                                                                                         |

---

## 6. Security requirements

These are non-negotiable, and a change that violates one is a stop-and-escalate, not a workaround.

1. Every user-accessible table has RLS with **default deny**. Membership is verified server-side and
   never taken from a client-supplied `conversation_id`.
2. Policies use `(select auth.uid())`, never bare `auth.uid()` (ADR-0009).
3. `service_role` keys, Redis credentials and admin secrets **never** reach the client. Only
   `EXPO_PUBLIC_*` values do, and everything with that prefix is public by definition.
4. **Never log** a password, access token, refresh token, OTP code, payment secret, or message body.
   `console.*` is a lint error outside `src/core/observability/**` so every log passes the redactor.
5. Analytics records aggregate events with minimal metadata. **Never** a message body or a key.
6. The audit log stores metadata only — actor, conversation, action, timestamp, result.
7. Raw database and server errors never reach a user. Everything normalises through `AppError`, and
   the UI renders `userMessage`, never `message`.
8. Cache keys include the user identity, so a signed-out user cannot read the previous user's cache.
   Sign-out clears the query cache **and** purges the persister.
9. Uploads validate MIME **and** magic bytes **and** size — client-side to fail fast, server-side
   because the client's claim is not evidence.
10. Blocking and rate limiting are enforced in the database.

### The E2EE trust boundary, stated plainly

v1 is **not** end-to-end encrypted. Message bodies are stored in plaintext, which means Supabase —
and anyone with database access — can read them. This is a defensible posture and it is what
LinkedIn messaging and Slack DMs do; it is also what makes server-side search, moderation of
reported content, and push previews possible at all.

It is a real tradeoff and the product must not imply a stronger guarantee than it provides. The
`MessageCipher` port exists so the retrofit is a bounded change rather than a rewrite: messages
carry `content_encoding` and `protocol_version` columns, so a future encoding can be introduced
without re-encrypting history, and a reader that meets a row it cannot open renders one "message
unavailable" bubble instead of failing the page.

---

## 7. Success criteria

Messaging v1 is done when all of the following are demonstrably true:

- [ ] Two accounts can hold a real-time 1:1 conversation, on web and on device.
- [ ] A group of three exchanges messages, and every member sees the same order.
- [ ] A message sent while offline arrives exactly once on reconnect.
- [ ] Killing and restoring a socket backfills the missed messages via the gap resync.
- [ ] A non-member's direct query for a conversation returns nothing — proven by a test, not by
      inspection.
- [ ] Exceeding the send rate limit shows a real "slow down" message with a wait time.
- [ ] `npm run verify` is green.
- [ ] `supabase db reset && supabase test db` passes, including adversarial RLS tests.
- [ ] No message body appears in any log or analytics event.

---

## 8. What exists today (implementation status)

This section tracks what has been built toward the requirements above.

### Foundation layer (ready)

| Component                      | Status                  | Location                             |
| ------------------------------ | ----------------------- | ------------------------------------ |
| Query client with retry policy | ✅ Implemented          | `src/core/query/client.ts`           |
| Cache persistence (whitelist)  | ✅ Implemented          | `src/core/query/persister.ts`        |
| Sign-out cache reset           | ✅ Implemented          | `src/core/query/reset.ts`            |
| Repository query wrapper       | ✅ Implemented          | `src/core/query/repository-query.ts` |
| Cache tiers (7 named)          | ✅ Implemented          | `src/core/query/cache-policy.ts`     |
| Keyset cursor codec            | ✅ Implemented + tested | `src/core/query/cursor.ts`           |
| Database error mapping         | ✅ Implemented + tested | `src/core/database/errors.ts`        |
| Supabase client (PKCE)         | ✅ Implemented          | `src/core/database/client.ts`        |
| MessageCipher port             | ✅ Port + PlainCipher   | `src/core/crypto/`                   |
| Realtime transport port        | ✅ Port only            | `src/core/realtime/transport.ts`     |
| Messaging type model           | ✅ Types only           | `src/features/messaging/model/`      |
| Supabase config                | ✅ config.toml          | `supabase/config.toml`               |

### Not yet built

| Component                                               | Blocks                          |
| ------------------------------------------------------- | ------------------------------- |
| `QueryClientProvider` in app tree                       | All server state                |
| `src/core/auth/` (session provider)                     | All user-scoped features        |
| Database migrations (profiles, conversations, messages) | Everything backend              |
| RLS policies                                            | Security requirements §1–2, §10 |
| Messaging RPCs (send, read, paginate)                   | M4–M9, M12                      |
| Messaging UI (conversation list, thread view)           | M1, M4, M9                      |
| Realtime adapter (Supabase channels)                    | M5, gap resync                  |
| Rate limiting functions                                 | M12                             |
| Blocking logic                                          | M13                             |
| People search                                           | M2                              |

---

## 9. Open questions and risks

| #   | Item                                                                                        | Impact                                                                                       |
| --- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1   | **Docker is not running** (daemon reports "unable to start").                               | Any schema written is unverified. This is the top blocker.                                   |
| 2   | **Authentication does not exist yet.** No `src/core/auth/` directory.                       | Messaging cannot be tested with real users until it does.                                    |
| 3   | **`npm run verify` is not green.** 16 formatting issues + 4 test failures.                  | Nothing should be committed until this is fixed.                                             |
| 4   | **No APNs/FCM credentials.**                                                                | Push delivery is untestable end to end.                                                      |
| 5   | `docs/DESIGN_SYSTEM.md` is referenced by `CLAUDE.md:118` but does not exist.                | Documentation gap, not a drift risk — design is enforced by lint and tokens.                 |
| 6   | `eslint.config.js:209` points `fetch` users at `@/core/network`, which does not exist.      | Harmless today — nothing needs an HTTP client. Becomes misleading the moment something does. |
| 7   | **Group size is unbounded in the model.**                                                   | A 1000-member group breaks participant-loading assumptions. Needs a cap before groups ship.  |
| 8   | **Query client not mounted.** `src/core/query/` is ready but `_layout.tsx` has no provider. | First query-dependent feature will need to wire this.                                        |
