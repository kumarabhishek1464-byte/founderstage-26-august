/**
 * Elevation, which this design language uses almost imperceptibly: a card is defined by its
 * `#EAEAEA` border and its radius, and the shadow only keeps it from looking pasted on. An
 * oversized shadow is explicitly out of the identity, so there is no `lg` or `xl` here —
 * omitting them is the enforcement.
 *
 * Three platforms, three mechanisms, and they do not accept the same properties:
 *
 *   iOS      `shadowColor` + `shadowOffset` + `shadowOpacity` + `shadowRadius`
 *   Android  `elevation` only — offset, opacity and radius are ignored outright
 *   web      `boxShadow`, and the RN properties either warn or do nothing
 *
 * So each level authors all three and `Platform.select` picks. Writing only the iOS
 * properties is the common mistake: Android renders no shadow at all and the cards look
 * flat, which is easy to miss because the border still reads.
 *
 * Android's `elevation` also draws a grey scrim whose spread is not controllable, so it
 * cannot be tuned to match iOS. The values below are the closest visual match, chosen to err
 * toward *less* shadow — a heavy Android shadow would break the identity in a way a slightly
 * light one does not.
 */
import { Platform } from 'react-native';

import type { ViewStyle } from 'react-native';

/**
 * `#000000` at very low opacity rather than a tinted shadow. A coloured shadow against pure
 * white reads as a glow, which is the glassmorphism this design language rules out.
 */
const SHADOW_COLOR = '#000000';

interface ShadowLevel {
  readonly ios: ViewStyle;
  readonly android: ViewStyle;
  readonly web: ViewStyle;
}

function select(level: ShadowLevel): ViewStyle {
  return Platform.select({
    ios: level.ios,
    android: level.android,
    // `default` rather than `web`, so any future platform gets the CSS path instead of
    // silently getting `{}` and no shadow at all.
    default: level.web,
  });
}

export const shadow = {
  /** An explicit "no elevation", so a variant map can name the absence. */
  none: {} as ViewStyle,

  /**
   * Cards. The default, and the only one most surfaces should use. Deliberately at the
   * threshold of perceptible — the design language asks for shadows that are almost
   * imperceptible, and this is that value rather than a compromise toward it.
   */
  xs: select({
    ios: {
      shadowColor: SHADOW_COLOR,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 2,
    },
    android: { elevation: 1 },
    // Two layers: a tight contact shadow plus a wider ambient one. A single blur at this
    // opacity reads as a smudge; the pair reads as depth. Cheap on web, impossible on native.
    web: {
      boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.04), 0px 1px 3px rgba(0, 0, 0, 0.02)',
    },
  }),

  /**
   * Raised: a pressed card lifting, a dropdown, a floating action. One step up, not two.
   */
  sm: select({
    ios: {
      shadowColor: SHADOW_COLOR,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
    },
    android: { elevation: 3 },
    web: {
      boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.06), 0px 1px 2px rgba(0, 0, 0, 0.03)',
    },
  }),

  /**
   * Bottom sheets and modals only — a surface that genuinely floats above a scrim. The
   * offset is negative so the shadow falls *upward* from a sheet's top edge, which is where
   * the boundary the user needs to see actually is.
   */
  md: select({
    ios: {
      shadowColor: SHADOW_COLOR,
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.1,
      shadowRadius: 16,
    },
    android: { elevation: 12 },
    web: { boxShadow: '0px -4px 16px rgba(0, 0, 0, 0.10)' },
  }),
} as const;

export type ShadowLevelName = keyof typeof shadow;
