/**
 * `Checkbox` — a single boolean the user sets, with its label as part of the control.
 *
 * ## Why the label is inside the touch target
 *
 * A 20pt box beside an unrelated line of text is the version everyone has met and nobody can hit. One
 * `Pressable` wrapping the box and the label makes the whole line the control, which is both the larger
 * target and the correct accessibility tree: one element, announced as "I agree to the terms of use,
 * checkbox, not checked", rather than a checkbox with no name sitting next to some prose.
 *
 * That is also why `label` is a `string` and not `ReactNode`. A terms checkbox wants a tappable link
 * inside its sentence, and nesting a link inside a checkbox is a genuinely broken control: the outer
 * `Pressable` swallows the inner one on iOS, and where it does not, tapping "privacy policy" toggles the
 * checkbox as well as navigating. The screen that needs it renders the checkbox with a short label and
 * the linked sentence beneath — two controls, two jobs — which is what `signup` does.
 *
 * ## The box does not reflow
 *
 * Checked is a fill and a glyph, not a thicker border: `borderWidth` stays at `hairline` in both states
 * so the label beside it never shifts by a point when the box is ticked.
 */
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { haptic } from '@/core/haptics';

import { createStyles } from '../theme';
import { FocusRing } from './FocusRing';
import { Icon } from './Icon';
import { Text } from './Text';

import type { StyleProp, ViewStyle } from 'react-native';

interface CheckboxProps {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  /** The sentence the box answers. Phrased so that "checked" means yes: "I agree…", never "Don't send…". */
  readonly label: string;
  /** A second, quieter line under the label — a consequence, a clarification. */
  readonly description?: string;
  /** A validation message. Turns the box red and adds the error line, same vocabulary as a field. */
  readonly error?: string;
  readonly disabled?: boolean;
  readonly style?: StyleProp<ViewStyle>;
}

const useStyles = createStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.sm,
    // The row is shorter than the touch floor on its own; `hitSlop` below makes up the difference
    // rather than padding, which would push the label away from the box.
    minHeight: t.spacing.xl,
  },

  /**
   * 20 — `size.iconMd`, so the box matches the optical weight of an icon on the same line rather than
   * being a fourth square size in the system.
   */
  box: {
    width: t.size.iconMd,
    height: t.size.iconMd,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: t.border.hairline,
    borderColor: t.colors.border.strong,
    borderRadius: t.radius.xs,
    backgroundColor: t.colors.surface.primary,
    // Aligns the box's centre with the first line's cap height instead of its top edge, which is what
    // makes a two-line label look attached to the box rather than hanging off it.
    marginTop: t.border.hairline,
  },
  boxChecked: {
    backgroundColor: t.colors.action.primary,
    borderColor: t.colors.action.primary,
  },
  boxCheckedPressed: {
    backgroundColor: t.colors.action.primaryPressed,
    borderColor: t.colors.action.primaryPressed,
  },
  boxInvalid: { borderColor: t.colors.status.error },
  boxHovered: { borderColor: t.colors.text.heading },
  boxPressed: { backgroundColor: t.colors.action.secondaryPressed },

  copy: { flex: 1, gap: t.spacing.xxs },
  disabled: { opacity: t.opacity.disabled },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xxs,
    marginTop: t.spacing.xxs,
  },
  errorText: { flex: 1 },
}));

/** Brings the 24pt row up to `size.touchTarget`. */
const HIT_SLOP = 12;

export function Checkbox({
  checked,
  onChange,
  label,
  description,
  error,
  disabled = false,
  style,
}: CheckboxProps) {
  const styles = useStyles();
  const [isHovered, setHovered] = useState(false);
  const [isFocused, setFocused] = useState(false);

  const invalid = error !== undefined && error.length > 0;

  const toggle = useCallback(() => {
    // Two sounds rather than one, because the direction is the information: a user who cannot see the
    // box still knows whether they just agreed or just withdrew.
    haptic(checked ? 'toggleOff' : 'toggleOn');
    onChange(!checked);
  }, [checked, onChange]);

  return (
    <View style={style}>
      <Pressable
        onPress={toggle}
        disabled={disabled}
        hitSlop={HIT_SLOP}
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
        style={[styles.row, disabled && styles.disabled]}
        accessibilityRole="checkbox"
        // The role and the state together are what a screen reader turns into "checked" / "not
        // checked". The role alone announces a checkbox whose value is anyone's guess.
        accessibilityState={{ checked, disabled }}
        accessibilityLabel={label}
        // The description is inside the collapsed element on iOS, so it would otherwise be lost.
        accessibilityHint={invalid ? error : description}
      >
        {({ pressed }) => (
          <>
            <View
              style={[
                styles.box,
                isHovered && !checked && !disabled && styles.boxHovered,
                invalid && !checked && styles.boxInvalid,
                checked && styles.boxChecked,
                pressed && !checked && styles.boxPressed,
                pressed && checked && styles.boxCheckedPressed,
              ]}
            >
              {checked ? <Icon name="check" size="sm" tone="inverse" /> : null}
            </View>

            <View style={styles.copy}>
              <Text variant="body" tone={disabled ? 'disabled' : 'heading'}>
                {label}
              </Text>
              {description !== undefined ? (
                <Text variant="footnote" tone="tertiary">
                  {description}
                </Text>
              ) : null}
            </View>

            <FocusRing visible={isFocused && !disabled} radius="md" />
          </>
        )}
      </Pressable>

      {invalid ? (
        <View style={styles.errorRow}>
          <Icon name="error" size="sm" tone="error" />
          <Text variant="footnote" tone="error" style={styles.errorText}>
            {error}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
