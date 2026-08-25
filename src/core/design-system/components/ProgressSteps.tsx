/**
 * `ProgressSteps` — where the user is in a multi-step flow, as one segment per step.
 *
 * ## Why segments and not dots
 *
 * Dots say "there are four of these"; segments say "you are three quarters of the way through", because
 * a filled segment has *width* and width reads as distance covered. On a four-step onboarding the
 * difference is the difference between a user who knows the end is close and one who does not.
 *
 * Each segment is `border.marker` tall, which is the token for exactly this — "a stroke that is meant to
 * be read as a mark rather than as a boundary". At two points it is closer to a rule than to a bar,
 * which is what keeps a progress indicator from becoming the loudest thing above a form.
 *
 * ## Why `current` is 1-based
 *
 * It is read by people, not indexed into: "Step 1 of 4" is what the screen says and what the
 * `accessibilityLabel` announces, so a 0-based prop would mean every call site doing `step - 1` and one
 * of them eventually not.
 *
 * The label matters more than it looks. `accessibilityValue` alone gives VoiceOver a percentage — "75
 * percent" — which is true and useless on a form. The label is what makes it "Step 3 of 4".
 */
import { View } from 'react-native';

import { createStyles } from '../theme';

import type { StyleProp, ViewStyle } from 'react-native';

interface ProgressStepsProps {
  readonly total: number;
  /** 1-based, and clamped: a caller that walks past the end still renders a full bar, not an empty one. */
  readonly current: number;
  readonly style?: StyleProp<ViewStyle>;
}

const useStyles = createStyles((t) => ({
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xxs,
  },
  /**
   * `flex: 1` on every segment, so four steps and six steps both span the full width and the segment
   * length itself carries the step count. A fixed width would leave a ragged right edge that reads as a
   * layout bug.
   */
  segment: {
    flex: 1,
    height: t.border.marker,
    borderRadius: t.radius.full,
    backgroundColor: t.colors.border.strong,
  },
  /**
   * `#E53935` on white measures ~3.6:1, which clears WCAG 1.4.11's 3:1 floor for a graphic that carries
   * information. The unfilled track is `border.strong` rather than `border.subtle` for the same reason:
   * how many steps remain is information, and `#EAEAEA` at two points is not reliably visible.
   */
  segmentFilled: { backgroundColor: t.colors.action.primary },
}));

export function ProgressSteps({ total, current, style }: ProgressStepsProps) {
  const styles = useStyles();

  const steps = Math.max(1, Math.floor(total));
  const reached = Math.min(Math.max(1, Math.floor(current)), steps);

  return (
    <View
      style={[styles.track, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${String(reached)} of ${String(steps)}`}
      accessibilityValue={{ min: 1, max: steps, now: reached }}
    >
      {Array.from({ length: steps }, (_unused, index) => (
        <View
          // The index *is* the identity here: segment 3 is always segment 3, and the list is never
          // reordered or filtered. This is the case the key-as-index warning does not apply to.
          key={index}
          style={[styles.segment, index < reached && styles.segmentFilled]}
        />
      ))}
    </View>
  );
}
