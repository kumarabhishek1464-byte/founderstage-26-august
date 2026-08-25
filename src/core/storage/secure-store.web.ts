/**
 * `secureStore` on web: `localStorage`.
 *
 * ## The name overpromises here, and that is worth stating plainly
 *
 * A browser has no keychain. Every client-side storage a web page can reach — `localStorage`,
 * `sessionStorage`, IndexedDB, a non-`httpOnly` cookie — is readable by any script running on the
 * origin, so under XSS they are all equivalent. There is no "more secure" option to pick; there is
 * only the choice of which one, and what compensates for it.
 *
 * `localStorage` is the choice because it is what `supabase-js` uses by default on web and because
 * the alternatives trade a real feature for no security gain: `sessionStorage` signs the user out
 * whenever they close the tab, and an in-memory store signs them out on every reload.
 *
 * What actually protects the session on web is elsewhere and belongs named here so nobody mistakes
 * this file for the control: a Content-Security-Policy that keeps injected script from running at
 * all, short-lived access tokens, refresh-token rotation with reuse detection (Supabase's default),
 * and server-side revocation. The threat model is "an attacker who can run script on our origin has
 * the session", and the answer is to keep them from running script.
 *
 * ## No chunking
 *
 * `localStorage`'s quota is per origin (~5 MB), not per value, so the constraint the native path
 * exists to work around does not apply. Running the chunker anyway would work, but it would write a
 * manifest and N keys for a value that fits in one — and, worse, it would make the on-disk format
 * platform-dependent for no reason, so a session written by one and read by the other would need a
 * migration that has no business existing.
 *
 * ## Why every access is guarded
 *
 * `localStorage` is not always there. `expo export` renders `src/app/+html.tsx` in Node, where the
 * global does not exist, so a module-scope reference would break the web build rather than the web
 * app. And Safari with cookies blocked throws `SecurityError` on *access to the property itself*,
 * not on the call — which is why the guard is a `try`/`catch` around the whole operation and not a
 * `typeof window` check, which would pass and then throw one line later.
 *
 * A write that fails is swallowed and logged; a read that fails returns `null`. That is the same
 * fail-closed rule the native chunker follows: an unreadable session presents as "signed out",
 * which is correct and recoverable, rather than as an opaque auth error.
 */
import { logger } from '@/core/observability';

import type { KeyValueStore } from './key-value-store';

/**
 * `null` rather than a throw when storage is unreachable.
 *
 * Returns the object rather than a boolean so the caller cannot check availability and *then* touch
 * the global — in Safari the second access throws just as readily as the first.
 */
function storage(): Storage | null {
  try {
    // Reading `.localStorage` is itself the throwing operation when the browser has storage
    // disabled, so it has to happen inside the `try`.
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

/** Once per session, not once per operation — a disabled-storage browser touches this on every write. */
let hasLoggedUnavailable = false;

function onUnavailable(operation: string, key: string, error?: unknown): void {
  if (hasLoggedUnavailable) return;
  hasLoggedUnavailable = true;

  // `warn`, not `error`: the app still works, the user is just signed out on every reload. The key
  // is safe to log — `STORAGE_KEYS` holds names, never values, and the value is deliberately absent
  // from this call because for `fs.auth.session` it would be the session itself.
  logger.warn('Web storage unavailable; values will not persist across reloads', {
    operation,
    key,
    reason: error instanceof Error ? error.message : undefined,
  });
}

export const secureStore: KeyValueStore = {
  getItem(key) {
    const store = storage();
    if (store === null) {
      onUnavailable('getItem', key);
      return Promise.resolve(null);
    }

    try {
      return Promise.resolve(store.getItem(key));
    } catch (error) {
      onUnavailable('getItem', key, error);
      return Promise.resolve(null);
    }
  },

  setItem(key, value) {
    const store = storage();
    if (store === null) {
      onUnavailable('setItem', key);
      return Promise.resolve();
    }

    try {
      store.setItem(key, value);
    } catch (error) {
      // `QuotaExceededError` lands here. Resolving rather than rejecting is deliberate: the caller
      // is `supabase-js` persisting a session it has already accepted in memory, and a rejection
      // would turn a successful sign-in into a failed one.
      onUnavailable('setItem', key, error);
    }
    return Promise.resolve();
  },

  removeItem(key) {
    const store = storage();
    if (store === null) return Promise.resolve();

    try {
      store.removeItem(key);
    } catch (error) {
      onUnavailable('removeItem', key, error);
    }
    return Promise.resolve();
  },
};
