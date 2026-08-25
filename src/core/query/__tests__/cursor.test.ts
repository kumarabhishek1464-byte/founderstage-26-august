/**
 * ADR-0014 names the cursor codec as a primitive worth testing directly, and the reason is that its
 * failure mode is silent. A cursor that decodes to *almost* the right position does not throw — it
 * skips a row, or repeats one, on page three of a list nobody scrolls in a test. So the suite is
 * arranged around three properties rather than around the two functions:
 *
 * 1. **Round trip is exact**, including the six-fraction-digit form PostgREST actually emits.
 * 2. **Decode is total.** A cursor arrives from a URL on web, so every malformed input has to produce
 *    `null` — meaning "start from the first page" — rather than a throw inside a query.
 * 3. **The token is opaque and URL-safe.** If it leaked the raw values a caller would parse it, and
 *    the ordering key could never gain a third component.
 */
import { decodeCursor, encodeCursor } from '../cursor';

import type { Cursor } from '../cursor';

const ID = '3f2a91c4-1d0e-4b7a-9c88-2e5f0a6b7d31';

/** As PostgREST renders `timestamptz`: microsecond precision, explicit offset. */
const POSTGREST_TIMESTAMP = '2026-08-25T12:34:56.789012+00:00';

/** As `Date.prototype.toISOString` renders it: millisecond precision, `Z`. */
const ISO_TIMESTAMP = '2026-08-25T12:34:56.789Z';

function token(cursor: Cursor): string {
  const encoded = encodeCursor(cursor);
  if (encoded === null) throw new Error(`expected ${JSON.stringify(cursor)} to encode`);

  return encoded;
}

describe('round trip', () => {
  it.each([
    [POSTGREST_TIMESTAMP, 'the PostgREST rendering'],
    [ISO_TIMESTAMP, 'the toISOString rendering'],
    ['2026-08-25T12:34:56+00:00', 'no fractional part'],
    ['2026-08-25T12:34:56.7+05:30', 'one fractional digit and a non-UTC offset'],
    ['2026-08-25T12:34:56.789012-08:00', 'a negative offset'],
  ])('preserves %p — %s', (createdAt) => {
    expect(decodeCursor(token({ createdAt, id: ID }))).toStrictEqual({ createdAt, id: ID });
  });

  /**
   * Microseconds are the point. `new Date(…)` truncates to milliseconds, so a cursor that had been
   * normalised through `Date` would compare as *earlier* than the row it came from — and that row
   * would be returned again at the head of the next page.
   */
  it('does not truncate microseconds', () => {
    const createdAt = '2026-08-25T12:34:56.789012+00:00';
    const decoded = decodeCursor(token({ createdAt, id: ID }));

    expect(decoded?.createdAt).toBe(createdAt);
  });
});

describe('the token', () => {
  it('is safe in a URL and in a query key', () => {
    expect(token({ createdAt: POSTGREST_TIMESTAMP, id: ID })).toMatch(/^[A-Za-z0-9_-]+$/u);
  });

  /**
   * Not a security property — the token is trivially reversible. It is a coupling property: a token
   * that reads as a timestamp invites a caller to slice it, and then the ordering key is frozen.
   */
  it('does not read as its contents', () => {
    const encoded = token({ createdAt: POSTGREST_TIMESTAMP, id: ID });

    expect(encoded).not.toContain(ID);
    expect(encoded).not.toContain('2026');
  });

  it('is stable, so a query key built from it does not churn', () => {
    const cursor = { createdAt: POSTGREST_TIMESTAMP, id: ID };

    expect(encodeCursor(cursor)).toBe(encodeCursor(cursor));
  });

  it('differs for adjacent rows sharing a timestamp', () => {
    const other = '00000000-1d0e-4b7a-9c88-2e5f0a6b7d31';

    expect(token({ createdAt: POSTGREST_TIMESTAMP, id: ID })).not.toBe(
      token({ createdAt: POSTGREST_TIMESTAMP, id: other })
    );
  });
});

