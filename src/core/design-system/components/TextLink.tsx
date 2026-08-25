/**
 * `TextLink` — a navigation the user reads as text rather than as a control: "Forgot password?",
 * "Sign up", "See more".
 *
 * ## Why it is a link and not a `Button variant="tertiary"`
 *
 * Visually the two are close, and the announcement is not. `accessibilityRole="link"` tells a
 * screen-reader user "this takes you somewhere", `button` tells them "this does something here", and on
 * web the role is what puts the target in the browser's links list. A tertiary button also carries
 * `Button`'s 40pt minimum height and its horizontal padding, which is wrong inside a sentence — the
 * gap it opens above and below makes the line it sits in look broken.
 *
 * ## Why the default weight is semibold
 *
 * A red link on white differs from the prose around it by hue alone, and hue alone fails WCAG 1.4.1 for
 * the ~8% of men who cannot separate `#E53935` from `#444444`. `label` (15/20 semibold) is the default
 * variant so the link is also *heavier* than its surroundings — a cue that survives any colour vision.
 * `underline` is there for a link genuinely embedded mid-sentence, where weight alone is still ambiguous.
 *
 * ## Deliberately not: an `href`
 *
 * `expo-router` is unreachable from `src/core` — `dependency-cruiser` forbids it outside
 * `src/core/navigation` — and that is the right constraint: a design-system primitive that knew about
 * routes would be unusable in any other app and untestable without a router. The caller passes
 * `onPress`, and the caller is the one that knows where it goes.
 */
import { useCallback, useState } from 'react';
import { Pressable } from 'react-native';

import { haptic } from '@/core/haptics';

import { createStyles } from '../theme';
import { FocusRing } from './FocusRing';
import { Text } from './Text';

import type { StyleProp, ViewStyle } from 'react-native';
import type { TypographyRole } from '../tokens';
import type { Tone } from './tone';

interface TextLinkProps {
  readonly label: string;
  readonly onPress: () => void;
  /** Defaults to `label` (semibold) — see the note on weight above. */
  readonly variant?: TypographyRole;
  /** Defaults to `accent`. `secondary` for a link that should not compete with the screen's action. */
  readonly tone?: Tone;
  /** For a link inside a running sentence, where weight and colour alone read as emphasis. */
  readonly underline?: boolean;
  readonly disabled?: boolean;
  readonly accessibilityHint?: string;
  readonly style?: StyleProp<ViewStyle>;
}

const useStyles = createStyles((t) => ({
  /** `flex-start` so a link in a column hugs its text instead of stretching to the column's width. */
  frame: { alignSelf: 'flex-start' },
  pressed: { opacity: t.opacity.pressed },
  disabled: { opacity: t.opacity.disabled },
  underline: { textDecorationLine: 'underline' },
}));

/** 8 each way. A one-line link is ~20pt tall, so this clears the 36pt a thumb needs in running text. */
const HIT_SLOP = 8;

export function TextLink({
  label,
  onPress,
  variant = 'label',
  tone = 'accent',
  underline = false,
  disabled = false,
  accessibilityHint,
  style,
}: TextLinkProps) {
  const styles = useStyles();
  const [isFocused, setFocused] = useState(false);

  const handlePress = useCallback(() => {
    haptic('tap');
    onPress();
  }, [onPress]);

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      hitSlop={HIT_SLOP}
      onFocus={() => {
        setFocused(true);
      }}
      onBlur={() => {
        setFocused(false);
      }}
      style={({ pressed }) => [
        styles.frame,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
    >
      <Text
        variant={variant}
        tone={disabled ? 'disabled' : tone}
        style={underline ? styles.underline : undefined}
      >
        {label}
      </Text>
      <FocusRing visible={isFocused && !disabled} radius="md" />
    </Pressable>
  );
}
