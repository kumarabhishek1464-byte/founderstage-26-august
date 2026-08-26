/**
 * `MessageInput` — the composer's text field. Unlabelled, pill-shaped, grows to a soft cap.
 *
 * Deliberately separate from `TextField`. `TextField` is a *form control*: it carries a label, a
 * helper, an error state and a five-state border because a form input is a claim about a value and
 * has to say so. A composer is none of those things — it holds a run of text on its way to send, and
 * the moment it grows a "First name" label above itself the whole surface stops reading as chat.
 *
 * That is the same reason `Card` and `Bubble` are two primitives rather than one variant: two
 * intentions, two names.
 *
 * ## Growth is capped and internal
 *
 * The field expands from one line to `maxLines` (default 5) as content lands, then scrolls internally.
 * A composer that grows without bound will happily eat the entire viewport on a paste of a paragraph;
 * capping it inside the primitive keeps that decision out of every screen that reuses it.
 */
import { TextInput } from 'react-native';

import { createStyles, useTheme } from '../theme';

import type { StyleProp, TextStyle } from 'react-native';

interface MessageInputProps {
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly placeholder?: string;
  readonly maxLines?: number;
  readonly onFocus?: () => void;
  readonly onBlur?: () => void;
  readonly onSubmitEditing?: () => void;
  /** Screen readers need a name even when there is no visible label. */
  readonly accessibilityLabel: string;
  readonly accessibilityHint?: string;
  readonly style?: StyleProp<TextStyle>;
}

const useStyles = createStyles((t) => ({
  input: {
    flex: 1,
    // `body` role, but authored inline rather than through `Text`: `TextInput` cannot take a `Text`
    // child, so its typography has to live in a `TextStyle` on itself.
    fontFamily: t.typography.body.fontFamily,
    fontSize: t.typography.body.fontSize,
    lineHeight: t.typography.body.lineHeight,
    color: t.colors.text.heading,
    // Top-align so a two-line message sits from the top of the pill rather than the middle.
    paddingTop: t.spacing.xxs,
    paddingBottom: t.spacing.xxs,
  },
}));

export function MessageInput({
  value,
  onChangeText,
  placeholder,
  maxLines = 5,
  onFocus,
  onBlur,
  onSubmitEditing,
  accessibilityLabel,
  accessibilityHint,
  style,
}: MessageInputProps) {
  const styles = useStyles();
  const theme = useTheme();

  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.colors.text.tertiary}
      multiline
      // The RN default clamps a multiline `TextInput` to two lines on iOS; passing `maxLines` prop
      // upstream is a no-op — the honest cap is `numberOfLines` on Android and a maxHeight style on
      // iOS. Both work together: Android respects the line count, iOS respects the pixel cap, and
      // the two arrive at the same visible ceiling because a line is a known height in the sheet.
      numberOfLines={maxLines}
      onFocus={onFocus}
      onBlur={onBlur}
      onSubmitEditing={onSubmitEditing}
      // Enter should insert a newline in a composer — never submit. The Send button is the only
      // commit affordance, and hijacking Return breaks a well-established chat convention.
      blurOnSubmit={false}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={[
        styles.input,
        { maxHeight: theme.typography.body.lineHeight * maxLines + theme.spacing.xs },
        style,
      ]}
      textAlignVertical="top"
    />
  );
}
