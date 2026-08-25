/**
 * The `KeyValueStore` port ([ADR-0010](../../../docs/adr/0010-chunked-secure-storage.md)).
 *
 * The method names are not arbitrary: `getItem` / `setItem` / `removeItem` returning promises is
 * exactly the shape `supabase-js` expects for its `auth.storage` option **and** exactly the shape
 * `@tanstack/query-async-storage-persister` expects. Matching both means the session store and the
 * cache persister take a `KeyValueStore` directly, with no adapter object in between — and an
 * adapter object is where a "temporarily use AsyncStorage for the session" shortcut would live.
 *
 * Deliberately **not** on this interface:
 *
 * - **`clear()`.** A store that can wipe itself invites `secureStore.clear()` on sign-out, which
 *   would take the session *and* anything else sensitive that lands here later. Sign-out removes
 *   the keys it owns, by name — see `src/core/query/reset.ts`.
 * - **`getAllKeys()`.** SecureStore cannot enumerate on either platform, so a store that promised it
 *   would have to lie on native. An interface whose implementations diverge in capability is worse
 *   than a narrower one.
 * - **Synchronous variants.** `SecureStore` has `getItemSync`, `localStorage` is synchronous, and
 *   `AsyncStorage` is not. Exposing the fast path where it exists would let a caller depend on it
 *   and then break on the platform where it does not.
 */
export interface KeyValueStore {
  /** `null` for absent. Never throws for a missing key — only for a broken backing store. */
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  /** Idempotent. Removing an absent key is not an error. */
  removeItem(key: string): Promise<void>;
}

/**
 * Keys this codebase owns, in one place.
 *
 * Namespaced with a `fs.` prefix because on web both stores are `localStorage`, which is a single
 * origin-wide namespace shared with anything else served from the same host — including, during
 * development, another Expo app on `localhost`. The prefix is what stops an unrelated key from
 * being read as ours.
 *
 * `session` is the odd one out: its exact value is dictated by `supabase-js`, which derives a
 * storage key from the project ref unless told otherwise. It is set explicitly in
 * `src/core/database/client.ts` so the name is visible here rather than computed at runtime, which
 * is what lets sign-out remove it by name.
 */
export const STORAGE_KEYS = {
  /** The Supabase session. Sensitive: `secureStore` only. */
  session: 'fs.auth.session',
  /** TanStack Query's dehydrated cache. `static` and `reference` tiers only — ADR-0006. */
  queryCache: 'fs.query.cache',
  /**
   * Whether the OS notification-permission prompt has been shown. Persisted because both iOS and
   * the browser permit exactly one prompt: after a denial the request resolves silently, so an app
   * that re-asks produces nothing and a web app that re-asks is penalised by the browser. The flag
   * is what turns "ask again" into "explain and link to Settings".
   */
  pushPromptShown: 'fs.push.prompt-shown',
  /**
   * The stable per-installation device identifier used for push registration. Generated once and
   * persisted, because it must survive a token rotation — the push token identifies a delivery
   * endpoint, not a device, and treating the token as the identity creates a new device row every
   * time it rotates.
   */
  deviceId: 'fs.push.device-id',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
