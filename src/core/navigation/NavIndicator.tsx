/**
 * `NavIndicator` — the red segment that sits on the navigation chrome's own hairline.
 *
 * The whole design thesis of this shell in one component. Every navigation bar has a divider; this
 * one is `#EAEAEA` along its entire length except for 24 × 2 of `#E53935` underneath the destination
 * you are on, and that segment slides when you move. Nothing else in the chrome is red, no tab has a
 * pill or a fill behind it, and the design language's rule that red is a signal rather than a
 * surface is kept literally: the signal is two pixels tall.
 *
 * Active and inactive tabs are still distinguished without it — `#111111` against `#8A8A8A` is a
 * difference in *value*, so it survives greyscale, colour-vision deficiency and a sunlit screen. The
 * mark is the confirmation, not the only carrier. That ordering is what lets it be this quiet.
 *
 * ## Why the animation is React Native's `Animated` and not Reanimated
 *
 * This was written with Reanimated first, and it does not work on Expo Web in this SDK: measured in
 * the rendered DOM, `useAnimatedStyle`'s value is committed once during the React render that mounts
 * the node and then never again. Assigning `sharedValue.value` — with `withSpring` *or* with a plain
 * number — leaves the element's inline `transform` frozen at the mount value while the shared value
 * itself reads back correctly. The mark landed on the right tab on a cold load and then stayed there
 * for every subsequent navigation.
 *
 * `Animated` from `react-native` has no second thread to lose an update to: `react-native-web`
 * implements it on `requestAnimationFrame`, and the same code drives the native platforms through
 * the native driver. The spring tokens transfer unchanged, because `damping`/`stiffness`/`mass` is
 * the same physical model both libraries take.
 *
 * Reanimated stays the right tool for anything a finger drives, where a UI-thread worklet is the
 * whole point. This is a 24pt slide triggered by a route change — there is no gesture to stay in
 * step with, and correctness on all three platforms is worth more than a thread hop.
 *
 * ## Why it sits on the hairline rather than above it
 *
 * The chrome's border occupies the top 1pt of the bar. A mark drawn *below* the border would be a
 * second horizontal line, and the bar would read as having two rules. Drawn at `-border.hairline` it
 * spans y ∈ [-1, 1] in the coordinate space whose origin is just under the border, so its 2pt
 * straddles the border's 1pt: one line, locally thicker and red. React Native's default
 * `overflow: 'visible'` is what makes the negative offset survive on iOS, Android and web alike.
 *
 * This requires its parent to have **no padding and no border of its own**, because an absolutely
 * positioned child is laid out against the padding box — `top: 0` would land inside the padding and
 * below the border, not at the parent's outer edge. `TabBar` and `SideRail` both give it a bare
 * coordinate parent for exactly that reason.
 *
 * ## Why offsets are passed in rather than measured
 *
 * `onLayout` on the active item would work and would cost a frame: the mark would render at 0, then
 * jump. The bar's geometry is arithmetic — five equal slots in a known width — so the caller
 * computes the offset and the mark is correct on its first paint, including on the web where the
 * first paint is what a page-load screenshot captures.
 */
import { useEffect, useState } from 'react';
import { Animated, Platform } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { HIDDEN_FROM_ASSISTIVE_TECH } from '../design-system/a11y';
import { createStyles, useTheme } from '../design-system/theme';

/** `x` for the bottom bar's horizontal travel, `y` for the desktop rail's vertical travel. */
export type NavIndicatorAxis = 'x' | 'y';

interface NavIndicatorProps {
  readonly axis: NavIndicatorAxis;
  /** Distance from the coordinate parent's leading edge, in points. */
  readonly offset: number;
}

/**
 * `react-native-web` runs every animation on the JS thread, so asking for the native driver there is
 * a request it can only warn about. Transforms are natively drivable on iOS and Android, which is
 * where the request means something.
 */
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

const useStyles = createStyles((t) => {
  const mark = {
    position: 'absolute',
    backgroundColor: t.colors.action.primary,
    // In the style, not as a prop: the `pointerEvents` prop is deprecated and `react-native-web` logs
    // it on every render.
    pointerEvents: 'none',
  } as const;

  return {
    // Horizontal: `navMark` long, `marker` thick, lifted onto the top border.
    x: {
      ...mark,
      top: -t.border.hairline,
      left: 0,
      width: t.size.navMark,
      height: t.border.marker,
    },
    // Vertical: the same segment rotated onto the rail's right border.
    y: {
      ...mark,
      top: 0,
      right: -t.border.hairline,
      width: t.border.marker,
      height: t.size.navMark,
    },
  };
});

export function NavIndicator({ axis, offset }: NavIndicatorProps) {
  const styles = useStyles();
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  // Seeded with the current offset so the mark is in the right place on mount rather than travelling
  // there from zero the first time the shell appears.
  //
  // `useAnimatedValue` would read better and is in React Native's TypeScript types — but it is absent
  // from `react-native-web` 0.21, so the call type-checks and then throws `is not a function` in the
  // browser, taking the whole tab bar down with it.
  //
  // `useState` with no setter rather than `useRef(...).current`, because `react-hooks/refs` rejects
  // reading `.current` during render and is right to in general — a ref read in render is invisible to
  // React. Here the value is a mutable object that is never *replaced*, only mutated by the animation,
  // so state's guarantee that the identity is stable across renders is exactly the guarantee wanted.
  // The lazy initialiser also matters: `useRef(new Animated.Value(offset))` constructs a throwaway
  // `Animated.Value` on every render, and this constructs one.
  const [position] = useState(() => new Animated.Value(offset));

  useEffect(() => {
    if (reducedMotion) {
      // The mark still moves — it has to, it is the position readout — it just stops sliding, which
      // is the part the setting is about.
      position.setValue(offset);
      return;
    }

    const animation = Animated.spring(position, {
      toValue: offset,
      ...theme.motion.spring.snappy,
      useNativeDriver: USE_NATIVE_DRIVER,
    });

    animation.start();

    // Stopped rather than left running, so a fast run along the bar hands the next spring a live
    // position instead of two animations fighting over one value.
    return () => {
      animation.stop();
    };
  }, [offset, position, reducedMotion, theme.motion.spring.snappy]);

  return (
    <Animated.View
      style={[
        styles[axis],
        { transform: [axis === 'x' ? { translateX: position } : { translateY: position }] },
      ]}
      // Decoration with no independent meaning: the selected state is already on each tab's
      // `accessibilityState`, so announcing this would be the same fact a second time in a form a
      // screen-reader user cannot act on.
      {...HIDDEN_FROM_ASSISTIVE_TECH}
    />
  );
}
