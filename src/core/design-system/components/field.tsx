/**
 * The chrome shared by every form control that looks like a text field — `TextField` and `Select`
 * today. Not exported from the barrel: a feature composes fields, it does not build one.
 *
 * Two things live here.
 *
 * `Field` is the part above and below the control: the label, the "Optional" marker, and the helper or
 * error line. `useFieldStyles` is the bordered box itself, plus the state styles, because a select
 * whose border behaved differently from a text input's would read as two different controls in one
 * form — and that divergence happens the moment the border lives in two files.
 *
 * ## The border is the focus indicator, and that is a native decision
 *
 * Every other control in this design system shows focus with `FocusRing`. A text field does not, and
 * the reason is that `TextInput.onFocus` fires **on touch**, not only on keyboard focus. A blue ring
 * blooming around a field every time a thumb lands on it is wrong on a phone, where tapping a field is
 * the normal way to use it. So focus is carried by the border, which is what iOS and Android text
 * fields do natively.
 *
 * ```
 * disabled   border.faint    + surface.secondary   nothing to type into
 * focused    text.heading    (#111111, 18:1)       the keyboard is here
 * invalid    status.error    (#C62828)             this needs fixing
 * hovered    border.strong   (#D9D9D9)             web only
 * rest       border.subtle   (#EAEAEA)
 * ```
 *
 * **Focus outranks invalid**, which is the one ordering worth arguing about. Keeping the red border
 * while focused would mean a keyboard user tabbing into an invalid field sees no change at all — a
 * WCAG 2.4.7 failure — and the error is not lost by yielding the border, because the message and its
 * icon are still sitting underneath. Colour was never the thing carrying the error (WCAG 1.4.1); the
 * sentence was.
 *
 * `borderWidth` is `hairline` in every state. A thicker focused border would reflow the whole form by a
 * point on focus, which is visible as a shudder on the fields below.
 */
import { View } from 'react-native';

import { HIDDEN_FROM_ASSISTIVE_TECH } from '../a11y';
import { createStyles } from '../theme';
import { Icon } from './Icon';
import { Stack } from './Stack';
import { Text } from './Text';

import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type { IconName } from './Icon';

/**
 * The four independent facts about a field that change how the box is painted. Independent because
 * they can be true at once — a pointer hovering a focused invalid field is all three — so this is a
 * record of booleans rather than one `state: 'focused' | 'invalid' | …` union that would have to
 * encode every combination.
 */
export interface FieldState {
  readonly focused: boolean;
  readonly invalid: boolean;
  readonly disabled: boolean;
  readonly hovered: boolean;
}

export const useFieldStyles = createStyles((t) => ({
  /**
   * 56 tall, matching `Button`'s `lg`, so a form's fields and its submit button are one height —
   * which is most of what makes a stack of controls read as a single object. Written as a literal for
   * the reason `Button`'s heights are: this tree is where the numbers are allowed to live.
   */
  shell: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
    paddingHorizontal: t.spacing.md,
    borderWidth: t.border.hairline,
    borderRadius: t.radius.lg,
    backgroundColor: '#F0F1F4',
    borderColor: 'transparent',
    // Keeps the `prefix` rule and a long value from painting over the rounded corners.
    overflow: 'hidden',
  },

  /**
   * A textarea is top-aligned and grows, so it opts out of the centred single-line box. 112 is four
   * lines of `typography.body` (22pt) plus the vertical padding — enough that it reads as "write a
   * paragraph" rather than "write a phrase".
   */
  shellMultiline: {
    minHeight: 112,
    alignItems: 'flex-start',
    paddingVertical: t.spacing.sm,
  },

  shellHovered: { borderColor: t.colors.border.strong },
  shellInvalid: { borderColor: t.colors.status.error },
  shellFocused: { borderColor: t.colors.text.heading },
  shellDisabled: {
    borderColor: t.colors.border.faint,
    backgroundColor: t.colors.surface.secondary,
  },

  /**
   * The editable run. `flex: 1` so it claims the space between the leading icon and any trailing
   * control, and `paddingVertical: 0` because Android's `TextInput` ships its own vertical padding
   * that would push the text off the box's centre line.
   */
  input: {
    ...t.typography.body,
    color: t.colors.text.heading,
    flex: 1,
    paddingVertical: 0,
  },
  inputDisabled: { color: t.colors.text.disabled },

  /** `top` rather than the Android default `center`, so a growing textarea fills downwards. */
  inputMultiline: { textAlignVertical: 'top' },

  /**
   * The rule between a prefix (`+91`) and the value. A vertical hairline rather than a gap, because a
   * prefix is part of the same value and a gap alone reads as two separate fields sharing a box.
   */
  prefixRule: {
    alignSelf: 'stretch',
    width: t.border.hairline,
    backgroundColor: t.colors.border.subtle,
    marginVertical: t.spacing.sm,
  },

  /** A row rather than a `Stack`, because this box is also what hides the label from assistive tech. */
  labelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: t.spacing.xxs,
  },

  /** Lets a helper or error message wrap instead of being truncated by the icon beside it. */
  message: { flex: 1 },
}));

