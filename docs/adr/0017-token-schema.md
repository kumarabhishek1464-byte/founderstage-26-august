# ADR-0017 — The canonical token schema, and which earlier ADR wins where they disagree

- **Status:** Accepted
- **Date:** 2026-08-24
- **Amends:** the illustrative token names in [ADR-0005](0005-styling-approach.md) §Decision. The
  decisions in ADR-0005 and [ADR-0013](0013-single-light-theme.md) both stand; only the concrete key
  names are fixed here.

## Context

Three sources describe the theme object, and they do not agree. This was invisible while no
component existed, and it becomes a compile error the moment one does.

| Concept         | ADR-0005 §Decision     | ADR-0013 §2              | `eslint.config.js` |
| --------------- | ---------------------- | ------------------------ | ------------------ |
| colour root     | `t.color`              | `colors`                 | —                  |
| white surface   | `color.bg.primary`     | `colors.surface.primary` | —                  |
| hairline border | `color.border.primary` | `colors.border.subtle`   | —                  |
| brand red       | `'brand.primary'`      | `colors.action.primary`  | —                  |
| spacing root    | `t.space`              | —                        | `theme.spacing`    |
| destructive     | `'status.error'`       | —                        | —                  |

Left unresolved, the outcome is predictable: the first component picks one, the other two ADRs
become documentation of an API that does not exist, and the next engineer trusts the wrong one.
CLAUDE.md requires that an ADR be read before an architectural decision is changed, which only works
if the ADRs are true.

## Decision

### 1. Precedence

Where the three disagree, the order is:

1. **`eslint.config.js`** wins on names it already enforces. `no-restricted-syntax` ships a message
   naming `theme.spacing`, `theme.radius` and `theme.typography`, and that message is what a
   developer reads at the moment they hit the error. A schema that contradicts it would make a
   build-failing rule give wrong advice — the worst kind of documentation, because it is delivered
   with authority at exactly the wrong moment.
2. **ADR-0013 §2** wins on colour naming. It is the ADR specifically about naming, its argument
   (`surface.primary` can be re-pointed, `white` cannot) is the substantive one, and both lint
   messages already cite it.
3. **ADR-0005** wins on everything structural — typed `StyleSheet`, `createStyles`, variants as
   typed lookup maps, no styling library. Its snippets were illustrating the _mechanism_; the key
   names in them were incidental and are superseded here.

`t.color.bg.primary` therefore becomes `theme.colors.surface.primary`, and `t.space.lg` becomes
`theme.spacing.lg`. ADR-0005's variant map remains exactly the pattern to use; only the token paths
inside it change.

### 2. The schema

```ts
theme = {
  colors: { surface, text, border, action, status, focus, overlay },
  spacing,
  radius,
  typography,
  shadow,
  border,
  motion,
  breakpoint,
  opacity,
  size,
};
```

`colors` is plural (a collection of colours); `shadow`, `border` and `motion` are singular (one set
of related values). This is not arbitrary consistency — `theme.colors.border` and `theme.border` are
different things, and the number distinguishes them: the first is what a border _looks_ like, the
second is how _thick_ it is. Both are needed on the same line:

```ts
borderColor: t.colors.border.subtle,
borderWidth: t.border.hairline,
```

`opacity` and `size` are small by design: `opacity.disabled` exists because §4 composites rather
than authoring a disabled red, and `size.touchTarget` (44) exists because the minimum tap target is
an accessibility floor that every interactive component needs and none should re-declare.

### 2a. The font family is the platform's own

`typography` carries no `fontFamily`. On iOS that yields SF Pro, on Android Roboto, and on web the
`system-ui` stack — which is what "platform-native on iOS" asks for and what the design language
means by typography-driven.

Inter is named as an option in the design language and is deliberately **not** loaded. A custom font
means `expo-font` on the startup path, an async load before first paint, and a flash of unstyled
text on web — real cost, against a difference most users cannot name. It is one token change if the
call is made: add the family to `typography.family` and the roles inherit it.

### 3. Spacing keys run `xl2 … xl6`, not `xxl … xxxxxl`

The scale is fixed by the design language at eleven values — `4 8 12 16 20 24 32 40 48 64 80` —
which is more than t-shirt sizes comfortably name.

```ts
spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xl2: 32,
  xl3: 40,
  xl4: 48,
  xl5: 64,
  xl6: 80,
};
```

Rejected alternatives, and why:

- **`xxl`, `xxxl`, `xxxxl`, `xxxxxl`** — requires counting characters to tell 48 from 64. A
  transposed `x` type-checks and is invisible in review.
