/**
 * The Supabase client, constructed once.
 *
 * Importable from `src/core/database/**` and a feature's `api/repository.ts`, and nowhere else —
 * `supabase-client-is-confined` in `.dependency-cruiser.cjs` and `no-restricted-imports` in
 * `eslint.config.js` both fail the build otherwise. That confinement is the backend portability
 * seam ([ADR-0011](../../../docs/adr/0011-repository-pattern.md)): a screen that cannot reach this
 * object cannot embed a query shape in a component tree.
 *
 * ## One instance, module scope
 *
 * `createClient` starts an auth state machine with a refresh timer, and lazily owns a realtime
 * socket. A second instance means two timers racing to refresh the same refresh token — and a
 * refresh token is single-use, so the loser gets `refresh_token_already_used` and the user is
 * signed out for no reason. There is no factory export, because a factory is an invitation.
 *
 * ## What is deliberate here
 *
 * | Option                    | Why                                                             |
 * | ------------------------- | --------------------------------------------------------------- |
 * | `storage: secureStore`    | keychain on native, chunked past Android's 2048-byte cap        |
 * | `storageKey`              | a literal, so sign-out can remove it by name (ADR-0010)         |
 * | `flowType: 'pkce'`        | the only flow that is safe without a client secret              |
 * | `detectSessionInUrl`      | web only — there is no URL fragment to read on native            |
 * | `db.schema: 'public'`     | matches the one schema `schema.ts` types                         |
 *
 * Everything else is left at its default on purpose. `autoRefreshToken` and `persistSession` are
 * already `true`, and restating a default reads as a decision that was made when it was not.
 */
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';

import { env } from '@/core/config/env';
import { STORAGE_KEYS, secureStore } from '@/core/storage';

import type { Database } from './schema';

export const supabase = createClient<Database>(
  env.EXPO_PUBLIC_SUPABASE_URL,
  env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      /**
       * Without this, `supabase-js` falls back to `localStorage` on web and to an in-memory map on
       * native — so on native the session would not survive a cold start, and the app would present
       * a sign-in screen to a signed-in user on every launch.
       */
      storage: secureStore,

      /**
       * Named rather than derived from the project ref. `reset.ts` removes this key on sign-out,
       * and it can only do that if the name is a constant both files can see.
       */
      storageKey: STORAGE_KEYS.session,

      /**
       * PKCE, not implicit. The implicit flow returns tokens in a URL fragment, which on native
       * means the access token travels through an OS-level deep link that any app registering the
       * same scheme can observe. PKCE returns a single-use code instead, and the verifier that
       * redeems it never leaves `secureStore`.
       */
      flowType: 'pkce',

      /**
       * Web only. On web the OAuth redirect lands the code in the URL and the SDK must read it, or
       * sign-in returns to a signed-out screen. On native the redirect arrives as a deep link that
       * `src/core/navigation/` owns, and leaving this on would give the SDK a second, unaudited
       * path for turning a link into a session.
       */
      detectSessionInUrl: Platform.OS === 'web',
    },

    /**
     * All application tables live in `public`, and `schema.ts` types exactly that schema. The two
     * have to agree: a different name here would type every query against columns PostgREST is not
     * being asked for.
     */
    db: { schema: 'public' },
  }
);
