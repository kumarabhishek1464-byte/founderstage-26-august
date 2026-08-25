/**
 * `TextField` — a labelled text input. The only way a feature collects typed input, since `TextInput`
 * from `react-native` is banned outside this tree.
 *
 * The box, its five states and the label/helper/error frame all come from `field.tsx`, shared with
 * `Select` so the two are indistinguishable in a form. What is specific to typing lives here: the
 * keyboard, the autofill hint, the password reveal, and the `+91`-style prefix.
 *
 * ## Why the whole box is pressable
 *
 * A `TextInput` only receives the taps that land on it, so the leading icon and the padding around it
 * would be dead space — a 44pt strip down the left of every field that looks like part of the control
 * and does nothing. The shell is therefore a `Pressable` that focuses the input.
 *
 * It carries `accessible={false}`, and that is the load-bearing detail: a `Pressable` is an
 * accessibility element by default, and on iOS an accessible parent **collapses its subtree into one
 * announcement**, which would swallow the password reveal button entirely. `accessible={false}` leaves
 * the input and the reveal button as the two separate stops they are.
 *
 * ## Why the keyboard and autofill vocabularies are narrowed
 *
 * `KeyboardTypeOptions` has twenty-odd members, several iOS-only, and `autoComplete` has over fifty.
 * Passing them through would mean a field configured with `keyboardType="twitter"` — a real value —
 * behaving differently on Android for no reason a reviewer would catch. The unions below are the cases
 * this app has, named for the content rather than for the platform's spelling.
 *
 * ## Why there is no `autoFocus`
 *
 * A field that focuses itself on mount opens the keyboard over the screen before the user has read it,
 * and on a multi-step form it does that once per step. If a screen ever genuinely needs it, that is a
 * screen-level decision about *which* field, and it belongs in the form, not in a default here.
 */
import { useCallback, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { createStyles, useTheme } from '../theme';
import { Field, fieldShellStyle, useFieldStyles } from './field';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { Text } from './Text';

import type { KeyboardTypeOptions, StyleProp, TextInputProps, ViewStyle } from 'react-native';
import type { IconName } from './Icon';

/** Named for the content, not for the platform's keyboard identifier. */
export type TextFieldKeyboard = 'default' | 'email' | 'phone' | 'number' | 'url';

/**
 * The autofill hints this app can honestly claim. `off` is included and is not the default: turning
 * autofill off is a decision (a one-time code, a field the platform would fill wrongly), and it should
 * read as one at the call site.
 */
export type TextFieldAutofill =
  'off' | 'email' | 'password' | 'newPassword' | 'name' | 'tel' | 'url';

export type TextFieldCapitalization = 'none' | 'sentences' | 'words';

export type TextFieldReturnKey = 'next' | 'done' | 'go' | 'search';

interface TextFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  /** Fired on blur — where a form running `mode: 'onTouched'` validation hangs its trigger. */
  readonly onBlur?: () => void;
  /**
   * An *example*, never a restatement of the label. "you@company.com" earns its place; "Email" does
   * not, because the label already says that and the hint disappears as soon as the user types.
   */
  readonly placeholder?: string;
  /** A leading glyph naming what the field holds. Decorative — the label carries the meaning. */
  readonly icon?: IconName;
  /** An immutable leading run that is part of the value: a dialling code, a currency, a URL scheme. */
  readonly prefix?: string;
  readonly optional?: boolean;
  readonly helper?: string;
  readonly helperIcon?: IconName;
  readonly error?: string;
  /** Masks the value and adds a reveal control. */
  readonly secure?: boolean;
  /** Grows to four lines and top-aligns. For a sentence about yourself, not for a name. */
  readonly multiline?: boolean;
  readonly keyboardType?: TextFieldKeyboard;
  readonly autofill?: TextFieldAutofill;
  readonly autoCapitalize?: TextFieldCapitalization;
  readonly maxLength?: number;
  readonly returnKeyType?: TextFieldReturnKey;
  readonly onSubmitEditing?: () => void;
  readonly disabled?: boolean;
  /** A consequence the label and helper cannot carry. Announced instead of the error when there is one. */
  readonly accessibilityHint?: string;
  readonly style?: StyleProp<ViewStyle>;
}

const KEYBOARD: Readonly<Record<TextFieldKeyboard, KeyboardTypeOptions>> = {
  default: 'default',
  email: 'email-address',
  phone: 'phone-pad',
  // `number-pad` rather than `numeric`: no decimal separator, which is right for a count or a code and
  // wrong for a currency. A money field is the trigger to add a `decimal` member, not to widen this one.
  number: 'number-pad',
  url: 'url',
};

type RNAutofill = TextInputProps['autoComplete'];

const AUTOFILL: Readonly<Record<TextFieldAutofill, RNAutofill>> = {
  off: 'off',
  email: 'email',
  password: 'current-password',
  newPassword: 'new-password',
  name: 'name',
  tel: 'tel',
  url: 'url',
};

