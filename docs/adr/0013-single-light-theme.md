# ADR-0013 — One light theme now, delivered through the machinery dark mode would need

- **Status:** Accepted
- **Date:** 2026-08-24

## Context

The design language is explicit: pure white `#FFFFFF` dominant, red `#E53935` as a signal rather
than a surface, and **dark mode is not part of the initial identity**. It is equally explicit that
if dark mode arrives later it must come through a centralized theme rather than a scattering of
conditionals.

These two statements pull in opposite directions if taken naively. "One theme" invites hardcoding
`#FFFFFF` into components, which is exactly the state from which adding dark mode becomes a
month-long rewrite. "Prepare for dark mode" invites building a theme switcher, palette inversion and
a persisted preference for a feature that has been explicitly declined.

There is a third failure mode worth naming, because it is the most common: shipping a `dark` palette
"just in case", untested and unreviewed by design. It rots, and it lies — the type system claims two
themes work when only one has ever been rendered.

## Decision

**Exactly one theme object exists.** No `dark` palette is authored. But every component consumes it
through the indirection dark mode would require.

### 1. Components read from a hook, never from the token module

```ts
// ✅ the only sanctioned form
const styles = useStyles(createStyles);
const { colors } = useTheme();

// ❌ lint error — bypasses the seam
import { colors } from '@/core/design-system/tokens';
```

`useTheme()` returns the active theme from context. Today the provider always supplies `lightTheme`.
Adding dark mode means authoring a second object and letting the provider choose — **no component
changes.** That is the whole point, and it costs nothing now.

### 2. Semantic names, not literal ones

```ts
// ✅ survives a palette change
colors.surface.primary; // #FFFFFF
colors.text.secondary; // #666666
colors.border.subtle; // #EAEAEA
colors.action.primary; // #E53935

// ❌ meaningless in a dark palette
colors.white;
colors.grey666;
```

A token named `white` cannot be re-pointed. A token named `surface.primary` can. This is the
difference between a rename and a redesign.

### 3. The `Theme` type is derived from the light theme

```ts
export type Theme = typeof lightTheme;
```

So a future `darkTheme` is structurally forced to be complete — a missing key is a compile error,
not a transparent view at runtime. The type system does the audit.

### 4. Hardcoded design values are a lint error

`no-restricted-syntax` rejects hex literals and raw numeric `padding`/`margin`/`borderRadius`/
`fontSize` in `StyleSheet` calls. This is the rule that actually keeps the seam intact; the rest is
convention, and convention leaks.

### 5. `userInterfaceStyle: 'light'`

Set in `app.config.ts`, so the OS does not hand us dark system chrome, dark keyboards or an inverted
status bar over a white app. Without this, "no dark mode" still looks broken for users whose device
is in dark mode — the one way a declined feature can still produce bug reports.

## Consequences

- Design and review effort goes into one palette that is actually shipped, matching the stated
  identity.
- Dark mode later is: author `darkTheme` (type-checked for completeness), teach the provider to
  select, add a persisted preference. Bounded and mechanical.
- No untested second palette pretending to work.
- Cost: `useTheme()` is marginally more ceremony than importing tokens. It is also what makes the
  above true, and it is one line.
- **`prefers-color-scheme` is not honoured on web** while `userInterfaceStyle` is `light`.
  Consistent with native, and intentional.

## Alternatives considered

- **Hardcode colours; refactor if dark mode is ever wanted.** Cheapest today, and it converts a
  future two-day change into a whole-codebase sweep touching every component. The `useTheme()`
  indirection is roughly free; declining it is not a real saving.
- **Ship `lightTheme` and `darkTheme` now.** Doubles design surface for a declined feature and
  produces the untested-palette rot described above.
- **Automatic palette inversion.** Produces washed-out greys and destroys the red-as-signal
  discipline, which depends on specific contrast against near-white. Dark mode, if it comes, is a
  design exercise and not an algorithm.
