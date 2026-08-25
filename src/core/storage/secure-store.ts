/**
 * `secureStore` on native: `expo-secure-store`, chunked.
 *
 * ## Why this module uses platform extensions and `src/core/haptics/` does not
 *
 * `haptics.ts` branches on `Platform.OS` and explains why: it needs *three* bodies, and a `.web.ts`
 * split leaves the iOS/Android switch in place anyway. Storage is different on both counts.
 *
 * It is a genuine two-way split — web has no keychain, native has one — and the two paths run
 * different algorithms rather than the same algorithm with different constants: native chunks, web
 * must not.
 *
 * More importantly, `expo-secure-store`'s web build is `export default {}`. Not a polyfill, not a
 * throwing stub — an empty object. `SecureStore.getItemAsync` on web therefore calls
 * `undefined(...)` and dies with `TypeError: ExpoSecureStore.getValueWithKeyAsync is not a
 * function`. A `Platform.OS === 'web'` guard in a single file would work, right up until someone
 * adds a call outside the guard; then web breaks at runtime, in the auth path, on a platform that
 * the native test projects do not exercise. Separate files make that unreachable by construction
 * rather than by review — the same posture as the ESLint boundaries.
 *
 * TypeScript resolves `./secure-store` to *this* file and typechecks `secure-store.web.ts`
 * standalone; Metro prefers `.web.ts` when bundling for web. This is the reason the native
 * implementation is the unsuffixed one: no `moduleSuffixes` entry in `tsconfig.json` is needed, and
 * `@/core/storage` stays a normal import everywhere.
 */
import * as SecureStore from 'expo-secure-store';

import { DEFAULT_CHUNK_SIZE, createChunkedStore } from './chunked-store';
import type { KeyValueStore } from './key-value-store';

/**
 * The raw, unchunked SecureStore. Values over ~2048 bytes are rejected here; `createChunkedStore`
 * below is what makes that invisible to callers.
 *
 * `keychainAccessible` is deliberately left at its default (`WHEN_UNLOCKED`) rather than raised to
 * `WHEN_UNLOCKED_THIS_DEVICE_ONLY`. The stricter setting excludes the item from iCloud Keychain
 * backup, which sounds like an improvement and is not one we can afford yet: it would mean a user
 * restoring to a new phone is silently signed out, and the refresh token this protects is already
 * short-lived and server-revocable. Revisit alongside biometric re-auth, which is the point at
 * which device-bound storage starts buying something.
 */
const raw: KeyValueStore = {
  async getItem(key) {
    return await SecureStore.getItemAsync(key);
  },
  async setItem(key, value) {
    await SecureStore.setItemAsync(key, value);
  },
  async removeItem(key) {
    // Resolves whether or not the key existed, which is what `KeyValueStore` promises. A rejection
    // here means the keychain itself is unhappy, and that should propagate.
    await SecureStore.deleteItemAsync(key);
  },
};

/**
 * Credentials. The Supabase session lives here and nothing else does yet.
 *
 * Keys are constrained by SecureStore to `/^[\w.-]+$/` — alphanumerics, `_`, `.` and `-`. The
 * violation throws rather than returning an error, so it is a crash on the auth path, not a failed
 * write. Every key in `STORAGE_KEYS` satisfies it, and so does the `key.__chunk.N` form the chunker
 * derives; a future key with a `:` or a `/` in it would not.
 */
export const secureStore: KeyValueStore = createChunkedStore(raw, DEFAULT_CHUNK_SIZE);