describe('encodeCursor', () => {
  /**
   * An offset-less timestamp is the mistake a caller makes by reaching for
   * `toISOString().slice(0, 19)` or by reading a `timestamp` column instead of a `timestamptz` one.
   * The database would then interpret it in the session's zone rather than UTC, and the page would
   * be silently offset by hours.
   */
  it.each([
    ['2026-08-25T12:34:56', 'no offset'],
    ['2026-08-25 12:34:56+00:00', 'a space instead of T'],
    ['2026-08-25', 'a date only'],
    ['2026-08-25T12:34:56.789012345+00:00', 'more precision than Postgres stores'],
    ['2026-13-25T12:34:56Z', 'an impossible month'],
    ['2026-08-25T99:99:99Z', 'an impossible time'],
    ['', 'nothing'],
  ])('refuses the timestamp %p — %s', (createdAt) => {
    expect(encodeCursor({ createdAt, id: ID })).toBeNull();
  });

  /**
   * Documented rather than fixed. V8 rolls a day past the end of its month over into the next one, so
   * this encodes — and the resulting cursor is a real, well-ordered instant. A stricter calendar check
   * would be code guarding against an input that cannot arrive, since the timestamp always comes from
   * a `timestamptz` column.
   */
  it('accepts a rolled-over date rather than rejecting it', () => {
    expect(encodeCursor({ createdAt: '2026-02-30T12:34:56Z', id: ID })).not.toBeNull();
  });

  it.each([
    ['not-a-uuid', 'free text'],
    ['3f2a91c4-1d0e-4b7a-9c88-2e5f0a6b7d3', 'a truncated UUID'],
    ['3f2a91c4-1d0e-4b7a-9c88-2e5f0a6b7d311', 'an over-long UUID'],
    ['3f2a91c4_1d0e_4b7a_9c88_2e5f0a6b7d31', 'underscores instead of dashes'],
    ['3f2a91c4-1d0e-4b7a-9c88-2e5f0a6b7dzz', 'non-hex characters'],
    ['42', 'a bigint id from some other table'],
    ['', 'nothing'],
  ])('refuses the id %p — %s', (id) => {
    expect(encodeCursor({ createdAt: POSTGREST_TIMESTAMP, id })).toBeNull();
  });

  /**
   * `null` rather than a throw, because the call site is TanStack Query's `getNextPageParam`. A throw
   * there fails the whole query; `null` is read as "there is no next page", which is both truer and
   * recoverable.
   */
  it('returns null rather than throwing', () => {
    expect(() => encodeCursor({ createdAt: 'nonsense', id: 'nonsense' })).not.toThrow();
  });
});

describe('decodeCursor', () => {
  it.each([
    ['', 'an empty token'],
    ['not a token', 'a space, which is not in the alphabet'],
    ['!!!!', 'characters outside base64url'],
    ['MjAyNi0wOC0yNQ', 'a well-formed token with no delimiter'],
    ['YXxifGM', 'a token with two delimiters'],
    ['fDNmMmE5MWM0', 'a token with an empty timestamp'],
  ])('rejects %p — %s', (candidate) => {
    expect(decodeCursor(candidate)).toBeNull();
  });

  /**
   * The case that motivates validating on the way *out* as well as on the way in: a token can be
   * hand-crafted in an address bar, so a decode that trusted its own format would hand a paging RPC
   * a string the query planner cannot cast, turning a URL edit into a 500.
   */
  it('rejects a hand-crafted token whose parts are the wrong shape', () => {
    // base64url of `tomorrow|me` — structurally a cursor, semantically not one.
    const forged = 'dG9tb3Jyb3d8bWU';

    expect(decodeCursor(forged)).toBeNull();
  });

  it('rejects a token carrying a valid timestamp and an invalid id', () => {
    // base64url of `2026-08-25T12:34:56Z|1`
    const forged = 'MjAyNi0wOC0yNVQxMjozNDo1Nlp8MQ';

    expect(decodeCursor(forged)).toBeNull();
  });

  it('never throws, whatever it is given', () => {
    for (const candidate of ['', '=', '===', 'a', 'ab', '🚀', 'x'.repeat(4096)]) {
      expect(() => decodeCursor(candidate)).not.toThrow();
    }
  });
});
