/**
 * `secureStore` against a SecureStore that enforces Android's real limit.
 *
 * `chunked-store.test.ts` covers the algorithm in isolation. This suite covers the claim the module
 * exists to make — that a Supabase session too large for `EncryptedSharedPreferences` can be
 * persisted and read back — and it covers it against the mock in `jest.setup.ts`, which rejects any
 * single value over 2048 bytes exactly as the platform does. A regression that stopped chunking
 * would not merely change a key layout here; it would reject the write.
 *
 * Two things are asserted that the isolated suite structurally cannot:
 *
 * **No single value reaches the platform oversized.** The isolated fake has no limit, by design.
 * Here the limit is real, so the wiring of `DEFAULT_CHUNK_SIZE` into `createChunkedStore` — a
 * one-line call that a refactor could drop while every algorithm test still passed — is under test.
 *
 * **Derived keys satisfy SecureStore's key grammar.** `expo-secure-store` validates keys against
 * `/^[\w.-]+$/` and **throws** on a violation rather than rejecting, so an invalid key is a crash on
 * the auth path. The chunker derives `key.__a.0` from a caller's key, and nothing else in the
 * codebase checks that the derived form is still legal.
 *
 * `.test.native.ts` because web resolves `secure-store.web.ts`, where there is no keychain and no
 * limit — the assertions below would be meaningless. jest-expo collects this for `ios` and `android`
 * only (ADR-0019).
 */
import * as SecureStore from 'expo-secure-store';

import { STORAGE_KEYS, secureStore } from '@/core/storage';

/** SecureStore's own `isValidKey`, restated. A mismatch here is a crash, not a failed write. */
const SECURE_STORE_KEY_GRAMMAR = /^[\w.-]+$/u;

/** The mock in `jest.setup.ts` rejects above this, as `EncryptedSharedPreferences` does. */
const ANDROID_VALUE_LIMIT = 2048;

function utf8Length(value: string): number {
  return encodeURIComponent(value).replace(/%[0-9A-F]{2}/gu, 'x').length;
}

/**
 * A plausible Supabase session: three base64url segments, sized past the platform limit the way one
 * carrying `app_roles` claims does ([ADR-0009](../../../../docs/adr/0009-roles-in-jwt.md)).
 *
 * Shaped rather than a run of `'x'` so the JSON envelope and the base64url alphabet are both present
 * — the chunk boundaries then fall inside real token material, which is where a split that corrupted
 * a value would actually land.
 */
function fakeSession(): string {
  const segment = (length: number): string =>
    'aB3-_'.repeat(Math.ceil(length / 5)).slice(0, length);
  const accessToken = `${segment(40)}.${segment(2400)}.${segment(43)}`;

  return JSON.stringify({
    access_token: accessToken,
    refresh_token: segment(64),
    expires_at: 1893456000,
    token_type: 'bearer',
  });
}

/** Every key the store has touched this test, in call order. */
function keysTouched(): readonly string[] {
  return [
    ...jest.mocked(SecureStore.setItemAsync).mock.calls.map(([key]) => key),
    ...jest.mocked(SecureStore.getItemAsync).mock.calls.map(([key]) => key),
    ...jest.mocked(SecureStore.deleteItemAsync).mock.calls.map(([key]) => key),
  ];
}

describe('secureStore on native', () => {
  it('persists and returns a session larger than the platform limit', async () => {
    const session = fakeSession();
    // The guard rather than a comment: if this ever stops being true the test below proves nothing,
    // and a future tidy-up of `fakeSession` is exactly how that would happen quietly.
    expect(utf8Length(session)).toBeGreaterThan(ANDROID_VALUE_LIMIT);

    await secureStore.setItem(STORAGE_KEYS.session, session);

    await expect(secureStore.getItem(STORAGE_KEYS.session)).resolves.toBe(session);
  });

  it('never hands the platform a value it would reject', async () => {
    await secureStore.setItem(STORAGE_KEYS.session, fakeSession());

    // The mock rejects oversized writes, so reaching this line already proves it — asserted anyway,
    // because a reject would surface as an unhandled promise rather than as a legible failure.
    for (const [, value] of jest.mocked(SecureStore.setItemAsync).mock.calls) {
      expect(utf8Length(value)).toBeLessThanOrEqual(ANDROID_VALUE_LIMIT);
    }
  });

  it('derives chunk keys that SecureStore will accept', async () => {
    await secureStore.setItem(STORAGE_KEYS.session, fakeSession());
    await secureStore.getItem(STORAGE_KEYS.session);
    await secureStore.removeItem(STORAGE_KEYS.session);

    // Includes the derived `…__a.0` form, not just the caller's key. `ensureValidKey` throws on a
    // violation, so this is the difference between a failed write and a crashed sign-in.
    expect(keysTouched().length).toBeGreaterThan(1);
    for (const key of keysTouched()) {
      expect(key).toMatch(SECURE_STORE_KEY_GRAMMAR);
    }
  });

  it('stores a short flag at its own key, unchunked', async () => {
    await secureStore.setItem(STORAGE_KEYS.pushPromptShown, 'true');

    // One write, no manifest. The flags in `STORAGE_KEYS` must not pay for the session's problem.
    expect(jest.mocked(SecureStore.setItemAsync).mock.calls).toEqual([
      [STORAGE_KEYS.pushPromptShown, 'true'],
    ]);
    await expect(secureStore.getItem(STORAGE_KEYS.pushPromptShown)).resolves.toBe('true');
  });

  it('reports an absent key as null rather than throwing', async () => {
    await expect(secureStore.getItem('fs.never.written')).resolves.toBeNull();
  });

  it('leaves no chunks behind after a removal', async () => {
    await secureStore.setItem(STORAGE_KEYS.session, fakeSession());
    await secureStore.removeItem(STORAGE_KEYS.session);

    await expect(secureStore.getItem(STORAGE_KEYS.session)).resolves.toBeNull();
    // Every chunk written was also deleted. Left behind, they would sit in the keychain after
    // sign-out — which is the one place in this codebase where leaked bytes are credential-shaped.
    const written = jest
      .mocked(SecureStore.setItemAsync)
      .mock.calls.map(([key]) => key)
      .filter((key) => key !== STORAGE_KEYS.session);
    const deleted = jest.mocked(SecureStore.deleteItemAsync).mock.calls.map(([key]) => key);

    expect(written.length).toBeGreaterThan(0);
    for (const key of written) expect(deleted).toContain(key);
  });
});
