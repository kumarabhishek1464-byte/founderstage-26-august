# ADR-0005 — Styling: typed `StyleSheet` tokens, not a styling library

- **Status:** Accepted
- **Date:** 2026-08-24

## Context

The design language is specific and narrow: pure white canvas, black/grey type hierarchy, a single
scarce red for actions, a fixed spacing scale, a fixed radius scale, and deliberately subtle
elevation. **One theme ships at launch** — dark mode is explicitly excluded from the initial visual
identity ([ADR-0013](0013-single-light-theme.md)).

Candidates: plain `StyleSheet` with a typed theme; Unistyles 3; NativeWind 4; Tamagui.

The constraint that decides it: tokens must be **strongly typed** so that a wrong value is a compile
error, and the styling layer must work identically on iOS, Android and web without platform-specific
build configuration.

## Decision

Plain `StyleSheet.create` behind a typed theme and a `createStyles` factory. **No styling library.**

```ts
const useStyles = createStyles((t) => ({
  card: {
    backgroundColor: t.color.bg.primary, // #FFFFFF
    borderColor: t.color.border.primary, // #EAEAEA
    borderWidth: t.border.hairline,
    borderRadius: t.radius.lg, // 16
    padding: t.space.lg, // 20
    ...t.shadow.xs,
  },
}));
```

Variants are a **typed lookup map**, not string parsing:

```ts
const VARIANT: Record<ButtonVariant, ButtonVariantStyle> = {
  primary: { bg: 'brand.primary', fg: 'text.inverse' },
  secondary: { bg: 'bg.primary', fg: 'text.primary', border: 'border.primary' },
  tertiary: { bg: 'transparent', fg: 'text.primary' },
  destructive: { bg: 'status.error', fg: 'text.inverse' },
};
```

Responsive behaviour uses breakpoint tokens through a `useBreakpoint()` hook. The only place it is
needed at launch is the constrained web content width, handled once in `Screen.web.tsx`.

## Consequences

- **Zero styling dependencies.** No Babel plugin, no Metro transformer, no native module in the
  build path — so no styling-related SDK upgrade risk. For a foundation intended to survive many
  Expo upgrades, this is the dominant consideration.
- Full IDE autocomplete on every token; an invalid token is a type error.
- "No hardcoded design values" is enforceable by lint, because there is no escape hatch that looks
  legitimate.
- Cost: no CSS-like sugar. Variants are explicit maps. With ~34 components this is a small, one-time
  cost, and the maps are more readable than class strings.
- Cost: theme switching would re-render consumers of `useStyles`. Irrelevant with one theme; if dark
  mode arrives and this measures badly, `createStyles` is the single seam to optimise.

## Alternatives considered

- **Unistyles 3.** Genuinely excellent — C++ backed, variants and breakpoints built in, no re-render
  on theme change. Rejected because its main advantages (runtime theme switching, breakpoint
  variants) address problems we do not have at launch, while it adds a native module plus a Babel
  plugin to the build path. That is a recurring upgrade tax paid for unused capability. **This is
  the closest call in this document** — reconsider if dark mode plus heavy responsive layout both
  arrive.
- **NativeWind 4.** Rejected on the core constraint: tokens become strings in a Tailwind config,
  which is materially weaker typing than a token object, and `className="p-[17px]"` makes "no
  arbitrary design values" unenforceable. Also peers `tailwindcss ~3`, and adds Metro + Babel +
  PostCSS layers.
- **Tamagui.** Powerful, and its optimising compiler is real. Too large a surface area and too
  opinionated a component layer for a design system this specific — we would spend our time
  overriding it.
