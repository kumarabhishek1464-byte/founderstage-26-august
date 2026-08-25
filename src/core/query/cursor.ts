/**
 * Keyset cursors, encoded opaquely.
 *
 * `OFFSET` is not used for pagination anywhere in this codebase, and the reason is not style. An
 * `OFFSET 10000` makes Postgres walk and discard ten thousand rows to return twenty, so page 500
 * costs five hundred times page one — and, worse, a row inserted at the head between two requests
 * shifts every subsequent page by one, so the user sees an item twice and never sees another. A
 * keyset predicate has neither problem: it is an index range scan whose cost is independent of depth,
 * and it is stable under concurrent inserts because it names a *position*, not a count.
 *
 * ```sql
 * where (created_at, id) < (cursor.created_at, cursor.id)
 * order by created_at desc, id desc
 * limit $n
 * ```
 *
 * `id` is in the key because `created_at` is not unique — two rows written in the same transaction
 * share a timestamp, and a cursor on the timestamp alone would either skip one of them or return it
 * twice depending on which side the comparison fell.
 *
 * ## Why it is encoded at all
 *
 * A cursor is a position in someone else's result set, and the moment it looks like
 * `{ createdAt, id }` a caller starts building one, comparing two, or rendering the timestamp. Then
 * the ordering key cannot change without breaking those callers. Base64url makes it a token: the
 * only sanctioned operations are {@link encodeCursor} and {@link decodeCursor}, and adding a third
 * component to the key later is a change to this file alone.
 *
 * It is **not** a security boundary. The token is trivially reversible and contains only a timestamp
 * and an id the caller already had. RLS decides what a cursor can reach
 * ([ADR-0011](../../../docs/adr/0011-repository-pattern.md)); this is about coupling.
 *
 * ## The server decodes the same format
 *
 * A paging RPC receives the token and has to reverse it, so the format is deliberately trivial:
 * base64url of `<created_at>|<id>`, no JSON, no nesting. In SQL that is a `translate` for the
 * alphabet difference, a pad, and a `decode`. Anything richer would push a JSON parser into a
 * `SECURITY DEFINER` function for no gain.
 */
import { decodeBase64Url, encodeBase64Url } from '@/core/encoding';

/**
 * The delimiter, chosen because neither component can contain it: a UUID is hex and dashes, and a
 * PostgREST timestamp is digits and `-`, `:`, `.`, `+`, `T`, `Z`. So the split is unambiguous
 * without escaping, and a token that somehow contains two of them fails validation rather than
 * silently losing a field.
 */
const DELIMITER = '|';

/**
 * PostgREST renders `timestamptz` with up to **six** fractional digits and an explicit offset —
 * `2026-08-25T12:34:56.789012+00:00` — while `Date.prototype.toISOString` produces exactly three
 * and a `Z`. Both forms have to round-trip, because one comes from the database and the other from
 * a test or a client-side default.
 */
const TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/u;

/** Any UUID version. The database generates these; the client only ever echoes them. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/**
 * A position in a `(created_at desc, id desc)` ordering.
 *
 * The field names are the domain's, not the column's — a repository's mapper already translates
 * `created_at` to `createdAt`, and a cursor built from a domain object should not have to translate
 * back ([ADR-0011](../../../docs/adr/0011-repository-pattern.md) §3).
 */
export interface Cursor {
  /** ISO 8601 with an explicit offset. */
  readonly createdAt: string;
  readonly id: string;
}

function isValidCursor(cursor: Cursor): boolean {
  return (
    TIMESTAMP_PATTERN.test(cursor.createdAt) &&
    // A shape match is not enough — the pattern's `\d{2}` runs accept `2026-13-25T99:99:99Z`. It is
    // not a full calendar check either: V8 rolls `2026-02-30` over to March rather than rejecting it,
    // and that is fine here. A cursor's timestamp comes from the database, so this guard is aimed at
    // a caller passing something that is not a timestamp at all, not at arithmetic on real dates.
    Number.isFinite(Date.parse(cursor.createdAt)) &&
    UUID_PATTERN.test(cursor.id)
  );
}

/**
 * `null` when the position is not one this codec can represent — which in practice means a caller
 * passed a `Date`-formatted string with no offset, or an id that is not a UUID.
 *
 * Returning `null` rather than throwing because the usual call site is TanStack Query's
 * `getNextPageParam`, which runs inside the query lifecycle: a throw there surfaces as a failed
 * query rather than as "there is no next page", and the second is both truer and recoverable.
 */
export function encodeCursor(cursor: Cursor): string | null {
  if (!isValidCursor(cursor)) return null;

  return encodeBase64Url(`${cursor.createdAt}${DELIMITER}${cursor.id}`);
}

/**
 * `null` for anything that is not a token this module produced.
 *
 * Total by design. A cursor reaches this function from a URL query parameter on web, from a
 * rehydrated cache entry, and from an RPC response — none of which are trustworthy, and all of
 * which are reachable by a user editing an address bar. The caller's correct response to `null` is
 * to start from the first page, which is always a valid thing to do.
 */
export function decodeCursor(token: string): Cursor | null {
  const decoded = decodeBase64Url(token);
  if (decoded === null) return null;

  const parts = decoded.split(DELIMITER);
  if (parts.length !== 2) return null;

  const [createdAt, id] = parts;
  if (createdAt === undefined || id === undefined) return null;

  const cursor: Cursor = { createdAt, id };

  return isValidCursor(cursor) ? cursor : null;
}
