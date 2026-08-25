/**
 * Cache persistence, as a whitelist.
 *
 * [ADR-0006](../../../docs/adr/0006-tanstack-query-and-cache-tiers.md) §"Persistence is a whitelist"
 * is the whole design: **only** the `static` and `reference` tiers reach the disk, because those are
 * the two whose data is identical for every user. Everything else — a profile, a list, a feed, a
 * notification, a payment — stays in memory, and therefore cannot outlive the sign-out that was
 * supposed to remove it.
 *
 * The direction matters more than the rule. A denylist ("persist everything except sensitive
 * things") is wrong the moment someone adds a tier and forgets to list it, and the failure is
 * silent: private data on disk, discovered by an auditor rather than by a test. With a whitelist the
 * same mistake costs a refetch.
 *
 * ## Why the tier is read from `meta` and not from the key
 *
 * At dehydration time all that exists is the `Query` — its key, its state, and its `meta`. The tier
 * cannot be recovered from `staleTime`, because two tiers could share one, and it must not be
 * guessed from the key prefix, because a prefix is a convention and conventions drift.
 * `cachePolicy()` stamps the tier into `meta`; this file reads it back. An unstamped query — one
 * that forgot to pick a tier, or one some other code created — is not persistable, which is the
 * fail-safe answer.
 *
 * ## Paused mutations are never persisted
 *
 * TanStack's `dehydrate` includes paused mutations by default, so that a write queued while offline
 * survives a restart and replays on reconnect. That is a good feature and a bad fit here: the
 * replay happens after the app relaunches, which may be after a *different* account signed in, and
 * the mutation carries the first user's variables with the second user's JWT. Server-side
 * authorisation would reject most of that, but "most" is not the standard for a write. So
 * `shouldDehydrateMutation` returns `false`, and an offline write is lost on a cold start rather
 * than replayed into the wrong session.
 */
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

import { appStore, STORAGE_KEYS } from '@/core/storage';

import { CACHE_TIER_META_KEY, isPersistableTier } from './cache-policy';

import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import type { Query } from '@tanstack/react-query';

/**
 * Bumped when the shape of anything persistable changes — a mapper's output, a query key factory,
 * the tier of an existing query. A mismatch discards the whole stored blob rather than hydrating a
 * cache entry whose shape the current code no longer understands, which would surface as a
 * `TypeError` deep inside a component that has no idea it is rendering last week's data model.
 */
const CACHE_BUSTER = 'v1';

/**
 * The oldest a persisted cache may be, matched to `static`'s `gcTime` — the longest-lived tier, so
 * a shorter value here would silently override the table in `cache-policy.ts`.
 *
 * Per-entry staleness is unaffected: `dehydrate` stores each query's `dataUpdatedAt`, so a
 * `reference` entry restored after two days is still stale against its own one-hour `staleTime` and
 * refetches on mount. `maxAge` is the outer bound on the *file*, not on the entries in it.
 */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000;

/**
 * Writes are throttled, which is the reason this is a persister and not a `useEffect`. A cache
 * mutation can happen several times per frame while a list hydrates, and `AsyncStorage.setItem` of
 * a whole dehydrated cache on each one is a dropped frame per keystroke on the platform where it is
 * a bridge call.
 */
const THROTTLE_MS = 1_000;

/**
 * Whether a query may be written to disk.
 *
 * Exported for its own test. [ADR-0014](../../../docs/adr/0014-testing-strategy.md) asks for the
 * primitives to be tested directly, and asserting a whitelist through a real persister would be a
 * test of `@tanstack/query-async-storage-persister`.
 */
export function shouldDehydrateQuery(query: Query): boolean {
  // A failed or still-fetching query has nothing worth keeping, and persisting an `error` state
  // restores a failure from disk on the next launch — an error the user cannot retry away because
  // it was never a live request.
  if (query.state.status !== 'success') return false;

  // `undefined` data with a `success` status is reachable: a `queryFn` that resolved `undefined`,
  // or a hydrated entry that was never fetched. Round-tripping it through JSON loses the key
  // entirely, so the restored cache would differ from the one that was written.
  if (query.state.data === undefined) return false;

  return isPersistableTier(query.meta?.[CACHE_TIER_META_KEY]);
}

/**
 * The persister itself. `appStore` rather than `secureStore`: this is a cache, and it is written to
 * plain app storage on native precisely so that no code path which purges it can reach the
 * keychain.
 */
export const queryPersister = createAsyncStoragePersister({
  storage: appStore,
  key: STORAGE_KEYS.queryCache,
  throttleTime: THROTTLE_MS,
});

/**
 * Spread into `PersistQueryClientProvider`. Assembled here so the provider in `src/app/` composes
 * rather than configures — a `dehydrateOptions` written at the mount site is a whitelist a reviewer
 * has to find.
 *
 * `queryClient` is omitted because `PersistQueryClientProvider` supplies it from the client it wraps.
 */
export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister: queryPersister,
  maxAge: MAX_AGE_MS,
  buster: CACHE_BUSTER,
  dehydrateOptions: {
    shouldDehydrateQuery,
    shouldDehydrateMutation: () => false,
  },
};

/**
 * Remove the persisted cache from disk.
 *
 * Called by `reset.ts` on sign-out, alongside `queryClient.clear()`. Both, always: clearing memory
 * leaves the file, and removing the file leaves the memory — and the next account on a shared
 * device would read whichever half survived.
 */
export async function purgePersistedCache(): Promise<void> {
  await queryPersister.removeClient();
}
