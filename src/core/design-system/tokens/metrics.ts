/**
 * The spacing scale, fixed by the design language at eleven values:
 * `4 8 12 16 20 24 32 40 48 64 80`. Nothing else is a legal gap.
 *
 * Keys run `xl2 … xl6` rather than `xxl … xxxxxl` because a transposed `x` type-checks and
 * is invisible in review, while `xl4` is not — see
 * [ADR-0017 §3](../../../../docs/adr/0017-token-schema.md) for the alternatives considered.
 *
 * `0` is absent on purpose: `padding: 0` is not a token decision, and the lint rule that
 * bans raw numbers deliberately permits it.
 */
export const spacing = {
  /** Icon-to-label, tight inline gaps. */
  xxs: 4,
  /** Between related lines of text. */
  xs: 8,
  /** Inside a compact control. */
  sm: 12,
  /** The default gap. Between cards, around list rows. */
  md: 16,
  /** Card interior padding. */
  lg: 20,
  /** Screen horizontal margin. */
  xl: 24,
  /** Between distinct groups within a section. */
  xl2: 32,
  xl3: 40,
  /** Between sections. */
  xl4: 48,
  xl5: 64,
  /** Above a page title, below the last section. Generous whitespace is the identity. */
  xl6: 80,
} as const;

/**
 * The radius scale. Same key convention as `spacing`, so one rule covers both.
 *
 * `lg` (16) is the card radius the design language specifies, and is the value that carries
 * the most of the visual identity.
 */
export const radius = {
  /** Badges, small tags. */
  xs: 6,
  /** Inputs, small controls. */
  sm: 8,
  /** Buttons. */
  md: 12,
  /** Cards — the signature radius. */
  lg: 16,
  /** Bottom sheets, large panels. */
  xl: 20,
  /** Full-bleed sheets and modals. */
  xl2: 24,
  /**
   * Pills and circular avatars. A large finite number rather than a percentage, because
   * React Native does not accept `borderRadius: '50%'` on native.
   */
  full: 9999,
} as const;

/**
 * Border widths. `hairline` is the design language's default — a card outline should read as
 * a boundary, not as a frame.
 *
 * A literal `1` rather than `StyleSheet.hairlineWidth`: on a 3x iOS screen hairlineWidth is
 * 0.33pt, which disappears at the near-white contrast this palette uses (`#EAEAEA` on
 * `#FFFFFF`). The border becoming invisible defeats the token.
 */
export const border = {
  hairline: 1,
  /** Deliberate emphasis: a focused input, a selected card. */
  thin: 1.5,
  /** The focus ring, which has to be visible against a 1px resting border. */
  focus: 2,
  /**
   * A stroke that is meant to be read as a mark rather than as a boundary — the red segment the
   * navigation chrome puts on its own hairline to say where you are.
   *
   * Numerically equal to `focus` today, and still a separate name for the same reason
   * `size.contentMaxWidth` is not a breakpoint: the two are retuned for unrelated reasons. `focus`
   * moves if the ring stops clearing a resting border; `marker` moves if the mark reads too timid
   * against `#EAEAEA`. Collapsing them would couple a keyboard-accessibility value to a brand one.
   */
  marker: 2,
} as const;

/**
 * Opacity. `disabled` is the reason `colors.action` has no `primaryDisabled` — a disabled
 * control composites the enabled fill rather than duplicating the brand red (ADR-0017 §4).
 */
export const opacity = {
  disabled: 0.4,
  /**
   * Tertiary/ghost press feedback, where there is no fill to darken. Deliberately shallow;
   * the design language calls for restraint, and a 0.5 flash reads as a bug.
   */
  pressed: 0.72,
} as const;

/**
 * Sizes that more than one component needs and none should re-declare.
 */
export const size = {
  /**
   * The accessibility floor for anything tappable.
   *
   * 48 rather than 44: Apple's HIG minimum is 44pt and Material's is 48dp, and since a
   * point and a density-independent pixel are within 2% of each other physically, 48 is the
   * stricter of the two. One number that satisfies both beats two numbers and a platform
   * conditional, and it clears WCAG 2.5.5 (44×44) with room.
   *
   * Applied via `hitSlop` when a control is visually smaller, so the tap area meets the
   * floor even where the ink deliberately does not — the design language's small, quiet
   * controls stay small.
   */
  touchTarget: 48,

  /**
   * The cap on a centred content column, applied once in `Screen` so no other component
   * thinks about width.
   *
   * Applied on every platform rather than in a `Screen.web.tsx`: at phone width the cap is a
   * no-op, and a platform extension would leave an Android tablet or an unfolded foldable
   * rendering exactly the full-bleed measure this exists to prevent.
   *
   * A typographic measure, not a device one: ~70 characters at `typography.body` is the
   * comfortable line length, and beyond it the eye loses the line return. That it is a
   * measure rather than a breakpoint is why it lives here and not in `breakpoint` — the two
   * are retuned for different reasons.
   */
  contentMaxWidth: 720,

  /**
   * Icon squares. Three sizes, matched to the type they sit beside so an icon and its label
   * share a baseline: `iconSm` with `caption`/`footnote`, `iconMd` with `body`/`label`, `iconLg`
   * with `title3` and up.
   *
   * A fourth size is almost always someone eyeballing 22px because 20 looked small in one
   * place. Three is the constraint.
   */
  iconSm: 16,
  iconMd: 20,
  iconLg: 24,

  /**
   * Avatar diameters. Three, for the three places a person appears: beside a line of text
   * (`sm`, matched to `typography.body`'s 22pt line box), in the app header and list rows
   * (`md`), and as the subject of a profile header (`lg`, which is `touchTarget`).
   */
  avatarSm: 24,
  avatarMd: 32,
  avatarLg: 48,

  /**
   * One height for both bars of the app shell — the header and the bottom tab bar.
   *
   * Deliberately a single token rather than `headerHeight` and `tabBarHeight`, because the two
   * being equal is a design decision and not a coincidence: the canvas sits in a symmetrical
   * frame, which is the quietest way to hold a screen. Two tokens would let them drift apart
   * silently.
   *
   * 56 is derived, not chosen: the tab bar stacks `spacing.xs` + `iconMd` (20) + `spacing.xxs` +
   * `typography.caption`'s 16pt line box + `spacing.xs`, which is exactly 56, and the header
   * centres `avatarMd` (32) in it with `spacing.sm` above and below.
   */
  chrome: 56,

  /**
   * The side rail's width at `lg` and above. 240 leaves 784 on a 1024pt viewport, which is the
   * `contentMaxWidth` column plus its two `spacing.xl` gutters with 16 to spare — so the column
   * reaches full measure at exactly the width the rail first appears.
   */
  railWidth: 240,

  /**
   * The length of the active-destination mark: 24 along the hairline, `border.marker` across.
   *
   * Equal to `iconLg` on purpose — the mark is as wide as the glyph it sits under, so it reads as
   * belonging to that destination rather than as a segment of arbitrary length.
   */
  navMark: 24,
} as const;
