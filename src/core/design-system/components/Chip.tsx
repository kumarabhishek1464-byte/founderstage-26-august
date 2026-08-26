/**
 * `Chip` — a pill. Static as a label, tappable as an action, or toggleable as one answer in a
 * multi-select.
 *
 * ## Why selection is black and not red
 *
 * `action.primary` is the obvious fill for a selected chip and it is the wrong one twice over. The
 * design language reserves red as a *signal* and forbids it as a background, and a grid of eighteen
 * interests with six red ones is a screen where the accent has stopped meaning anything. It also fails
 * WCAG 1.4.1 on its own: a red border and a red label differ from the resting state by hue alone, so
 * selection is invisible to a user with a colour vision deficiency.
 *
 * `surface.inverse` (`#111111`) solves both. Black-on-white inverting to white-on-black is a
 * **luminance** difference, which every viewer perceives, and it leaves red for the one primary action
 * on the screen.
 *
 * ## Why nothing about selection changes the chip's size
 *
 * `borderWidth` stays at `hairline` and no glyph appears. Chips wrap, so a selected chip that grew by a
 * leading check would push its neighbour onto the next line and reshuffle the grid under the user's
 * finger — the tap that selects one chip moving the chip they were about to tap next. Inverting the fill
 * is the strongest available cue that costs no layout at all.
 *
 * ## Why the role is derived rather than passed
 *
 * ```
 * selected supplied   →  checkbox, with its checked state
 * onPress only        →  button
 * neither             →  no role; it is a label
 * ```
 *
 * A `role` prop would let a caller ship a chip announced as a button that does not respond, or a
 * checkbox with no state. The props that describe the behaviour are the same props that determine the
 * announcement, so the two cannot disagree.
 */
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { haptic } from '@/core/haptics';

import { usePressSpring } from '../hooks';
import { createStyles } from '../theme';
import { FocusRing } from './FocusRing';
import { Text } from './Text';

import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type { TypographyRole } from '../tokens';

/** `sm` for a dense decorative row, `md` for anything the user taps. */
export type ChipSize = 'sm' | 'md';

interface ChipProps {
  readonly label: string;
  /**
   * Supplying this — even as `false` — makes the chip a checkbox. Omit it for an action chip or a
   * static label.
   */
  readonly selected?: boolean;
  readonly onPress?: () => void;
  readonly size?: ChipSize;
  /**
   * A small accent mark before the label, for a chip that carries a live signal rather than a choice —
   * a role in the network, a status. Never combined with `selected`: an inverted chip with a red dot on
   * it is two signals competing in 40 points of space.
   */
  readonly dot?: boolean;
  readonly disabled?: boolean;
  readonly style?: StyleProp<ViewStyle>;
}

const useStyles = createStyles((t) => {
  const pill = {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: t.border.hairline,
    borderColor: t.colors.border.subtle,
    borderRadius: t.radius.full,
    backgroundColor: t.colors.surface.primary,
  } as const;

  return {
    // 32 and 40. `md` sits 8 under `size.touchTarget` and `hitSlop` makes up the rest, which is the
    // same trade `Button`'s `sm` and `IconButton`'s `md` make: quiet ink, full target.
    sm: { ...pill, minHeight: 32, paddingHorizontal: t.spacing.sm, gap: t.spacing.xxs },
    md: { ...pill, minHeight: 40, paddingHorizontal: t.spacing.md, gap: t.spacing.xs },

    hovered: { borderColor: t.colors.border.strong },
    pressed: { backgroundColor: t.colors.action.secondaryPressed },
    selected: {
      backgroundColor: t.colors.surface.inverse,
      borderColor: t.colors.surface.inverse,
    },
    // No `inversePressed` in the palette, and there should not be one for a single state: dimming the
    // whole pill is the same statement and it needs no new token.
    selectedPressed: { opacity: t.opacity.pressed },
    disabled: { opacity: t.opacity.disabled },

    /**
     * 6pt of accent. Sized as a literal because it is not a spacing decision — it is the smallest mark
     * that still reads as deliberate at 1x, and a token for it would be a token with one caller.
     */
    dot: {
      width: 6,
      height: 6,
      borderRadius: t.radius.full,
      backgroundColor: t.colors.action.primary,
    },
  };
});

/** Brings each size up to `size.touchTarget`. `md` is 40, `sm` is 32. */
const HIT_SLOP: Readonly<Record<ChipSize, number>> = {
  sm: 8,
  md: 4,
};

const LABEL_ROLE: Readonly<Record<ChipSize, TypographyRole>> = {
  sm: 'caption',
  md: 'subhead',
};

export function Chip({
  label,
  selected,
  onPress,
  size = 'md',
  dot = false,
  disabled = false,
  style,
}: ChipProps) {
  const styles = useStyles();
  const [isHovered, setHovered] = useState(false);
  const [isFocused, setFocused] = useState(false);

  const isToggle = selected !== undefined;
  const isSelected = selected ?? false;

  // The shared press spring — same physical response as `Button`, so a hero CTA and a filter chip
  // feel like siblings rather than distant relatives.
  const { animatedStyle, onPressIn, onPressOut } = usePressSpring({ disabled });

  const handlePress = useCallback(() => {
    // A toggle says which way it went; an action chip is just a tap. Same vocabulary as `Checkbox`.
    haptic(isToggle ? (isSelected ? 'toggleOff' : 'toggleOn') : 'tap');
    onPress?.();
  }, [isToggle, isSelected, onPress]);

  const body: ReactNode = (
    <>
      {dot && !isSelected ? <View style={styles.dot} /> : null}
      <Text
        variant={LABEL_ROLE[size]}
        tone={disabled ? 'disabled' : isSelected ? 'inverse' : 'heading'}
        numberOfLines={1}
      >
        {label}
      </Text>
    </>
  );

  if (onPress === undefined) {
    return <View style={[styles[size], isSelected && styles.selected, style]}>{body}</View>;
  }

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={handlePress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled}
        hitSlop={HIT_SLOP[size]}
        onHoverIn={() => {
          setHovered(true);
        }}
        onHoverOut={() => {
          setHovered(false);
        }}
        onFocus={() => {
          setFocused(true);
        }}
        onBlur={() => {
          setFocused(false);
        }}
        style={({ pressed }) => [
          styles[size],
          isHovered && !isSelected && !disabled && styles.hovered,
          pressed && !isSelected && styles.pressed,
          isSelected && styles.selected,
          pressed && isSelected && styles.selectedPressed,
          disabled && styles.disabled,
          style,
        ]}
        accessibilityRole={isToggle ? 'checkbox' : 'button'}
        accessibilityLabel={label}
        accessibilityState={isToggle ? { checked: isSelected, disabled } : { disabled }}
      >
        {body}
        <FocusRing visible={isFocused && !disabled} radius="full" />
      </Pressable>
    </Animated.View>
  );
}
