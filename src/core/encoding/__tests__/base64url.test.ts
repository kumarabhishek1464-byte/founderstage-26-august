/**
 * The codec is thirty lines of bit arithmetic, which is exactly the kind of code that is either
 * correct or subtly wrong in a way no caller notices until production. Two callers depend on it:
 * `env.ts` reads a JWT's payload to refuse a `service_role` key, and `cursor.ts` encodes pagination
 * positions. A decoder that silently returned a truncated payload would make the first guard pass on
 * a key it should reject — so the assertions below are on exact bytes, not on "it round-trips".
 *
 * The published RFC 4648 §10 vectors are used rather than invented ones, because they cover all three
 * residues of the three-byte group (`foo` = 0, `fo` = 2, `f` = 1) and pin the output against an
 * external authority rather than against this implementation's own behaviour.
 */
import { decodeBase64Url, encodeBase64Url } from '@/core/encoding';

/** RFC 4648 §10, minus the `=` padding that base64url omits. */
const RFC_VECTORS = [
  ['', ''],
  ['f', 'Zg'],
  ['fo', 'Zm8'],
  ['foo', 'Zm9v'],
  ['foob', 'Zm9vYg'],
  ['fooba', 'Zm9vYmE'],
  ['foobar', 'Zm9vYmFy'],
] as const;

describe('encodeBase64Url', () => {
  it.each(RFC_VECTORS)('encodes %p as %p', (plain, encoded) => {
    expect(encodeBase64Url(plain)).toBe(encoded);
  });

  /**
   * Padding is what makes a base64 value unsafe to drop into a URL path or a query string without
   * escaping, and it carries no information — the byte count is implied by the length.
   */
  it('never emits padding', () => {
    for (let length = 0; length < 12; length += 1) {
      expect(encodeBase64Url('x'.repeat(length))).not.toContain('=');
    }
  });

  /**
   * The whole reason for the `-_` alphabet. A `+` becomes a space when a form-encoded value is
   * parsed, and a `/` ends a path segment — either one corrupts a cursor in transit.
   */
  it('never emits a character that needs URL escaping', () => {
    // 0xFB 0xFF 0xFE is the byte triple whose standard encoding is `+//+`.
    const encoded = encodeBase64Url(String.fromCharCode(0xfb, 0xff, 0xfe));

    expect(encoded).not.toBeNull();
    expect(encoded).not.toMatch(/[+/=]/u);
  });

  /**
   * Latin-1, so a code point above 255 has no single-byte representation. Returning `null` rather
   * than encoding the low byte matters: `String.fromCharCode(0x0141)` and `String.fromCharCode(0x41)`
   * would otherwise produce the same token, and a cursor built from one would decode as the other.
   */
  it.each([
    ['π', 'a two-byte code point'],
    ['€', 'a three-byte code point'],
    ['🚀', 'a surrogate pair'],
    ['ok then π', 'a code point in an otherwise-ASCII string'],
  ])('refuses %p — %s', (value) => {
    expect(encodeBase64Url(value)).toBeNull();
  });

  it('accepts the whole latin-1 range', () => {
    expect(encodeBase64Url(String.fromCharCode(0xff))).not.toBeNull();
  });
});

describe('decodeBase64Url', () => {
  it.each(RFC_VECTORS)('decodes the encoding of %p back to itself', (plain, encoded) => {
    expect(decodeBase64Url(encoded)).toBe(plain);
  });

  /**
   * base64url omits padding, but a value arriving from another system may not. Rejecting it would
   * turn an interoperability detail into a decode failure — and a JWT segment is the case that
   * matters, since some issuers pad.
   */
  it.each([
    ['Zg==', 'f'],
    ['Zm8=', 'fo'],
    ['Zm9vYg==', 'foob'],
    ['Zm9vYmE=', 'fooba'],
  ])('tolerates padding on %p', (encoded, plain) => {
    expect(decodeBase64Url(encoded)).toBe(plain);
  });

  /**
   * Standard base64's alphabet is a *different* alphabet, and accepting both would hide the real
   * defect — a caller encoding with the wrong one — behind a decode that appears to work.
   */
  it.each(['+//+', 'ab+c', 'ab/c'])('refuses the standard-base64 value %p', (encoded) => {
    expect(decodeBase64Url(encoded)).toBeNull();
  });

  it.each([
    ['hello world', 'a space'],
    ['ab!cd', 'punctuation'],
    ['ab\ncd', 'a newline'],
    ['Zm9v=Yg', 'padding in the middle'],
    ['Zm9🚀v', 'a non-ASCII code point'],
  ])('refuses %p — %s', (encoded) => {
    expect(decodeBase64Url(encoded)).toBeNull();
  });

  /**
   * The distinction the `null` return exists for. `''` is a successful decode of nothing; `null` is a
   * failure. Collapsing them would let `env.ts` read a malformed token as a payload with no `role`
   * claim, which is precisely the case it must refuse.
   */
  it('distinguishes an empty input from a malformed one', () => {
    expect(decodeBase64Url('')).toBe('');
    expect(decodeBase64Url('!')).toBeNull();
  });
});

describe('round trip', () => {
  it('is exact for every byte value', () => {
    for (let byte = 0; byte <= 0xff; byte += 1) {
      const value = String.fromCharCode(byte);
      const encoded = encodeBase64Url(value);

      expect(encoded).not.toBeNull();
      expect(decodeBase64Url(encoded ?? '')).toBe(value);
    }
  });

  it('is exact at every length, so no group residue is mishandled', () => {
    // Deliberately not all one character: a repeated byte hides an ordering bug inside the group.
    const source = 'The quick brown fox jumps over the lazy dog.';

    for (let length = 0; length <= source.length; length += 1) {
      const value = source.slice(0, length);
      const encoded = encodeBase64Url(value);

      expect(encoded).not.toBeNull();
      expect(decodeBase64Url(encoded ?? '')).toBe(value);
    }
  });

  /** The shape `env.ts` actually feeds it: the middle segment of a JWT. */
  it('survives a JWT payload segment', () => {
    const claims = JSON.stringify({ role: 'anon', iss: 'supabase', exp: 2_000_000_000 });
    const encoded = encodeBase64Url(claims);

    expect(encoded).not.toBeNull();

    const parsed: unknown = JSON.parse(decodeBase64Url(encoded ?? '') ?? 'null');

    expect(parsed).toStrictEqual({ role: 'anon', iss: 'supabase', exp: 2_000_000_000 });
  });
});
