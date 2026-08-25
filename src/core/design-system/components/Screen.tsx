/**
 * `Screen` — the outer frame every screen sits in. It owns the four things a screen must not each
 * decide for itself: the safe-area insets, the background surface, the horizontal screen margin, and
 * the maximum content width. A feature screen is then just its content; it never touches an inset or
 * a `SafeAreaView` directly.
 *
 * ## The content clamp is unconditional, not a `.web.tsx`
 *
 * ADR-0005 frames the 720pt content cap as a web concern, and earlier notes reached for a
 * `Screen.web.tsx` to hold it. It lives here instead, applied on every platform, because
 * `maxWidth: 720` is a **no-op at phone width** — a 390pt column is already well under the cap — and
 * exactly right on a tablet or a resized web window. Splitting it into a platform extension would be
 * two files holding one number that only ever does anything past 720pt, and it would leave an Android
 * tablet or an unfolded foldable rendering the full-bleed measure the cap exists to prevent. One
 * file, one rule.
 *
 * The clamp is `maxWidth` + `alignSelf: 'center'`, so the background fills the whole window and only
 * the content column is bounded: a wide screen reads as white margins around a centred column, never
 * as a card floating on grey.
 *
 * ## Insets are split across the scroll boundary
 *
 * The **top** inset always sits on the fixed outer frame. The **bottom** inset sits on the content
 * column, which for a scrolling screen means it scrolls: content travels up past the home indicator
 * and comes to rest above it, rather than being clipped by a padding that scrolls with it. Same rule
 * in both branches, so there is one thing to remember.
 *
 * `safeTop`/`safeBottom` turn an edge off for the screen that has something else owning it — a
 * navigation header owns the top, a bottom tab bar owns the bottom.
 *
 * Left/right insets are always honoured (a landscape notch) and are **added to** the horizontal
 * margin rather than replacing it, so a padded screen in landscape clears the notch and still keeps
 * its margin.
 *
 * ## Deliberately not: keyboard avoidance
 *
 * `Screen` sets `keyboardShouldPersistTaps="handled"` — without it the first tap after the keyboard
 * opens only dismisses the keyboard, so every "Submit" needs two taps — but it does **not** try to
 * move content out of the keyboard's way. RN's `KeyboardAvoidingView` behaves differently enough per
 * platform that a shared wrapper ends up as a pile of `Platform.select`, and
 * `react-native-keyboard-controller` (already a dependency) does it properly. That belongs to the
 * form layer, not to the screen frame.
 *
 * `automaticallyAdjustKeyboardInsets` is the one exception, and it is not the thing ruled out above.
 * It is a `ScrollView` prop, not a layout wrapper: iOS adds the keyboard's height to the scroll view's
 * own `contentInset`, which is the same mechanism that already keeps the last row of a list reachable
 * above the home indicator. Nothing moves, nothing re-layouts, and there is no platform branch to
 * write — Android resizes the window instead and the scroll view shrinks with it, and a browser scrolls
 * the focused input into view itself. The synchronised, animated, cross-platform version of this is
 * still `react-native-keyboard-controller`'s job; this is the floor that stops a focused field at the
 * bottom of a form being unreachable on iOS with no work from the caller at all.
 *
 * ## Why the inset padding is an inline object
 *
 * Inset values come from `useSafeAreaInsets()` at runtime, so padding that uses them cannot live in
 * the theme-keyed `createStyles` cache, which is memoised per theme and knows nothing about insets.
 * It is an inline object, rebuilt each render — acceptable because a `Screen` renders once per
 * navigation, not once per list row. The static parts (flex, background, the clamp) still go through
 * the sheet.
 */
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createStyles, useTheme } from '../theme';

import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

/**
 * The two backgrounds a screen legitimately takes. Never red and never arbitrary: a screen is white
 * by default and grey only to group — the design language's ~90%-neutral rule is enforced by there
 * being no third option.
 */
export type ScreenSurface = 'primary' | 'secondary';

