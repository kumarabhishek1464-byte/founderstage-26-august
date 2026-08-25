# FounderStage — working rules

Premium founder ecosystem platform. One codebase → Android, iOS, Expo Web. Supabase backend.

**Phase: foundation.** No product features are built yet — no feed, funding, events, jobs,
marketplace, profiles, incubators, tools or notifications. The only feature-shaped code permitted is
a minimal `account` slice used as an architectural test fixture. See [docs/adr/](docs/adr/) for
every decision and its reasoning.

---

## The three rules

### 1. Reuse before creating

Before adding a component, hook or utility, search for it:

```bash
grep -ri "button" src/core/design-system/components --include=*.tsx -l
```

If something close exists, **extend it with a prop or a variant**. Never create `ButtonV2`,
`CustomButton`, `NewButton`, `ButtonNew`, `EnhancedButton`. If two things genuinely differ, the
difference belongs in the type:

```ts
type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive';
```

### 2. Feature code stays thin

A screen composes and delegates. It must contain **no** raw Supabase query, cache handling, retry
logic, validation schema evaluation, or error-to-message mapping.

```tsx
// ✅
export default function AccountScreen() {
  const { data, isPending, error } = useAccount();
  if (isPending) return <AccountSkeleton />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  return <AccountView account={data} />;
}
```

```tsx
// ❌ every one of these is a lint error or a review rejection
const { data } = await supabase.from('profiles').select('*');
if (err.code === '23505') setMessage('Already exists');
setTimeout(() => retry(), 1000);
```

### 3. Cross-cutting concerns are centralized

Auth, authorization, errors, logging, analytics, network state, caching, storage, rate-limit
handling, feature flags, haptics, theming. Each has exactly one home in `src/core/`. If you are
writing a second implementation of one of these, stop.

---

## Dependency direction

```
src/app  →  src/features  →  src/core  →  (platform / Supabase)
```

- `src/core` **must never import from `src/features` or `src/app`.** Enforced by
  `eslint-plugin-boundaries` and `dependency-cruiser`.
- Features must not import from each other. Shared code moves to `core`.
- There is no `src/services/` and no root `src/types/` — see
  [ADR-0003](docs/adr/0003-single-core-tree.md).

Run `npm run arch:check` to verify.

---

## Hard boundaries (these fail the build)

| Rule                                                                                                   | Why                                                                            |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Supabase client importable **only** from `src/core/database/**` and `src/features/*/api/repository.ts` | [ADR-0011](docs/adr/0011-repository-pattern.md) — the backend portability seam |
| No `View`/`Text`/`Pressable`/`TouchableOpacity`/`StyleSheet` imported from `react-native` in features  | Design-system components only                                                  |
| No hex literals or raw spacing/radius/fontSize numbers in styles                                       | [ADR-0013](docs/adr/0013-single-light-theme.md) — tokens must be re-pointable  |
| No `any`. Use `unknown` + narrowing                                                                    | [ADR-0004](docs/adr/0004-typescript-strictness.md)                             |
| `process.env` readable **only** in `src/core/config/env.ts`                                            | Validated once, at startup                                                     |
| No `select('*')` in repositories                                                                       | Payload size, index-only scans                                                 |
| `npx expo install` — never `npm install` for runtime deps                                              | [ADR-0002](docs/adr/0002-expo-sdk-and-dependency-policy.md)                    |

---

## Security invariants

- `service_role` key, Redis credentials and admin secrets **never** reach the client. Only
  `EXPO_PUBLIC_*` values do, and everything with that prefix is public by definition.
- **Never log** passwords, access tokens, refresh tokens, OTP codes, or payment secrets. `console.*`
  is a lint error outside `src/core/observability/**`, so every log passes through the redactor —
  [ADR-0016](docs/adr/0016-logging-and-redaction.md). Do not defeat it.
- Every user-accessible sensitive table has RLS. **Frontend restrictions are not security.**
- Rate limiting is server-side ([ADR-0008](docs/adr/0008-rate-limiting-in-postgres.md)). The client
  only interprets 429.
- `(select auth.uid())` in policies, never bare `auth.uid()` —
  [ADR-0009](docs/adr/0009-roles-in-jwt.md).
- Never expose raw database or server errors to users. Normalise through `AppError` and render
  `userMessage`, never `message` — [ADR-0015](docs/adr/0015-error-model.md).
- Cache keys include the user identity, so a signed-out user cannot read a previous user's cache.
- No unrestricted uploads: validate MIME **and** size, server-side.

---

## Design language

Pure white dominant. Red `#E53935` is a **signal**, never a background — roughly 90% of any screen
is white or neutral. Typography carries the hierarchy. Borders `#EAEAEA`, radius 16 on cards,
shadows almost imperceptible. Spacing from the scale only: `4 8 12 16 20 24 32 40 48 64 80`.

No glassmorphism, no gradients as decoration, no dark mode, no bright multi-colour palettes, no
oversized shadows, no playful illustration. Skeletons rather than spinners on first load.

Full specification: `docs/DESIGN_SYSTEM.md`.

---

## Before pushing

```bash
npm run verify
```

Runs `typecheck` → `lint` → `format` → `arch:check` → `test`. All must pass.

---

## Comments

Comment the **why**, never the what.

```ts
// ✅ SecureStore rejects values >2048 bytes on Android; a Supabase session with
// role claims routinely exceeds it, so values are chunked at 1800 bytes.
const CHUNK_SIZE = 1800;

// ❌
// set chunk size to 1800
const CHUNK_SIZE = 1800;
```

---

## Notes for agents

- Read the relevant ADR before changing an architectural decision. ADRs are immutable — supersede
  with a new one rather than editing.
- Do not add a dependency without answering the seven questions in
  [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md).
- Do not build product features. See the phase note at the top.
- `expo install` mutates `app.json`/`app.config.ts` config plugins. Check the diff after installing.
