/**
 * `appStore` — non-secret persistence: the dehydrated query cache and small client flags.
 *
 * ## Why this is a second store rather than a second key prefix
 *
 * Sign-out purges the query cache, and cache purging must not be able to touch credentials. With one
 * store the purge is a key list that someone has to keep correct; with two it is
 * `appStore.removeItem(STORAGE_KEYS.queryCache)`, and no reachable call can take the session with
 * it. The separation is also what lets the two stores differ in the thing that matters — on native
 * `secureStore` is the keychain and this is plain, unencrypted app storage.
 *
 * The corollary is a rule, not a preference: **nothing sensitive is written here.** The query cache
 * is persisted from a whitelist of the `static` and `reference` tiers only
 * ([ADR-0006](../../../docs/adr/0006-server-state-and-caching.md)), which is what keeps a user's own
 * data — and a previous user's — out of this file.
 *
 * ## No platform split
 *
 * `@react-native-async-storage/async-storage` ships a web build over `localStorage`, so the same
 * module works on all three platforms. That is the difference from `secure-store.ts`, whose web
 * build is `export default {}`.
 *
 * ## Failure is non-fatal, by design
 *
 * Every method resolves even when the write failed. This store holds a cache and some flags; a
 * device with a full disk should render a spinner and refetch, not fail to start. `secureStore`
 * makes the opposite choice on native for the same reason — there, a silent failure would be an
 * unexplained sign-out, and the caller needs to know.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { logger } from '@/core/observability';

import type { KeyValueStore } from './key-value-store';

/** Once per session. A device that cannot write will fail on every cache flush otherwise. */
let hasLoggedFailure = false;

function onFailure(operation: string, key: string, error: unknown): void {
  if (hasLoggedFailure) return;
  hasLoggedFailure = true;

  // Key names only. `STORAGE_KEYS` values are identifiers, and the stored value is deliberately not
  // logged — the query cache would be the whole dehydrated payload.
  logger.warn('App storage unavailable; cached data will not survive a restart', {
    operation,
    key,
    reason: error instanceof Error ? error.message : String(error),
  });
}

export const appStore: KeyValueStore = {
  async getItem(key) {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      onFailure('getItem', key, error);
      return null;
    }
  },

  async setItem(key, value) {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      onFailure('setItem', key, error);
    }
  },

  async removeItem(key) {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      onFailure('removeItem', key, error);
    }
  },
};
