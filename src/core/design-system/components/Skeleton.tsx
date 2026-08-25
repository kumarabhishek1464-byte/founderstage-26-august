/**
 * `Skeleton` — the first-load placeholder. The design language is explicit that a first load shows
 * a skeleton, never a blank white screen and never a spinner, so this is the component that makes
 * that possible everywhere rather than a per-screen decision.
 *
 * ## A pulse, not a sweeping sheen
 *
 * The fashionable skeleton has a diagonal highlight travelling across it. This one fades between two
 * neutrals (`overlay.skeleton` → `overlay.skeletonSheen`) in place.
 *
 * A travelling sheen needs a gradient (so `expo-linear-gradient`, a dependency), a mask or an
 * overflow-clipped absolutely-positioned child, and a transform animation per placeholder. On a list
 * of twenty rows that is twenty gradients compositing every frame. The pulse is one animated
 * `backgroundColor`, it costs a dependency of nothing, and against this palette the difference is
 * genuinely hard to see: a sheen needs contrast to read, and there is 3% between these two greys by
 * design — a skeleton must not look like content.
 *
 * ## Reduced motion is honoured, and the shape still shows
 *
 * With "Reduce Motion" on, the animation does not run and the placeholder sits at its base colour.
 * It does **not** become invisible: the layout it reserves is the actual information a skeleton
 * carries, and only the pulse is decoration. A user who has asked for less motion still needs to
 * know how much content is coming.
 *
 * ## Deliberately not: an `isLoading` prop
 *
 * A `<Skeleton isLoading>{children}</Skeleton>` wrapper is a tempting API and a bad one — it renders
 * the real subtree's props on every skeleton frame and couples the placeholder's shape to the
 * content's. Callers branch instead (`if (isPending) return <AccountSkeleton />`), which is the shape
 * [Rule 2](../../../../CLAUDE.md) already shows.
 */
import { useEffect } from 'react';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { HIDDEN_FROM_ASSISTIVE_TECH } from '../a11y';
import { createStyles, useTheme } from '../theme';

import type { DimensionValue, StyleProp, ViewStyle } from 'react-native';

export type SkeletonRadius = 'sm' | 'md' | 'lg' | 'full';

interface SkeletonProps {
  /**
   * A number (points) or a percentage string. Percentages are the common case for text lines — a
   * last line at `'60%'` is what makes a stack of bars read as a paragraph rather than a table.
   */
  readonly width?: DimensionValue;
  readonly height?: DimensionValue;
  /** Defaults to `sm`. `full` for a circular avatar — pair with equal width and height. */
  readonly radius?: SkeletonRadius;
  /** Token-only layout escape hatch — margins, `flex`. */
  readonly style?: StyleProp<ViewStyle>;
}

const useStyles = createStyles((t) => ({
  base: { backgroundColor: t.colors.overlay.skeleton },
  radiusSm: { borderRadius: t.radius.sm },
  radiusMd: { borderRadius: t.radius.md },
  radiusLg: { borderRadius: t.radius.lg },
  radiusFull: { borderRadius: t.radius.full },
}));

type SheetKey = keyof ReturnType<typeof useStyles>;

const RADIUS_STYLE: Readonly<Record<SkeletonRadius, SheetKey>> = {
  sm: 'radiusSm',
  md: 'radiusMd',
  lg: 'radiusLg',
  full: 'radiusFull',
};

export function Skeleton({ width = '100%', height = 16, radius = 'sm', style }: SkeletonProps) {
  const theme = useTheme();
  const styles = useStyles();
  const reducedMotion = useReducedMotion();

  // The two neutrals the pulse fades between, read on the JS thread. Passed into the worklet as
  // plain strings rather than reached through `theme` inside it, so the worklet does not capture the
  // whole theme object across the JS/UI boundary.
  const base = theme.colors.overlay.skeleton;
  const sheen = theme.colors.overlay.skeletonSheen;

  // 0 → 1 drives the fade between the two neutrals. A shared value rather than React state: the
  // whole animation then lives on the UI thread and a busy JS thread — which is exactly what is
  // happening during a first load — cannot stutter it.
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      // Pinned to the base colour rather than left wherever the animation stopped, so a mid-pulse
      // toggle of the OS setting does not strand the placeholder at an arbitrary grey.
      progress.value = 0;
      return;
    }

    progress.value = withRepeat(
      withTiming(1, {
        duration: theme.motion.loop.skeletonPulse,
        easing: Easing.bezier(...theme.motion.easing.standard),
      }),
      // -1 repeats forever; `true` reverses each cycle, so the fade back is animated too rather
      // than snapping to the start colour.
      -1,
      true
    );

    // Reanimated cancels the animation when the shared value is collected, but an explicit reset
    // on unmount keeps the value defined if this component remounts against the same instance.
    return () => {
      progress.value = 0;
    };
  }, [progress, reducedMotion, theme]);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [base, sheen]),
  }));

  return (
    <Animated.View
      style={[styles.base, styles[RADIUS_STYLE[radius]], { width, height }, animatedStyle, style]}
      // A skeleton announces the wait once, at the container level, not once per bar — twelve
      // placeholders each saying "Loading" is unusable. The screen's loading state owns that.
      {...HIDDEN_FROM_ASSISTIVE_TECH}
    />
  );
}
