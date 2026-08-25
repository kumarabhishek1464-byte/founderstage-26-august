/**
 * Branded identifiers, and the one place a new identifier is minted.
 *
 * ## Why brands
 *
 * Every identifier in this system is a UUID string, which means the compiler cannot tell a
 * `conversationId` from a `messageId` from a `userId`. In a messaging system that is not a
 * theoretical risk: `send_message(conversationId, senderId)` and
 * `react(messageId, userId)` sit next to each other, both take two UUID strings, and
 * transposing them produces a call that type-checks, runs, and fails at the database — or
 * worse, succeeds against the wrong row. RLS is the backstop, but relying on RLS to catch a
 * transposed argument means the bug is only found by a denied request in production.
 *
 * The brand costs a cast at exactly one boundary — the mappers in
 * `src/features/messaging/model/mappers.ts`, which turn database rows into domain objects —
 * and buys type safety everywhere above it.
 *
 * ## Why a `unique symbol` and not a string property
 *
 * `type UserId = string & { __brand: 'UserId' }` is assignable from an object literal
 * carrying that property, and it pollutes autocomplete on every id-typed value. A `declare`d
 * `unique symbol` has no runtime existence at all: the brand is unforgeable, invisible in
 * completion, and erased entirely by the compiler.
 */
import * as Crypto from 'expo-crypto';

declare const brandKey: unique symbol;

/**
 * `Branded<string, 'UserId'>` is a `string` everywhere a `string` is read — it interpolates,
 * compares and serialises normally — but nothing else is assignable *to* it.
 */
export type Branded<T, B extends string> = T & { readonly [brandKey]: B };

/**
 * The authenticated user, as identified by `auth.uid()`.
 *
 * Lives in core rather than in a feature because auth, analytics, storage keys and every
 * feature's query keys all need it, and a type owned by one feature that four others import
 * is the shape ADR-0003 exists to prevent.
 */
export type UserId = Branded<string, 'UserId'>;

/**
 * Asserts that a string from the database (or from `session.user.id`) is a user id.
 *
 * Deliberately unvalidated. A runtime UUID check here would be security theatre: the value
 * comes from a JWT the server signed or from a row RLS already gated, and a check that
 * cannot fail in practice trains readers to assume the type means more than it does. The
 * function exists to make the cast *visible and greppable*, not to validate.
 */
export function asUserId(value: string): UserId {
  return value as UserId;
}

/**
 * A fresh v4 UUID.
 *
 * `expo-crypto` rather than the `uuid` package: it is already a dependency, it is backed by
 * the platform CSPRNG on all three targets, and adding `uuid` would mean answering the seven
 * questions in `docs/CONTRIBUTING.md` for something the SDK already ships.
 *
 * Used for client-generated identity — the idempotency key on an outgoing message, and the
 * per-installation device id behind `STORAGE_KEYS.deviceId`. Server-generated primary keys
 * come from `gen_random_uuid()` in Postgres and never pass through here.
 */
export function newUuid(): string {
  return Crypto.randomUUID();
}