interface ScreenProps {
  readonly children: ReactNode;
  /**
   * Wraps the content in a scroll view.
   *
   * Defaults to `false`, and the default is chosen for its failure mode rather than its frequency. A
   * screen that needed `scroll` and did not get it clips visibly the first time it is opened. A
   * virtualised list (`FlashList`) nested inside a `ScrollView` recycles nothing and degrades
   * silently — which at this app's target scale is the more expensive mistake. Prefer the failure you
   * can see.
   */
  readonly scroll?: boolean;
  /** Background surface. Defaults to `primary` (white); `secondary` for a grouped, panelled screen. */
  readonly surface?: ScreenSurface;
  /**
   * Applies the standard horizontal screen margin. Defaults to `true`. Set `false` for a full-bleed
   * screen — an edge-to-edge list or hero — that manages its own horizontal spacing; the landscape
   * notch insets are still honoured either way.
   */
  readonly padded?: boolean;
  /** Pads the top by the safe-area inset. Defaults to `true`; `false` when a header owns the top. */
  readonly safeTop?: boolean;
  /** Pads the bottom by the safe-area inset. Defaults to `true`; `false` when a tab bar owns the bottom. */
  readonly safeBottom?: boolean;
  /**
   * Extra style for the content column — the clamped, padded region — not the full-bleed frame.
   * Becomes the scroll content container's style when `scroll` is set. Token-only: `gap`, margins,
   * `justifyContent`.
   */
  readonly contentStyle?: StyleProp<ViewStyle>;
}

const useStyles = createStyles((t) => ({
  /** The full-bleed frame: fills the window and carries the background the content column sits on. */
  frame: { flex: 1 },
  surfacePrimary: { backgroundColor: t.colors.surface.primary },
  surfaceSecondary: { backgroundColor: t.colors.surface.secondary },

  /**
   * The content column for a non-scrolling screen. `flex: 1` so children can fill the height — an
   * error state centres itself, a list stretches.
   */
  column: {
    flex: 1,
    width: '100%',
    maxWidth: t.size.contentMaxWidth,
    alignSelf: 'center',
  },

  /**
   * The scroll content column. `flexGrow: 1` rather than `flex: 1`: short content then still fills
   * the viewport, so a centred empty state centres, while long content is free to exceed it. `flex: 1`
   * caps the container at the viewport height and defeats the scroll entirely.
   */
  scrollColumn: {
    flexGrow: 1,
    width: '100%',
    maxWidth: t.size.contentMaxWidth,
    alignSelf: 'center',
  },
}));

export function Screen({
  children,
  scroll = false,
  surface = 'primary',
  padded = true,
  safeTop = true,
  safeBottom = true,
  contentStyle,
}: ScreenProps) {
  const styles = useStyles();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const frameStyle: StyleProp<ViewStyle> = [
    styles.frame,
    surface === 'primary' ? styles.surfacePrimary : styles.surfaceSecondary,
    safeTop && { paddingTop: insets.top },
  ];

  // The margin is a token, the notch is a runtime inset, and the column needs both — hence the
  // addition rather than a `max`. `spacing.xl` (24) is the design language's screen margin.
  const gutter = padded ? theme.spacing.xl : 0;
  const columnInsets: ViewStyle = {
    paddingLeft: insets.left + gutter,
    paddingRight: insets.right + gutter,
    paddingBottom: safeBottom ? insets.bottom : 0,
  };

  if (scroll) {
    return (
      <View style={frameStyle}>
        <ScrollView
          style={styles.frame}
          contentContainerStyle={[styles.scrollColumn, columnInsets, contentStyle]}
          // Without this, the first tap after the keyboard opens is swallowed by the dismiss, so
          // every button below a focused field needs two taps. Set here so no form has to know.
          keyboardShouldPersistTaps="handled"
          // iOS-only, and a no-op elsewhere: the keyboard's height becomes scroll inset, so a field at
          // the bottom of a form can still be scrolled to while it is focused. See the docblock for why
          // this is not the keyboard avoidance that is deliberately absent.
          automaticallyAdjustKeyboardInsets
        >
          {children}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={frameStyle}>
      <View style={[styles.column, columnInsets, contentStyle]}>{children}</View>
    </View>
  );
}
