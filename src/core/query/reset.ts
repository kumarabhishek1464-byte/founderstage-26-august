/**
 * Sign-out, from the cache's point of view.
 *
 * [ADR-0006](../../../docs/adr/0006-tanstack-query-and-cache-tiers.md) §"Persistence is a whitelist"
 * names the failure this file prevents: *"On sign-out: `queryClient.clear()` **and** a persister
 * purge. Without both, the next account on a shared device can read the previous user's cache — a
 * real vulnerability that ships in most scaffolds."*
 *
 * Both, because they are two different copies. `clear()` empties the in-memory cache; the persisted
 * blob on disk is a separate artefact written by a throttled background flush, and it survives a
 * `clear()` untouched — so an app that only cleared memory would rehydrate the previous user's data
 * on its next launch, from a file, with no request to notice.
 *
 * ## Why the query keys do not save us
 *
 * Every user-scoped key carries the user id (ADR-0006 §"Query keys come from a per-feature
 * factory"), so user B genuinely cannot *read* a cache entry keyed for user A: the key does not
 * match. That is isolation against a lookup, and it is worth having. It is not deletion. A's data is
 * still resident, still in a dehydrated file on disk, and still reachable by anything that walks the
 * cache rather than querying it — a devtools panel, a debug screen, a future "clear cache" feature
 * that iterates entries. Sign-out means gone.
 *
 * ## Why the session key is removed here
 *
 * `supabase-js` clears its own session on `signOut()` — when the call reaches the server. A sign-out
 * while offline, or one that fails with a network error, leaves the stored session behind, and the
 * next launch rehydrates a session the user believes they ended. Removing
 * {@link STORAGE_KEYS.session} by name makes the local sign-out unconditional. It is removed by
 * name, not by clearing the store, because `secureStore` deliberately has no `clear()` — see the
 * port's docblock.
 *
 * ## Order is deliberate
 *
 * Credentials first, cache second. If the process is killed midway — a background sign-out on iOS,
 * a browser tab closed — the survivable half is "no session, some cached public data", which the
 * next launch treats as a signed-out cold start. The reverse order leaves "no cache, a live
 * session", which is a signed-in app for a user who asked to leave.
 */
import { logger } from '@/core/observability';
import { secureStore, STORAGE_KEYS } from '@/core/storage';

import { queryClient } from './client';
import { purgePersistedCache } from './persister';

/**
 * Discard every trace of the signed-in user held by this layer.
 *
 * Total by design: no step can prevent the others from running, and the function never rejects.
 * A sign-out that threw partway would leave the app in the state this function exists to prevent,
 * and — worse — the caller's `catch` would most likely surface an error dialog while the user is
 * already gone from the screen. Each failure is logged and the sweep continues.
 *
 * Not called directly by a screen. `src/core/auth/` calls it after `client.auth.signOut()`, so that
 * "sign out" is one operation with one entry point rather than a checklist a screen can get half
 * right.
 */
export async function resetClientState(): Promise<void> {
  await removeSession();

  // Synchronous, and does not throw — but it must run before the purge either way: `clear()` also
  // stops the throttled persister flush from writing the cache back out after it has been purged.
  queryClient.clear();

  await purge();
}

async function removeSession(): Promise<void> {
  try {
    await secureStore.removeItem(STORAGE_KEYS.session);
  } catch (error) {
    // The one failure here that is genuinely dangerous — a session left on disk — and the reason
    // this is `error` rather than `warn`. It is also `reportable`: a keychain that refuses a delete
    // is a defect, not a user situation.
    logger.error('Failed to remove the stored session on sign-out', error, {
      operation: 'reset.session',
    });
  }
}

async function purge(): Promise<void> {
  try {
    await purgePersistedCache();
  } catch (error) {
    // `appStore` swallows its own write failures, so reaching this means the persister itself threw.
    // The cache holds only `static` and `reference` data — enums, tags, countries — so a stale file
    // is a correctness annoyance rather than a disclosure, which is why this is a warning.
    logger.warn('Failed to purge the persisted query cache on sign-out', {
      operation: 'reset.cache',
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}
