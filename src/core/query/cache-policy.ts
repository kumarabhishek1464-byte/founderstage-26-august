/**
 * [ADR-0006](../../../docs/adr/0006-tanstack-query-and-cache-tiers.md)'s table, as code.
 *
 * A feature **picks** a tier. It cannot invent one, and it cannot pass `staleTime` directly
 * — the whole point of the ADR is that cache behaviour is reviewable as a table rather than
 * scattered across call sites, and a `staleTime: 30_000` in a hook is exactly that scatter.
 *
 * ## Why the tier travels in `meta`
 *
 * The persister has to decide, per query, whether a cache entry may touch the disk. At
 * dehydration time all it holds is the `Query` object — the key, the state, and `meta`. It
 * cannot re-derive the tier from `staleTime`, because two tiers could legitimately share
 * one, and it must not guess from the key, because a key prefix is a naming convention and
 * conventions drift. Stamping the tier into `meta` makes the whitelist in `persister.ts` a
 * lookup rather than an inference, and an unstamped query is treated as not persistable.
 *
 * That is the fail-safe direction: forgetting to declare a tier means the data stays in
 * memory, not that private data lands on disk.
 */

/**
 * A tuple, so the union and the runtime list cannot drift.
 *
 * Order is meaningful only for reading: longest-lived first, shortest-lived last.
 */
export const CACHE_TIERS = [
  'static',
  'reference',
  'profile',
  'list',
  'feed',
  'volatile',
  'sensitive',
] as const;

export type CacheTier = (typeof CACHE_TIERS)[number];

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

interface TierDefinition {
  readonly staleTime: number;
  readonly gcTime: number;
  /**
   * Whether entries in this tier may be written to disk by the persister.
   *
   * Only `static` and `reference` — data that is identical for every user. Anything
   * user-specific stays in memory, because a persisted cache outlives a sign-out on a
   * shared device unless the purge is perfect, and "unless the purge is perfect" is not a
   * security posture. ADR-0006 §"Persistence is a whitelist".
   */
  readonly persist: boolean;
}

const TIER_DEFINITIONS: Readonly<Record<CacheTier, TierDefinition>> = {
  /** Enums, categories, countries. Changes with a deploy, not with a user action. */
  static: { staleTime: 24 * HOUR, gcTime: 7 * DAY, persist: true },
  /** Tags, industries, flag definitions. Editable upstream, but rarely. */
  reference: { staleTime: HOUR, gcTime: 24 * HOUR, persist: true },
  /** Founder / company profiles. Someone else's, so a few minutes stale is invisible. */
  profile: { staleTime: 5 * MINUTE, gcTime: 30 * MINUTE, persist: false },
  /** Directories, search results, the conversation list. */
  list: { staleTime: 60 * SECOND, gcTime: 10 * MINUTE, persist: false },
  /**
   * Timelines — and message pages.
   *
   * A message page is `feed` rather than `volatile` deliberately: realtime patches the
   * cache directly, so a short `staleTime` would produce refetches that can only return
   * what the socket already delivered. The 5-minute `gcTime` is what lets a user leave a
   * conversation and come back to a rendered thread instead of a skeleton.
   */
  feed: { staleTime: 30 * SECOND, gcTime: 5 * MINUTE, persist: false },
  /** Notifications, unread counts, presence-derived counters. Always refetch on mount. */
  volatile: { staleTime: 0, gcTime: 60 * SECOND, persist: false },
  /**
   * Payments, private data, anything whose presence in memory after navigation is itself
   * the problem. `gcTime: 0` discards the entry as soon as the last observer unmounts.
   */
  sensitive: { staleTime: 0, gcTime: 0, persist: false },
};

/**
 * The `meta` key the persister reads. A named constant because it is written here and read
 * in `persister.ts`, and a string literal in two files is a typo waiting to silently
 * disable the whitelist.
 */
export const CACHE_TIER_META_KEY = 'cacheTier';

/**
 * Spread into a query's options. `useQuery({ queryKey, queryFn, ...cachePolicy('feed') })`.
 *
 * The return type is deliberately structural rather than TanStack's `UseQueryOptions`: this
 * module owns three fields and should not become a place where a `retry` or a `select` could
 * be smuggled in per call site.
 */
export interface CachePolicy {
  readonly staleTime: number;
  readonly gcTime: number;
  readonly meta: Readonly<Record<string, unknown>>;
}

export function cachePolicy(tier: CacheTier): CachePolicy {
  const definition = TIER_DEFINITIONS[tier];

  return {
    staleTime: definition.staleTime,
    gcTime: definition.gcTime,
    meta: { [CACHE_TIER_META_KEY]: tier },
  };
}

/**
 * Whether a tier may be written to disk.
 *
 * Takes the raw `meta` value rather than a `CacheTier`, because the persister's input is
 * `unknown` — a query may carry no meta at all, or a meta some other code wrote. Anything
 * that is not a recognised, persistable tier is `false`.
 */
export function isPersistableTier(value: unknown): boolean {
  if (typeof value !== 'string') return false;

  // `Array.prototype.includes` on a `readonly` tuple rejects a `string` argument, so the
  // membership test goes through the record — which is also the thing being consulted.
  if (!Object.hasOwn(TIER_DEFINITIONS, value)) return false;

  return TIER_DEFINITIONS[value as CacheTier].persist;
}
