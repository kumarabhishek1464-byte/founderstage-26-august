/**
 * `Marquee` — a row of content drifting sideways, forever.
 *
 * ## Why this exists at all, given the design language
 *
 * "No glassmorphism, no gradients as decoration, no playful illustration" is a rule about *ornament*,
 * and a signed-out hero has a real job that ornament cannot do: show that there is a network on the
 * other side of the button. A static grid of names says the same thing less well, because a grid reads
 * as a table of contents and slow drift reads as *activity*. This is the one place motion is content.
 *
 * It is also all this codebase can honestly build: `assets/` has no member photography, so the
 * reference's collage of faces is not on the table. Named pills that drift are.
 *
 * ## Why `Easing.linear` and not a motion token
 *
 * Every curve in `motion.easing` accelerates or decelerates, which is right for a thing that starts and
 * stops. A marquee never stops — an eased loop slows to a crawl at each seam and then speeds up, so the
 * "endless" row visibly pulses once per cycle. Linear is the only correct curve here, and it is written
 * as `Easing.linear` rather than added to the token file because a house style should not advertise a
 * curve that is wrong for every animation with an end.
 *
 * `speed` is points per second rather than a duration for the same reason: at a fixed duration a row of
 * four pills and a row of twelve drift at wildly different rates, and three rows on one screen moving at
 * three speeds looks like a bug. Speed is the property that has to match; duration is derived from it.
 *
 * ## Why the children are rendered more than twice
 *
 * The seam is hidden by translating exactly one content-width and having the next copy land where the
 * last one was. Two copies is enough only while the content is wider than the frame; a narrow row would
 * leave a visible empty gap on every cycle. Both widths are measured, so the copy count is whatever
 * covers the frame plus one — which is two in the common case and correct in the others.
 *
 * Only the first copy is measured and only the first is visible to assistive technology: the rest are the
 * same strings again, and a screen reader reading the network three times is worse than not reading it.
 * The duplicates are also inert, so nothing interactive should be put in here — a control that responds
 * in one copy and not the others is the kind of bug nobody reproduces.
 *
 * ## Reduced motion
 *
 * One static copy, clipped by the same frame. The content is the point and the drift is the decoration,
 * so the decoration is what goes — the same trade [`Skeleton`](./Skeleton.tsx) makes with its pulse.
 */
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { createStyles } from '../theme';

import type { ReactNode } from 'react';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';

export type MarqueeDirection = 'left' | 'right';

interface MarqueeProps {
  readonly children: ReactNode;
  /** Defaults to `left`. Alternating direction between stacked rows is what stops them reading as one block. */
  readonly direction?: MarqueeDirection;
  /** Points per second. Defaults to a deliberately slow drift — see the note on speed above. */
  readonly speed?: number;
  readonly style?: StyleProp<ViewStyle>;
}

const useStyles = createStyles(() => ({
  /** The clip. Without it the row spills across the whole screen and every parent's padding is a lie. */
  frame: { overflow: 'hidden' },
  /**
   * `flex-start` so the row takes its content's width instead of the frame's. In a column parent the
   * default is `stretch`, which would pin the row to the frame width and make the drift impossible.
   */
  row: { flexDirection: 'row', alignSelf: 'flex-start' },
}));

/**
 * 20pt per second: a 400pt row crosses in twenty seconds. Slow enough to read a pill in passing, fast
 * enough that the screen is visibly alive rather than mid-render.
 */
const DEFAULT_SPEED = 20;

export function Marquee({
  children,
  direction = 'left',
  speed = DEFAULT_SPEED,
  style,
}: MarqueeProps) {
  const styles = useStyles();
  const reducedMotion = useReducedMotion();

  const [frameWidth, setFrameWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);

  // 0 → 1 across one content-width of travel. A shared value, so the whole loop runs on the UI thread
  // and stays smooth while JS is busy — which on a signed-out screen it will be, hydrating the session.
  const progress = useSharedValue(0);

  const handleFrameLayout = useCallback((event: LayoutChangeEvent) => {
    setFrameWidth(event.nativeEvent.layout.width);
  }, []);

  const handleContentLayout = useCallback((event: LayoutChangeEvent) => {
    setContentWidth(event.nativeEvent.layout.width);
  }, []);

  const measured = contentWidth > 0;
  const copies = measured && frameWidth > 0 ? Math.ceil(frameWidth / contentWidth) + 1 : 2;
  const goingLeft = direction === 'left';

  useEffect(() => {
    if (reducedMotion || !measured) {
      progress.value = 0;
      return;
    }

    progress.value = withRepeat(
      withTiming(1, {
        duration: (contentWidth / speed) * 1000,
        easing: Easing.linear,
      }),
      // -1 forever, and `false` so it never reverses: a marquee that ran backwards on alternate cycles
      // would be a pendulum, which is a different thing and a distracting one.
      -1,
      false
    );

    return () => {
      progress.value = 0;
    };
  }, [progress, reducedMotion, measured, contentWidth, speed]);

  const animatedStyle = useAnimatedStyle(() => {
    const travelled = progress.value * contentWidth;
    // Leftward is 0 → -width. Rightward is the same journey read backwards, starting one content-width
    // out so there is always a copy covering the left edge.
    return { transform: [{ translateX: goingLeft ? -travelled : travelled - contentWidth }] };
  });

  if (reducedMotion) {
    return (
      <View style={[styles.frame, style]}>
        <View style={styles.row}>{children}</View>
      </View>
    );
  }

  return (
    <View style={[styles.frame, style]} onLayout={handleFrameLayout}>
      <Animated.View style={[styles.row, animatedStyle]}>
        {Array.from({ length: copies }, (_unused, index) =>
          index === 0 ? (
            // The measured, announced, real copy.
            <View key={index} onLayout={handleContentLayout} style={styles.row}>
              {children}
            </View>
          ) : (
            <View
              key={index}
              style={styles.row}
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {children}
            </View>
          )
        )}
      </Animated.View>
    </View>
  );
}