export type FieldStyles = ReturnType<typeof useFieldStyles>;

/**
 * Composes the box's state styles in precedence order. A function rather than four `&&`s repeated in
 * `TextField` and `Select`, because the *order* is the decision documented at the top of this file and
 * it must not be re-derived per component.
 */
export function fieldShellStyle(
  styles: FieldStyles,
  state: FieldState,
  multiline = false
): StyleProp<ViewStyle> {
  return [
    styles.shell,
    multiline && styles.shellMultiline,
    state.hovered && !state.disabled && styles.shellHovered,
    state.invalid && !state.disabled && styles.shellInvalid,
    state.focused && !state.disabled && styles.shellFocused,
    state.disabled && styles.shellDisabled,
  ];
}

interface FieldProps {
  /**
   * The visible label. Always present — a placeholder is not a label: it vanishes the moment the user
   * types, taking the only description of the field with it, and it is unreachable to assistive tech
   * on a filled field. There is no `hideLabel` prop for the same reason.
   */
  readonly label: string;
  /** Marks the field as skippable. Renders a quiet "Optional" beside the label. */
  readonly optional?: boolean;
  /** Standing guidance — a format, a rule. Replaced by `error` while there is one. */
  readonly helper?: string;
  /** A glyph for the helper line, where the guidance is a reassurance rather than an instruction. */
  readonly helperIcon?: IconName;
  /** The validation message. Its presence is what puts the field in its invalid state. */
  readonly error?: string;
  readonly disabled?: boolean;
  /** The control itself — the bordered box the caller builds with {@link fieldShellStyle}. */
  readonly children: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}

export function Field({
  label,
  optional = false,
  helper,
  helperIcon,
  error,
  disabled = false,
  children,
  style,
}: FieldProps) {
  const styles = useFieldStyles();
  const hasError = error !== undefined && error.length > 0;
  const hasHelper = !hasError && helper !== undefined && helper.length > 0;

  return (
    <Stack gap="xs" style={style}>
      {/*
       * Hidden from assistive tech because the control below carries this string as its
       * `accessibilityLabel` — the same relationship `<label for>` expresses on the web, where the
       * label is not a separate stop either. Leaving it visible would announce every field's name
       * twice: once on the text, once on the control.
       */}
      <View style={styles.labelRow} {...HIDDEN_FROM_ASSISTIVE_TECH}>
        <Text variant="subhead" tone={disabled ? 'disabled' : 'heading'}>
          {label}
        </Text>
        {optional ? (
          <Text variant="caption" tone="tertiary">
            Optional
          </Text>
        ) : null}
      </View>

      {children}

      {hasError ? (
        <Stack direction="row" gap="xxs" align="center">
          <Icon name="error" size="sm" tone="error" />
          <Text variant="footnote" tone="error" style={styles.message}>
            {error}
          </Text>
        </Stack>
      ) : null}

      {hasHelper ? (
        <Stack direction="row" gap="xxs" align="center">
          {helperIcon !== undefined ? <Icon name={helperIcon} size="sm" tone="tertiary" /> : null}
          <Text variant="footnote" tone="tertiary" style={styles.message}>
            {helper}
          </Text>
        </Stack>
      ) : null}
    </Stack>
  );
}
