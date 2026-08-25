# ADR-0010 — Chunked SecureStore for session persistence; `localStorage` on web

- **Status:** Accepted
- **Date:** 2026-08-24

## Context

Supabase Auth persists the session through a pluggable storage interface (`getItem` / `setItem` /
`removeItem`). On mobile, tokens must go in the OS keystore — Keychain on iOS, Keystore-backed
encrypted preferences on Android — which `expo-secure-store` provides.

Two constraints make the obvious implementation wrong:

1. **`expo-secure-store` rejects values larger than 2048 bytes on Android.** A Supabase session is
   not just tokens — it is a JSON blob containing the access token, the refresh token, and the
   serialised user object including `user_metadata` and `app_metadata`. With the role claims from
   [ADR-0009](0009-roles-in-jwt.md) and any profile metadata, **it routinely exceeds 2048 bytes.**
   The failure mode is the worst kind: it works in development with a bare test user, then fails in
   production for users with richer profiles. The session silently fails to persist and the user is
   logged out on every cold start.
2. **`expo-secure-store` does not exist on web.** There is no browser API with keystore semantics.

Most Supabase + Expo scaffolds wire `SecureStore` directly into `auth.storage` and hit both.

## Decision

A `KeyValueStore` port in `src/core/storage/`, with platform-resolved adapters.

### Native — chunked secure storage

```
key            → manifest: { chunks: 3, bytes: 5120 }
key.__chunk.0  → first 1800 bytes
key.__chunk.1  → next 1800 bytes
key.__chunk.2  → remainder
```

- Chunk size is **1800 bytes**, comfortably under the 2048 limit, since the limit applies to the
  encoded value.
- Writes replace the manifest **last**, so an interrupted write leaves the old session readable
  rather than a half-written one. Reads that find a chunk count mismatch treat the value as absent
  and force re-authentication — failing closed.
- Deletes remove chunks first, then the manifest.
- Single-chunk values skip the manifest entirely, so the common case costs one read.

### Web — `localStorage`

This is Supabase's own web default and there is no better option in a browser:

- `sessionStorage` loses the session on tab close, which is a poor experience and no real security
  gain against the actual threat.
- In-memory only means re-authenticating on every refresh.
- An httpOnly cookie is genuinely stronger, but requires a server-side auth exchange we do not have
  in a static SPA ([ADR-0012](0012-web-spa-output.md)). Revisit if server rendering is adopted.

The XSS exposure is real and is **documented in `docs/SECURITY.md`** rather than glossed over, with
its mitigations: strict Content-Security-Policy from `src/app/+html.tsx`, no raw HTML injection
anywhere, short access-token TTL, refresh-token rotation, and Supabase's reuse detection.

### Two stores, not one

| Store         | Backing                                | For                                                    |
| ------------- | -------------------------------------- | ------------------------------------------------------ |
| `secureStore` | SecureStore (chunked) / `localStorage` | Session, tokens, anything sensitive                    |
| `appStore`    | AsyncStorage / `localStorage`          | Query cache persistence, onboarding flags, preferences |

Keeping them separate means the offline query cache can be cleared without touching credentials, and
the whitelisted cache persistence of [ADR-0006](0006-tanstack-query-and-cache-tiers.md) can never
accidentally write to the secure store.

## Consequences

- Sessions persist correctly on Android regardless of session size. This is a bug avoided, not a
  feature added.
- Multi-chunk sessions cost N+1 reads on cold start. Negligible, and the common case is one read.
- Web keeps a documented, mitigated XSS exposure — the standard trade-off for a browser SPA.
- The chunking adapter is unit tested against the boundary conditions: exactly 1800 bytes, 1801
  bytes, interrupted write, chunk-count mismatch, and a value shrinking from 3 chunks to 1.

## Alternatives considered

- **`SecureStore` directly.** The production bug described above.
- **Store only the refresh token securely, keep the access token in memory.** Sound, and appealing.
  Rejected because it means reimplementing Supabase's session lifecycle rather than using its
  storage interface — more security-critical code that we own, to avoid chunking that is ~60 lines
  and fully testable.
- **Encrypted MMKV with the key held in SecureStore.** Elegant and fast, and the chunking problem
  disappears because only a short key goes into SecureStore. Rejected for now: it adds a native
  dependency (`react-native-mmkv`) with no web implementation, so a web adapter is still needed —
  paying a native dependency without removing the platform split. **Reconsider if storage throughput
  ever shows up in a profile.**
