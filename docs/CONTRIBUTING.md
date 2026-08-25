# Contributing

These rules are not style preferences. They are what keeps the codebase composable as it grows. Most
of them are enforced mechanically — if you fight the linter here, the linter is probably right.

---

## 1. The one rule that matters most

**Before creating anything, search for it first.**

```bash
# Does a component like this already exist?
grep -ri "button" src/core/design-system --include=*.tsx -l

# Does a hook like this already exist?
ls src/core/hooks src/features/*/hooks
```

Then choose, in this order:

1. **Reuse** the existing abstraction.
2. **Extend** it (add a variant, a prop, a generic parameter).
3. **Create** something new — only if it is genuinely different functionality.

Never create `ButtonV2`, `CustomButton`, `NewButton`, `SpecialButton`, `FeatureButton`. If `Button`
does not do what you need, **change `Button`**.

---

## 2. Where does my code go?

```
Is it UI with no domain knowledge?              → src/core/design-system/
Is it a cross-cutting capability?               → src/core/<capability>/
Is it specific to one domain?                   → src/features/<domain>/
Is it a route/screen?                           → src/app/
Is it SQL, an RLS policy, or an Edge Function?  → supabase/
```

If you cannot decide between `core/` and `features/`, ask: _would a completely different product
need this?_ If yes, it belongs in `core/`.

---

## 3. Dependency direction (enforced)

```
app  →  features  →  core  →  platform
```

- `core/**` **may not** import `features/**` or `app/**`. A generic `Button` must never know that
  funding, events or founders exist.
- `features/a` **may not** reach into `features/b/**` internals. Import from `features/b` (its
  `index.ts`) only.
- Nothing may import from `supabase/`. That is server-side code.

Violations fail `npm run lint` and `npm run arch:check`.

---

## 4. Screens stay thin

A screen composes. It does not implement.

**A screen must never contain:** a Supabase query, retry logic, caching, rate limiting, auth checks
beyond a guard component, data normalisation, or duplicated validation.

```tsx
// ✅ Good — the screen is a composition
export default function FounderDirectoryScreen() {
  const { data, isLoading, error } = useFounderList(filters);

  if (isLoading) return <FounderListSkeleton />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  return <FounderList data={data} />;
}
```

```tsx
// ❌ Bad — the screen has become a mini-application
export default function FounderDirectoryScreen() {
  const [data, setData] = useState([]);
  useEffect(() => {
    supabase.from('founders').select('*').then(/* ... */); // three rules broken at once
  }, []);
}
```

---

## 5. Adding a dependency

**Always use `npx expo install`. Never `npm install` for runtime packages.**

```bash
npx expo install some-package    # ✅ resolves against the Expo SDK 57 matrix
npm install some-package         # ❌ resolves to `latest`, which may break the native build
```

This is not pedantry. At the time of writing, `npm install typescript` would install v7, which
`typescript-eslint` does not support — lint would stop working entirely. Four other core packages
have the same trap. See [ADR-0002](adr/0002-expo-sdk-and-dependency-policy.md).

Before adding anything, answer all seven:

1. Is it actively maintained?
2. Is it compatible with the current Expo SDK?
3. Does it work on Android?
4. Does it work on iOS?
5. Does it work on web (or can it degrade cleanly)?
6. Does it solve a real architectural problem?
7. Could an existing dependency or abstraction already solve it?

If any answer is unsatisfying, don't add it. Then run `npm run doctor`.

---

## 6. Design system usage

Feature code may not import UI primitives from `react-native`:

```tsx
import { Text } from 'react-native'; // ❌ lint error
import { Text } from '@/core/design-system'; // ✅
```

Feature code may not hardcode design values:

```tsx
<View style={{ padding: 17, borderRadius: 13, backgroundColor: '#123456' }} /> // ❌
```

```tsx
const s = useStyles(); // createStyles((t) => ({ card: { padding: t.space.lg } }))
<View style={s.card} />; // ✅
```

If a token you need doesn't exist, **add it to the token set** — don't inline a value.

---

## 7. Data access

Every server read/write goes through a repository:

```
Screen → useFeatureQuery() → key factory → repository → supabase-js
```

The Supabase client may only be imported by:

- `src/core/database/**`
- `src/features/*/api/repository.ts`

Repositories return **domain models**, never raw database `Row` types. A schema change must not
ripple into the UI. See [API.md](API.md).

---

## 8. Types

- `strict` is on, plus `noUncheckedIndexedAccess`.
- **No `any`.** Use `unknown` and narrow explicitly. If `any` is truly unavoidable, it needs a
  `// eslint-disable-next-line` with a written reason.
- No unsafe assertions (`as Foo`) to silence the compiler. Narrow or parse instead.
- Database types are **generated**, never hand-written: `npm run db:types`.
- Use `import type { … }` for type-only imports (auto-fixable).

---

## 9. Comments

Do not comment _what_ the code does. Comment _why_, and only when it isn't obvious.

```ts
setLoading(true); // Set loading to true      ❌ noise
```

```ts
// SecureStore rejects values over 2048 bytes on Android, and a Supabase session with
// custom claims regularly exceeds that — so the value is chunked across indexed keys.
await writeChunked(key, value); // ✅ explains a non-obvious constraint
```

Use JSDoc on exported abstractions in `core/`. Skip it on obvious internals.

---

## 10. Security expectations

- Never log a password, token, OTP, or secret. The logger redacts known keys, but don't rely on it —
  don't pass them in.
- Never put a secret in a `EXPO_PUBLIC_*` variable. Everything with that prefix ships to the client
  bundle and is world-readable.
- `process.env` may only be read in `src/core/config/env.ts`.
- **Client-side permission checks are UX, not security.** Every rule must also exist as an RLS
  policy or a server-side check. See [SECURITY.md](SECURITY.md).
- New table? It needs RLS policies **and** pgTAP tests proving a non-owner is denied.

---

## 11. Before you push

```bash
npm run verify
```

This runs typecheck, lint, format check, architecture check, and tests. CI runs the same thing plus
`expo-doctor` and the database tests, so failing locally means failing CI.

For database changes also run:

```bash
npm run db:reset && npm run db:test
```

---

## 12. Migrations

- **Forward-only.** Never edit a migration that has been applied anywhere but your own machine.
- One logical change per migration, numbered sequentially.
- Every migration that creates a table must also create its RLS policies and its indexes.
- Regenerate types afterwards: `npm run db:types`, and commit the result.

---

## 13. Commit hygiene

- Present tense, imperative: `add cursor pagination helper`.
- One logical change per commit.
- Don't commit `.env.local`, generated native folders (`ios/`, `android/`), or `node_modules/`.