const useStyles = createStyles((t) => ({
  /**
   * The zone that focuses the input. Fills the shell so the leading icon and the padding around it are
   * live, and stops short of any trailing control, which is its own target.
   */
  tapZone: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
    alignSelf: 'stretch',
  },
  /** Top-aligned so a growing textarea's leading icon stays on the first line. */
  tapZoneMultiline: { alignItems: 'flex-start' },
  /**
   * A trailing `IconButton` is a 40pt circle, so the shell's usual 16pt inset would put its glyph 36pt
   * from the edge — visibly further in than the leading icon. 4pt brings the glyph back to 24.
   */
  shellTrailing: { paddingRight: t.spacing.xxs },
  /** Nudges the leading icon and the prefix onto the first line's baseline in a textarea. */
  firstLine: { paddingTop: t.spacing.xxs },
}));

export function TextField({
  label,
  value,
  onChangeText,
  onBlur,
  placeholder,
  icon,
  prefix,
  optional = false,
  helper,
  helperIcon,
  error,
  secure = false,
  multiline = false,
  keyboardType = 'default',
  autofill = 'off',
  autoCapitalize = 'sentences',
  maxLength,
  returnKeyType,
  onSubmitEditing,
  disabled = false,
  accessibilityHint,
  style,
}: TextFieldProps) {
  const fieldStyles = useFieldStyles();
  const styles = useStyles();
  const theme = useTheme();
  const inputRef = useRef<TextInput>(null);

  const [isFocused, setFocused] = useState(false);
  const [isHovered, setHovered] = useState(false);
  const [isRevealed, setRevealed] = useState(false);

  const invalid = error !== undefined && error.length > 0;

  const handleBlur = useCallback(() => {
    setFocused(false);
    onBlur?.();
  }, [onBlur]);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const toggleReveal = useCallback(() => {
    setRevealed((previous) => !previous);
  }, []);

  return (
    <Field
      label={label}
      optional={optional}
      helper={helper}
      helperIcon={helperIcon}
      error={error}
      disabled={disabled}
      style={style}
    >
      <Pressable
        onPress={focusInput}
        disabled={disabled}
        // See the docblock: without this, iOS collapses the reveal button into the field's own
        // announcement and it becomes unreachable.
        accessible={false}
        onHoverIn={() => {
          setHovered(true);
        }}
        onHoverOut={() => {
          setHovered(false);
        }}
        style={[
          fieldShellStyle(
            fieldStyles,
            { focused: isFocused, invalid, disabled, hovered: isHovered },
            multiline
          ),
          secure && styles.shellTrailing,
        ]}
      >
        <View style={[styles.tapZone, multiline && styles.tapZoneMultiline]}>
          {icon !== undefined ? (
            <Icon
              name={icon}
              size="md"
              // Follows the border: the leading glyph darkens with focus, so the whole control reads as
              // one object changing state rather than a box with an unrelated icon in it.
              tone={disabled ? 'disabled' : isFocused ? 'heading' : 'tertiary'}
              style={multiline ? styles.firstLine : undefined}
            />
          ) : null}

          {prefix !== undefined ? (
            <>
              <Text variant="body" tone={disabled ? 'disabled' : 'secondary'}>
                {prefix}
              </Text>
              <View style={fieldStyles.prefixRule} />
            </>
          ) : null}

          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={onChangeText}
            onFocus={() => {
              setFocused(true);
            }}
            onBlur={handleBlur}
            editable={!disabled}
            placeholder={placeholder}
            placeholderTextColor={theme.colors.text.tertiary}
            // The caret is the one place red is unambiguously right as a foreground: it marks where the
            // user is acting, which is what `action.primary` means everywhere else in the app.
            selectionColor={theme.colors.action.primary}
            secureTextEntry={secure && !isRevealed}
            multiline={multiline}
            keyboardType={KEYBOARD[keyboardType]}
            autoComplete={AUTOFILL[autofill]}
            autoCapitalize={autoCapitalize}
            autoCorrect={!secure}
            // Every field on a dark-on-white surface; `light` is the keyboard that matches.
            keyboardAppearance="light"
            maxLength={maxLength}
            returnKeyType={returnKeyType}
            onSubmitEditing={onSubmitEditing}
            style={[
              fieldStyles.input,
              multiline && fieldStyles.inputMultiline,
              disabled && fieldStyles.inputDisabled,
            ]}
            // The visible label is hidden from assistive tech (see `field.tsx`); this is where it is
            // announced. The error takes the hint slot when there is one, because a field the user has
            // just landed on needs to hear what is wrong with it before it needs advice.
            accessibilityLabel={label}
            accessibilityHint={invalid ? error : accessibilityHint}
          />
        </View>

        {secure ? (
          <IconButton
            name={isRevealed ? 'conceal' : 'reveal'}
            // The action, not the glyph. Announcing "eye" tells a screen-reader user nothing about
            // what pressing it does.
            accessibilityLabel={isRevealed ? 'Hide password' : 'Show password'}
            onPress={toggleReveal}
            disabled={disabled}
            tone="tertiary"
          />
        ) : null}
      </Pressable>
    </Field>
  );
}
