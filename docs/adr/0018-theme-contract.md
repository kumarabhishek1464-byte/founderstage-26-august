# ADR-0018 — The `Theme` contract is declared, not inferred, and only colour is theme-variable

- **Status:** Accepted
- **Date:** 2026-08-24
- **Supersedes:** [ADR-0013](0013-single-light-theme.md) §3 ("The `Theme` type is derived from the
  light theme")

## Context

[ADR-0013](0013-single-light-theme.md) §3 specifies:

```ts
export type Theme = typeof lightTheme;
```

with the stated reasoning that a future `darkTheme` is then "structurally forced to be complete — a
missing key is a compile error, not a transparent view at runtime."

The intent is right. The mechanism does not work, and this was verified rather than reasoned about.
The token modules are declared `as const` ([ADR-0017](0017-token-schema.md)), so `typeof lightTheme`
carries string **literal** types. A probe assembling a naive theme and then declaring a second
palette against it produced:

```
src/core/design-system/_probe.ts(19,16): error TS2322: Type '"#000000"' is not assignable to type '"#FFFFFF"'.
src/core/design-system/_probe.ts(19,36): error TS2322: Type '"#0A0A0A"' is not assignable to type '"#F8F8F8"'.
src/core/design-system/_probe.ts(19,58): error TS2322: Type '"#141414"' is not assignable to type '"#F5F5F5"'.
src/core/design-system/_probe.ts(19,79): error TS2322: Type '"#FFFFFF"' is not assignable to type '"#111111"'.
```

`typeof lightTheme` does not force a dark theme to be _complete_. It forces it to be _identical_ —
the exact opposite of the goal. The failure would have surfaced on the first day someone tried to
add dark mode, which is the day the type was supposed to be helping.

The obvious repair — widen every leaf with a recursive mapped type — is worse. Widening
`typography.weight.semibold` from `'600'` to `string` makes it unassignable to
`TextStyle['fontWeight']`, so a blanket deep-widen breaks every component that sets a weight. Any
correct widening has to be selective, which means deciding _what varies between themes_.

## Decision

### 1. `Theme` is an explicit interface

Declared in `src/core/design-system/theme/theme.ts`, not inferred from a value.

```ts
export interface Theme {
  readonly colors: ThemeColors;
  readonly spacing: typeof spacing;
  readonly radius: typeof radius;
  readonly border: typeof border;
  readonly opacity: typeof opacity;
  readonly size: typeof size;
  readonly typography: typeof typography;
  readonly shadow: typeof shadow;
  readonly motion: typeof motion;
  readonly breakpoint: typeof breakpoint;
}
```

The completeness guarantee ADR-0013 §3 wanted is preserved: a missing key on a future `darkTheme` is
a compile error. What changes is that the guarantee now comes from a declaration a reader can see,
rather than from an inference that happened to be wrong.

### 2. Only `colors` is theme-variable

This is the substantive decision, and the naive version could not express it.

`spacing`, `radius`, `border`, `opacity`, `size`, `typography`, `shadow`, `motion` and `breakpoint`
reference their token types directly, so they keep their literal types and full autocomplete, and a
second theme **cannot** change them. That is correct rather than merely convenient: a dark mode that
changes the spacing scale or the type ramp is a redesign, not a theme, and it should not be
reachable through the theme seam.

`colors` is widened, two levels deep, matching the palette's actual group→name shape:

```ts
export type ThemeColors = {
  readonly [Group in keyof typeof colors]: {
    readonly [Name in keyof (typeof colors)[Group]]: string;
  };
};
```

Two levels rather than a recursive helper, because the palette is exactly two levels and a recursive
version would reach into `typography.weight` and break `fontWeight` as described above.

`shadow` is deliberately **not** widened even though a dark theme would want different elevation.
Shadows on a dark surface are a different mechanism (a light border or a lifted surface colour, not
a black blur), so the day dark mode arrives that is a new token group, not a re-pointed one.
Widening it now would pre-commit to the wrong answer.

### 3. `lightTheme` uses `satisfies`, not an annotation

```ts
export const lightTheme = { colors, spacing, … } satisfies Theme;
```

`: Theme` would widen the exported value, losing the literal types for anything importing this
module directly — a snapshot test asserting a specific hex, for instance. `satisfies` keeps them and
still fails the build on a missing key.

### 4. `useTheme()` throws when no provider is above it

The context defaults to `undefined` rather than to `lightTheme`.

Defaulting would make a component rendered outside `ThemeProvider` work by accident: identical
output today, and silently light-themed on the day a second palette exists. The bug would be
_introduced now_ and _discovered then_. Throwing means every consumer is provably inside the
provider from the start, which is the entire value of the seam ADR-0013 §1 describes.

A plain `Error`, not an `AppError` ([ADR-0015](0015-error-model.md)): this is a wiring mistake that
crashes at mount in development and cannot reach a user, so it needs no `userMessage` and no error
kind.

### 5. Direct token imports are a lint error outside the design system

ADR-0013 §1 shows this as `❌ lint error`:

```ts
import { colors } from '@/core/design-system/tokens';
```

No such rule existed. It does now — `no-restricted-imports` in the `src/features/**` and
`src/app/**` block. Without it, §1 of ADR-0013 described a convention while claiming to describe
enforcement, and the seam would have leaked one screen at a time.

## Consequences

- Adding dark mode is: author `darkTheme` against `ThemeColors` (compile-checked for completeness),
  give `ThemeProvider` a mode, add a persisted preference. No component changes — the outcome
  ADR-0013 intended, now actually reachable.
- `useTheme()` throwing means tests must wrap. `renderWithTheme` in `src/test/` covers it, and a
  test that forgets the wrapper fails loudly instead of passing against a default.
- The `Theme` interface must be edited when a token group is added. That is a one-line change and it
  is a useful checkpoint: a new top-level group is a design-system decision, not a drive-by.
- Reading `theme.colors.surface.primary` yields `string`, not `'#FFFFFF'`. Nothing switches on a
  colour value, so this costs nothing; key autocomplete — the thing ADR-0005 promises — is intact.

## Alternatives considered

- **Keep `typeof lightTheme` and drop `as const` from the token modules.** Restores dark-mode
  headroom by giving up literal types everywhere, which loses the
  `satisfies Record<string, TextStyle>` typo check in `typography.ts` and the exhaustiveness of
  token key unions. Trading a guarantee that works for one that might be needed later.
- **Recursive deep-widen mapped type.** Breaks `fontWeight` assignability, as measured. Would need
  per-key exceptions, at which point the explicit interface is the same thing with less machinery.
- **Author `darkTheme` now so the inferred type widens naturally.** Two `as const` objects with
  different literals still infer incompatible types unless one is annotated, so it does not even
  solve the problem — and it ships an untested second palette, which ADR-0013 rejects for good
  reasons.
- **Default the context to `lightTheme` instead of throwing.** Less test ceremony, at the cost of
  the failure mode in §4. The ceremony is one wrapper function; the failure mode is a silent
  wrong-palette render found by eye.
