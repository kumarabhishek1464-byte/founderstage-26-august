/**
 * The palette. Every value the app renders originates here.
 *
 * Names are semantic, never literal, so a palette change is a rename of nothing:
 * `surface.primary` can be re-pointed, `white` cannot ([ADR-0013](../../../../docs/adr/0013-single-light-theme.md)).
 * Components never import this module — they read `useTheme()`. The indirection is what a
 * second palette would need, and it costs one line.
 *
 * The design language's central constraint is that red is a **signal, not a surface**:
 * roughly 90% of any screen is white or neutral. That is why there is no `surface.accent`
 * and no red background token. Adding one would be the first step in losing the identity.
 *
 * Contrast against `#FFFFFF`, measured rather than assumed — see
 * [ADR-0017 §5–6](../../../../docs/adr/0017-token-schema.md):
 *
 *   text.body      #444444   9.74:1   AA
 *   text.secondary #666666   5.74:1   AA
 *   text.tertiary  #8A8A8A   3.45:1   AA-large only — metadata, never body copy
 *   text.disabled  #B5B5B5   2.05:1   exempt (WCAG 1.4.3 inactive components)
 *   text.accent    #E53935   4.23:1   AA-large only — emphasis, never body copy
 */
export const colors = {
  /**
   * Backgrounds. `primary` is the canvas and dominates; the other two are for grouping,
   * used sparingly — a screen of stacked grey panels is the failure mode this palette is
   * shaped to avoid.
   */
  surface: {
    primary: '#FFFFFF',
    secondary: '#F8F8F8',
    tertiary: '#F5F5F5',
    /** Near-black rather than pure, for tooltips and dark chips. Pure black flares on OLED. */
    inverse: '#111111',
  },

  text: {
    /** Display type and single strong titles. */
    primary: '#000000',
    /** Headings in a dense stack, where pure black reads heavy line after line. */
    heading: '#111111',
    /** Running prose. Softer than headings on purpose — a paragraph in pure black fatigues. */
    body: '#444444',
    secondary: '#666666',
    /** Timestamps, counts, metadata. AA-large only: not for body copy. */
    tertiary: '#8A8A8A',
    disabled: '#B5B5B5',
    /** On `action.primary` or `surface.inverse`. */
    inverse: '#FFFFFF',
    /** Red as a foreground. Emphasis and large type only — 4.23:1. */
    accent: '#E53935',
  },

  border: {
    /** The default. Card outlines, list separators, input rest state. */
    subtle: '#EAEAEA',
    /** Even quieter — separators inside an already-bordered container. */
    faint: '#F0F0F0',
    /** Deliberate emphasis: a selected input, a hovered control. Not a default. */
    strong: '#D9D9D9',
  },

  /**
   * Interactive fills. `primaryPressed` is a real authored value because a pressed state
   * produced by opacity looks washed out against white rather than pressed.
   *
   * There is no `primaryDisabled`: a disabled primary is the enabled fill composited at
   * `opacity.disabled`. Authoring a fourth red means the day the brand changes, one of the
   * two is missed — ADR-0017 §4.
   */
  action: {
    primary: '#E53935',
    primaryPressed: '#C62828',
    /** Secondary buttons are white with a border; the fill is the canvas. */
    secondary: '#FFFFFF',
    secondaryPressed: '#F5F5F5',
    /** Tertiary is transparent at rest, so only the pressed state has a fill. */
    tertiaryPressed: '#F5F5F5',
  },

  /**
   * Muted rather than saturated: these sit on pure white beside one scarce accent, and a
   * bright green or amber would be the loudest thing on the screen.
   *
   * `error` is the *pressed* brand red, not `action.primary`. An error in the identical red
   * competes with the CTA in the one moment a user most needs to tell "this is broken" from
   * "press this" — ADR-0017 §5.
   */
  status: {
    success: '#147D3E',
    warning: '#AD6200',
    error: '#C62828',
    info: '#1F5FA8',
  },

  /**
   * Keyboard focus. Blue rather than the brand red: a focus ring is not an action, and on a
   * red button a red ring is invisible. Web-critical, and correct on native with an
   * external keyboard.
   */
  focus: {
    ring: '#1F5FA8',
  },

  overlay: {
    /** Behind a modal or bottom sheet. 40% — enough to recede, not enough to feel heavy. */
    scrim: 'rgba(0, 0, 0, 0.40)',
    /** Skeleton base and sweep. Two neutrals, no colour: a shimmer must not read as content. */
    skeleton: '#F0F0F0',
    skeletonSheen: '#F8F8F8',
  },
} as const;
