/**
 * `TypingIndicator` — the "X is typing…" affordance that sits between the last message and the
 * composer.
 *
 * ## Why an animation rather than a static line
 *
 * The reference draws the indicator as three accent-tinted dots that pulse, and that pulse is the
 * signal — a static "typing…" line reads as a stale label. Reanimated worklets drive the three
 * dots so the animation runs on the UI thread and does not stutter under scroll.
 *
 * ## Rendered only when there is a name
 *
 * The parent decides who is typing (from a realtime channel, in future). This component just
 * renders — a null name renders nothing. That way the parent can flip visibility without a mount
 * cycle.
 */
import { useEffect } from 'react';

import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Stack, Text, createStyles, useTheme } from '@/core/design-system';

interface TypingIndicatorProps {
  readonly name: string | null;
}

const useStyles = createStyles((t) => ({
  wrap: {
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: t.radius.full,
    backgroundColor: t.colors.text.accent,
  },
}));

export function TypingIndicator({ name }: TypingIndicatorProps) {
  const styles = useStyles();
  const theme = useTheme();

  const opacity1 = useSharedValue<number>(theme.opacity.disabled);
  const opacity2 = useSharedValue<number>(theme.opacity.disabled);
  const opacity3 = useSharedValue<number>(theme.opacity.disabled);

  useEffect(() => {
    if (name === null) return;
    const cycle = () =>
      withRepeat(
        withSequence(
          withTiming(1, { duration: 300, easing: Easing.out(Easing.ease) }),
          withTiming(theme.opacity.disabled, { duration: 300, easing: Easing.in(Easing.ease) })
        ),
        -1,
        false
      );
    opacity1.value = cycle();
    opacity2.value = withDelay(140, cycle());
    opacity3.value = withDelay(280, cycle());
  }, [name, opacity1, opacity2, opacity3, theme.opacity.disabled]);

  const dot1 = useAnimatedStyle(() => ({ opacity: opacity1.value }));
  const dot2 = useAnimatedStyle(() => ({ opacity: opacity2.value }));
  const dot3 = useAnimatedStyle(() => ({ opacity: opacity3.value }));

  if (name === null) return null;

  return (
    <Stack direction="row" align="center" gap="xs" style={styles.wrap}>
      <Stack direction="row" gap="xxs" align="center">
        <Animated.View style={[styles.dot, dot1]} />
        <Animated.View style={[styles.dot, dot2]} />
        <Animated.View style={[styles.dot, dot3]} />
      </Stack>
      <Text variant="caption" tone="secondary">
        {`${name} is typing...`}
      </Text>
    </Stack>
  );
}
