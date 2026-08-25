/**
 * The server-state layer's public surface.
 *
 * ```ts
 * import { cachePolicy, createRepositoryQuery, encodeCursor, queryClient } from '@/core/query';
 * ```
 *
 * A feature imports from here, never from the files behind it. That is what makes the boundary
 * enforceable: the barrel exports `cachePolicy` but not `TIER_DEFINITIONS`, so there is no reachable
 * way to read a tier's `staleTime` and pass it to a query directly — which is the shortcut
 * [ADR-0006](../../../docs/adr/0006-tanstack-query-and-cache-tiers.md) exists to prevent. Likewise
 * `persistOptions` is exported and the whitelist behind it is not configurable from outside.
 *
 * `queryClient` is exported for the two callers that need the imperative handle — the provider that
 * mounts it, and `src/core/auth/` on sign-out. A feature that reaches for it to invalidate something
 * should be using `useQueryClient()` instead, which is the same object with the render lifecycle
 * attached.
 */
export { CACHE_TIER_META_KEY, CACHE_TIERS, cachePolicy, isPersistableTier } from './cache-policy';
export { createQueryClient, queryClient, retryDelay, shouldRetry } from './client';
export { decodeCursor, encodeCursor } from './cursor';
export {
  persistOptions,
  purgePersistedCache,
  queryPersister,
  shouldDehydrateQuery,
} from './persister';
export { createRepositoryQuery } from './repository-query';
export { resetClientState } from './reset';

export type { CachePolicy, CacheTier } from './cache-policy';
export type { Cursor } from './cursor';
