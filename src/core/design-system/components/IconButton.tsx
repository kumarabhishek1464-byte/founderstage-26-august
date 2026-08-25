/**
 * `IconButton` — a control whose entire label is a glyph.
 *
 * This is the component `Button`'s own docblock points at: an icon-only control is not `Button` with
 * an empty label, it is a different contract. The difference is one required prop.
 * `accessibilityLabel` is **not optional here**, because there is no visible text to fall back on —
 * an unlabelled icon button is announced as "button" and a screen-reader user has to guess. Making it
 * required means that failure cannot compile.
 *
 * The other difference is shape. `Button` is a rounded rectangle sized by its text; this is a circle
 * sized by the touch target, and the circle is what lets it sit in a header row without introducing a
 * second rectangle competing with the content below.
 *
 * ## Three states, three different reasons
 *
 * ```
 * hovered   surface.secondary        pointer is here            web only
 * pressed   action.tertiaryPressed   finger/mouse is down       everywhere
 * focused   a FocusRing              keyboard is here           web, and iPad with a keyboard
 * ```
 *
 * They are three separate signals rather than one "highlighted" style because they answer different
 * questions and can be true at once — a keyboard user who then clicks is focused *and* pressed. Hover
 * is the lighter of the two fills on purpose: the pointer merely passing over a control should be a
 * weaker statement than a finger committing to it.
 *
 * `onHoverIn`/`onHoverOut` are no-ops on native rather than a platform branch — React Native declares
 * them on `Pressable` and only `react-native-web` ever fires them, so the state simply never becomes
 * true on a phone.
 */
import { useCallback, useState } from 'react';
import { Pressable } from 'react-native';

import { haptic } from '@/core/haptics';

import { createStyles } from '../theme';
import { FocusRing } from './FocusRing';
import { Icon } from './Icon';

import type { GestureResponderEvent, StyleProp, ViewStyle } from 'react-native';
import type { IconName, IconSize } from './Icon';
import type { Tone } from './tone';

/**
 * `md` is 40 and `lg` is the full `size.touchTarget`. `md` therefore needs `hitSlop` to reach the
 * accessibility floor, which is the same trade `Button` makes for its `sm`: the ink stays small
 * because the design language asks for quiet controls, and the tap area does not.
 */
export type IconButtonSize = 'md' | 'lg';

interface IconButtonProps {
  readonly name: IconName;
  /**
   * What the control *does*, not what the glyph *is*: "Notifications", never "Bell". Required — see
   * the note at the top of this file.
   */
  readonly accessibilityLabel: string;
  readonly onPress?: () => void;
  readonly size?: IconButtonSize;
  /** Defaults to `secondary`: a header action is available, not insistent. */
  readonly tone?: Tone;
  readonly disabled?: boolean;
  /** For a consequence the label cannot carry — "Opens in your browser". */
  readonly accessibilityHint?: string;
  readonly style?: StyleProp<ViewStyle>;
}

const GLYPH_SIZE: Readonly<Record<IconButtonSize, IconSize>> = {
  md: 'md',
  lg: 'lg',
};

const useStyles = createStyles((t) => {
  const circle = {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: t.radius.full,
  } as const;

  return {
    // 40, the same box `Button`'s `sm` uses for its height, so an icon button and a small button
    // sitting in one row are the same size. Written as a literal for the same reason `Button`'s
    // heights are: `src/core/design-system/**` is where the numbers are allowed to live.
    md: { ...circle, width: 40, height: 40 },
    lg: { ...circle, width: t.size.touchTarget, height: t.size.touchTarget },

    hovered: { backgroundColor: t.colors.surface.secondary },
    pressed: { backgroundColor: t.colors.action.tertiaryPressed },
    disabled: { opacity: t.opacity.disabled },
  };
});

/**
 * The slop that brings each size up to `size.touchTarget`. Stated as a table rather than computed, so
 * the intended tap area of each size is readable in one place — and so `lg`'s zero is explicit rather
 * than a coincidence of arithmetic.
 */
const HIT_SLOP: Readonly<Record<IconButtonSize, number>> = {
  md: 4,
  lg: 0,
};

export function IconButton({
  name,
  accessibilityLabel,
  onPress,
  size = 'md',
  tone = 'secondary',
  disabled = false,
  accessibilityHint,
  style,
}: IconButtonProps) {
  const styles = useStyles();
  const [isHovered, setHovered] = useState(false);
  const [isFocused, setFocused] = useState(false);

  const handlePress = useCallback(
    (_event: GestureResponderEvent) => {
      // Fired here rather than left to the caller, so the app's touch feel is a property of the
      // component and not of whoever wrote the screen — the same reason `Button` does it.
      haptic('tap');
      onPress?.();
    },
    [onPress]
  );

  return (
    <Pressable
      onPress={handlePress}
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
        // Hover before press, so a pointer that is both hovering and pressing shows the stronger fill.
        isHovered && !disabled && styles.hovered,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
    >
      <Icon name={name} size={GLYPH_SIZE[size]} tone={disabled ? 'disabled' : tone} />
      <FocusRing visible={isFocused && !disabled} radius="full" />
    </Pressable>
  );
}
