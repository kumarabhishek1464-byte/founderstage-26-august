/**
 * Type carries the hierarchy in this design language. There is one accent colour and almost
 * no chrome, so if the type scale does not establish rank, nothing else will.
 *
 * **Inter is the type family.** Loaded once at the root through `expo-font` and gated behind
 * the splash screen so nothing on screen ever ships in the wrong face. Falling back to system
 * (SF Pro / Roboto / `system-ui`) is honest — an unrecognised `fontFamily` string in RN
 * simply defers to the platform default — so a device that fails to load a face renders the
 * platform typeface rather than a broken glyph run. The names below are the exact identifiers
 * `@expo-google-fonts/inter` registers under; changing them here without a matching `useFonts`
 * key silently disables the family.
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
 * Bold (700) depending on API level — Inter carries a real face at every declared weight, so
 * the mapping is exact once the family is loaded.
 */
const WEIGHT = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const satisfies Record<string, TextStyle['fontWeight']>;

/**
 * Family name per weight. React Native's `fontFamily` is a *single* string — no CSS stack — so
 * each weight carries its own registered face. `fontWeight` is still set alongside for web,
 * where `react-native-web` maps to CSS and Inter's variable font honours the numeric weight
 * anyway. `FONT_FAMILY.regular` is the identity choice for every non-heading role.
 */
const FONT_FAMILY = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const satisfies Record<keyof typeof WEIGHT, string>;

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
    fontFamily: FONT_FAMILY.bold,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: WEIGHT.bold,
    letterSpacing: -0.7,
  },
  title1: {
    fontFamily: FONT_FAMILY.semibold,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: WEIGHT.semibold,
    letterSpacing: -0.5,
  },
  /** Section heading. */
  title2: {
    fontFamily: FONT_FAMILY.semibold,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: WEIGHT.semibold,
    letterSpacing: -0.3,
  },
  /** Card heading. */
  title3: {
    fontFamily: FONT_FAMILY.semibold,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: WEIGHT.semibold,
    letterSpacing: -0.2,
  },
  /** A list row's primary line. Heavier than `body` at the same optical rank. */
  headline: {
    fontFamily: FONT_FAMILY.semibold,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: WEIGHT.semibold,
    letterSpacing: -0.1,
  },
  /** Running prose. 15/22 — 1.47 leading, set for paragraphs rather than single lines. */
  body: {
    fontFamily: FONT_FAMILY.regular,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: WEIGHT.regular,
    letterSpacing: 0,
  },
  /** Emphasis inside prose without changing rank. */
  bodyStrong: {
    fontFamily: FONT_FAMILY.semibold,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: WEIGHT.semibold,
    letterSpacing: 0,
  },
  /** Field labels, tab titles, secondary rows. */
  subhead: {
    fontFamily: FONT_FAMILY.medium,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: WEIGHT.medium,
    letterSpacing: 0,
  },
  /** Helper text under an input, timestamps. */
  footnote: {
    fontFamily: FONT_FAMILY.regular,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: WEIGHT.regular,
    letterSpacing: 0,
  },
  /** Counts, metadata, the smallest legible size. */
  caption: {
    fontFamily: FONT_FAMILY.regular,
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
    fontFamily: FONT_FAMILY.semibold,
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
    fontFamily: FONT_FAMILY.semibold,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: WEIGHT.semibold,
    letterSpacing: -0.1,
  },
} as const satisfies Record<string, TextStyle>;

export const typography = {
  weight: WEIGHT,
  fontFamily: FONT_FAMILY,
  ...ROLES,
} as const;

/** The named roles, excluding the `weight` map. Drives `Text`'s `variant` prop. */
export type TypographyRole = keyof typeof ROLES;
