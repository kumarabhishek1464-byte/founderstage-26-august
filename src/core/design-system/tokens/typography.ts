/**
 * Type carries the hierarchy in this design language. There is one accent colour and almost
 * no chrome, so if the type scale does not establish rank, nothing else will.
 *
 * **No `fontFamily`.** Omitting it yields SF Pro on iOS, Roboto on Android and the
 * `system-ui` stack on web — which is what "platform-native on iOS" asks for. Inter is named
 * as an option in the design language and is deliberately not loaded: a custom font puts
 * `expo-font` on the startup path, delays first paint, and flashes unstyled text on web, for
 * a difference most users cannot name. Adding it later is one change here — see
 * [ADR-0017 §2a](../../../../docs/adr/0017-token-schema.md).
 *
 * Sizes are absolute rather than `rem`-like, because React Native has no root font size.
 * `allowFontScaling` stays at its default `true` everywhere, so OS text-size settings are
 * honoured; that is why every role's `lineHeight` is a multiple of its size rather than a
 * fixed pixel gap that would collide at 200% scale.
 */
import type { TextStyle } from 'react-native';

/**
 * Weights as string literals, which is what React Native expects. `'600'` renders as SF Pro
 * Semibold on iOS; on Android, Roboto has no 600 face, so the platform picks Medium (500) or
 * Bold (700) depending on API level. Accepted: the alternative is bundling a font.
 */
const WEIGHT = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const satisfies Record<string, TextStyle['fontWeight']>;

/**
 * Negative tracking above ~20px and positive below ~13px. Large type set at 0 looks loose
 * and small type set at 0 looks cramped — this is the single adjustment that most makes a
 * system typeface read as considered rather than default.
 *
 * `satisfies Record<string, TextStyle>` is the point of the inner const: a typo in a property
 * name — `lineheight`, `fontweight` — would otherwise be a silently ignored extra key that
 * type-checks and renders wrong.
 */
const ROLES = {
  /**
   * Screen titles and marquee numbers. Sparingly — one per screen at most.
   */
  display: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: WEIGHT.bold,
    letterSpacing: -0.7,
  },
  title1: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: WEIGHT.semibold,
    letterSpacing: -0.5,
  },
  /** Section heading. */
  title2: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: WEIGHT.semibold,
    letterSpacing: -0.3,
  },
  /** Card heading. */
  title3: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: WEIGHT.semibold,
    letterSpacing: -0.2,
  },
  /** A list row's primary line. Heavier than `body` at the same optical rank. */
  headline: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: WEIGHT.semibold,
    letterSpacing: -0.1,
  },
  /** Running prose. 15/22 — 1.47 leading, set for paragraphs rather than single lines. */
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: WEIGHT.regular,
    letterSpacing: 0,
  },
  /** Emphasis inside prose without changing rank. */
  bodyStrong: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: WEIGHT.semibold,
    letterSpacing: 0,
  },
  /** Field labels, tab titles, secondary rows. */
  subhead: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: WEIGHT.medium,
    letterSpacing: 0,
  },
  /** Helper text under an input, timestamps. */
  footnote: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: WEIGHT.regular,
    letterSpacing: 0,
  },
  /** Counts, metadata, the smallest legible size. */
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: WEIGHT.regular,
    letterSpacing: 0.1,
  },
  /**
   * Uppercase section eyebrows. Wide tracking is not decoration — uppercase at 11px is
   * unreadable without it. The component applies `textTransform`, not this token, so the
   * accessible label stays sentence-case.
   */
  overline: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: WEIGHT.semibold,
    letterSpacing: 0.6,
  },
  /**
   * Button labels. Semibold at 15 so a white label on `action.primary` is as legible as that
   * red allows — 4.23:1, AA-large only, which is the open item in ADR-0017 §6.
   */
  label: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: WEIGHT.semibold,
    letterSpacing: -0.1,
  },
} as const satisfies Record<string, TextStyle>;

export const typography = {
  weight: WEIGHT,
  ...ROLES,
} as const;

/** The named roles, excluding the `weight` map. Drives `Text`'s `variant` prop. */
export type TypographyRole = keyof typeof ROLES;