- **`'2xl'`** (Tailwind's convention) — a leading digit forces `theme.spacing['2xl']` at every call
  site. `xl2` reads the same, sorts the same, and keeps dot access.
- **Numeric steps `spacing[5]`** — re-pointable, but `padding: t.spacing[5]` tells a reviewer
  nothing about intent, which defeats the reason the scale is named at all.
- **Two scales** (`spacing` for components, `layout` for section rhythm) — the boundary between 40
  and 48 would be argued about in every review, and the argument has no correct answer.

`radius` uses the same convention (`xs sm md lg xl xl2`, plus `full`) so one rule covers both.

### 4. No `colors.action.primaryDisabled`

A disabled primary button is rendered by compositing — the enabled fill at reduced opacity — rather
than by a fourth authored red. Authoring `#E53935` at 40% as its own hex means the day the brand red
changes, one of the two is missed, and the miss is a subtly wrong disabled state nobody looks at.
`theme.opacity.disabled` is the token; the colour is not duplicated.

### 5. Status colours

Not specified by the design language, so they are decided here. Ratios are computed against
`#FFFFFF`, not estimated:

| Token            | Value     | On `#FFFFFF` |     |
| ---------------- | --------- | ------------ | --- |
| `status.success` | `#147D3E` | 5.21:1       | AA  |
| `status.warning` | `#AD6200` | 4.64:1       | AA  |
| `status.error`   | `#C62828` | 5.62:1       | AA  |
| `status.info`    | `#1F5FA8` | 6.44:1       | AA  |

All four clear 4.5:1 for normal-weight text on white. `#B26A00` was the first candidate for
`warning` and was dropped at 4.24:1 — AA for large text only. Amber is the hue where this is easiest
to get wrong, because a value that looks legible is often not.

`status.error` is deliberately `#C62828` — the _pressed_ brand red — and not `#E53935`. The design
language makes red a scarce signal for the primary action. An error state rendered in the identical
red competes with the CTA in the one moment the user most needs to distinguish "this is broken" from
"press this". A darker, desaturated red reads as error without borrowing the action's weight, and it
is a value already in the palette rather than a sixth red.

These are muted rather than saturated because they sit on pure white beside a single scarce accent;
a bright green or amber would be the loudest thing on the screen.

### 6. `#E53935` is AA-large only, and is shipped anyway

Measured, because it is the most consequential number in the palette:

| Pair                   | Ratio  |               |
| ---------------------- | ------ | ------------- |
| `#E53935` on `#FFFFFF` | 4.23:1 | AA-large only |
| `#FFFFFF` on `#E53935` | 4.23:1 | AA-large only |
| `#C62828` on `#FFFFFF` | 5.62:1 | AA            |
| `#D32F2F` on `#FFFFFF` | 4.98:1 | AA            |

A white label on the primary button therefore does **not** meet WCAG AA for normal-size text. AA's
large-text threshold is 18.66px bold or 24px regular; a 15–17px semibold button label does not reach
it, so 4.5:1 is the applicable bar and `#E53935` is 0.27 short.

`#E53935` is specified explicitly by the design language and is shipped exactly as given. Darkening
the brand colour is a brand decision, not an engineering one, and making it silently would be worse
than the contrast gap. What is done instead:

- The value lives in one token, so the fix is one line if the call is made to take it.
- `text.accent` (`#E53935` as a foreground on white) is documented as usable for emphasis and large
  type only — never for body copy. This is where the ratio bites hardest, and it is the easier half
  to get wrong.
- Two mitigations are available and neither has been applied unilaterally: darken the fill to
  `#D32F2F` (4.98:1, visually near-identical, closes it), or raise button labels to 18.66px bold and
  keep `#E53935` legitimately as AA-large.

Two other measured values worth recording, both from the design language:

- `text.tertiary` `#8A8A8A` is 3.45:1 — AA-large only. Correct for timestamps and metadata, wrong
  for body copy. Enforced only by review; a lint rule cannot see which colour meets which text size.
- `text.disabled` `#B5B5B5` is 2.05:1. This is fine and intentional: WCAG 1.4.3 exempts inactive
  interface components from contrast minimums, and a disabled control that reads as enabled is the
  worse failure.

## Consequences

- One schema, and the two earlier ADRs now describe it accurately.
- `theme.colors.border.subtle` / `theme.border.hairline` sit on adjacent lines and read distinctly.
- Cost: `xl2 … xl6` is a convention a new engineer has to see once. Chosen over the alternatives
  because it is the only one where a typo does not silently type-check.
- Cost: this ADR exists because the earlier two were written before any component consumed them.
  Illustrative code in an ADR should be marked as illustrative — a lesson for later ADRs rather than
  a reason to stop writing them.
- The status colours are the one part of the palette not derived from the stated design language, so
  they are the part most likely to be revised. They are four values in `tokens/colors.ts`.
- **An open accessibility decision is recorded rather than resolved** (§6). `#E53935` ships as
  specified; whether to close the 0.27 gap by darkening the fill or by enlarging button labels is a
  design call, and the token layer is arranged so either is a one-line change.
