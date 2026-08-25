/**
 * base64url, written out.
 *
 * Neither obvious decoder is available on all three targets, and this is the file that stops that
 * fact from being rediscovered:
 *
 * - **`Buffer`** is Node-only, and `@types/node` is deliberately excluded from `tsconfig.json`
 *   ([ADR-0004](../../../docs/adr/0004-typescript-strictness.md)) so Node globals do not type-check
 *   in app code. A `Buffer.from(…, 'base64url')` would compile only by adding those types back and
 *   would then fail at runtime in a release bundle.
 * - **`atob` / `btoa`** are not polyfilled by React Native. They exist on web, so a codec written
 *   against them passes the `web` Jest project and every browser check, and fails on device — the
 *   worst possible failure ordering.
 *
 * So both directions are implemented here, once, and every caller shares them. `env.ts` reads a
 * JWT's payload segment; `src/core/query/cursor.ts` encodes keyset cursors. Two hand-rolled copies
 * of this arithmetic in two files is exactly what CLAUDE.md's first rule forbids.
 *
 * ## Latin-1, not UTF-8
 *
 * Each character is treated as one byte, so the round trip is exact for code points 0–255 and lossy
 * above them. That is the right contract for both callers — a JWT segment is base64 of ASCII JSON,
 * and a cursor is a timestamp and a UUID — and {@link encodeBase64Url} rejects anything outside the
 * range rather than silently truncating. A UTF-8 aware variant belongs here too if something ever
 * needs one, next to this one rather than instead of it.
 *
 * ## No padding
 *
 * base64url omits `=` (RFC 4648 §5). {@link decodeBase64Url} accepts padding anyway, because a
 * value that arrives from a server or a URL may carry it, and rejecting it would turn an
 * interoperability detail into a decode failure.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/**
 * `null` when `value` contains a code point above 255 — see the module docblock. Never throws:
 * every caller is on a path where a thrown encoder would be worse than a `null` it can handle.
 */
export function encodeBase64Url(value: string): string | null {
  let encoded = '';

  for (let index = 0; index < value.length; index += 3) {
    const byte0 = value.charCodeAt(index);
    const byte1 = index + 1 < value.length ? value.charCodeAt(index + 1) : null;
    const byte2 = index + 2 < value.length ? value.charCodeAt(index + 2) : null;

    if (byte0 > 0xff || (byte1 !== null && byte1 > 0xff) || (byte2 !== null && byte2 > 0xff)) {
      return null;
    }

    // `charAt` rather than `[…]`: `noUncheckedIndexedAccess` types an index access as
    // `string | undefined`, and every sextet here is provably in range by construction.
    encoded += ALPHABET.charAt(byte0 >> 2);
    encoded += ALPHABET.charAt(((byte0 & 0x03) << 4) | ((byte1 ?? 0) >> 4));

    if (byte1 === null) break;
    encoded += ALPHABET.charAt(((byte1 & 0x0f) << 2) | ((byte2 ?? 0) >> 6));

    if (byte2 === null) break;
    encoded += ALPHABET.charAt(byte2 & 0x3f);
  }

  return encoded;
}

/**
 * `null` on anything malformed, so a decode failure can never be mistaken for a successful decode
 * of an empty value — and, in `env.ts`'s case, can never turn a valid key into a rejected one.
 *
 * Standard base64's `+` and `/` are **not** accepted. They are a different alphabet, and quietly
 * decoding both would hide a caller that is encoding with the wrong one.
 */
export function decodeBase64Url(value: string): string | null {
  // Padding carries no information here — the byte count is implied by the length.
  const body = value.replace(/={0,2}$/u, '');

  let accumulator = 0;
  let bitCount = 0;
  let decoded = '';

  for (const character of body) {
    const sextet = ALPHABET.indexOf(character);
    if (sextet === -1) return null;

    // Masked to 16 bits: `bitCount` never exceeds 12 before extraction, so no meaningful bit is
    // ever discarded, and the accumulator cannot overflow `<<`.
    accumulator = ((accumulator << 6) | sextet) & 0xffff;
    bitCount += 6;

    if (bitCount >= 8) {
      bitCount -= 8;
      decoded += String.fromCharCode((accumulator >> bitCount) & 0xff);
    }
  }

  return decoded;
}
