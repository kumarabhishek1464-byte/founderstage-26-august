/**
 * `Select` — a labelled control that opens a sheet of options.
 *
 * Shares its box, its five states and its label/helper/error frame with `TextField` via `field.tsx`, so
 * a form of mixed inputs and selects reads as one stack of controls rather than two kinds.
 *
 * ## Why a sheet and not the platform picker
 *
 * `@react-native-picker/picker` renders a UIPickerView on iOS, a Spinner on Android and a `<select>` on
 * web — three different shapes, three different interaction models, and none of them themeable. A
 * design language whose whole claim is that typography carries the hierarchy cannot delegate a third of
 * its form controls to the system's idea of type. The sheet below is one shape everywhere.
 *
 * ## Why `Modal` and not `@gorhom/bottom-sheet`
 *
 * The bottom-sheet library is already a dependency and it is the right tool for a *draggable* sheet with
 * snap points and a backdrop that responds to the gesture. This is a list you tap once and leave, and
 * paying for it would mean a `BottomSheetModalProvider` at the app root and `react-native-gesture-handler`
 * in the path of every option tap. `Modal` is in React Native, works on all three platforms, and is
 * banned in features — which is exactly the kind of thing this tree exists to own.
 *
 * `animationType="fade"` rather than `"slide"`: with `transparent`, `slide` moves the *whole* modal
 * container, so the scrim wipes up the screen along with the panel. Fading both is the restrained
 * reading anyway, and it behaves identically on native and on web.
 *
 * ## Why the options are radios
 *
 * `accessibilityRole="radio"` inside a `radiogroup`, not a list of buttons. A screen-reader user then
 * hears "Founder, radio button, selected, 1 of 10" — the count and the current choice — instead of ten
 * unrelated buttons with no indication of which one is live. The check glyph is the visual half of the
 * same statement, and it is a glyph *and* a colour so the selection does not depend on colour alone.
 */
import { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic } from '@/core/haptics';

import { createStyles, useTheme } from '../theme';
import { Divider } from './Divider';
import { Field, fieldShellStyle, useFieldStyles } from './field';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { Text } from './Text';

import type { StyleProp, ViewStyle } from 'react-native';
import type { IconName } from './Icon';

/**
 * `value` is what is stored, `label` is what is read. Separate because the stored value is a database
 * enum that outlives its wording — "pre_seed" stays put when "Pre-Seed" becomes "Pre-seed".
 */
export interface SelectOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

interface SelectProps<T extends string> {
  readonly label: string;
  /** `undefined` until the user chooses. There is no "first option is the default" — that is a silent answer. */
  readonly value: T | undefined;
  readonly onChange: (value: T) => void;
  readonly options: readonly SelectOption<T>[];
  /** Shown while nothing is chosen. "Select a role", not "Role". */
  readonly placeholder?: string;
  readonly icon?: IconName;
  readonly optional?: boolean;
  readonly helper?: string;
  readonly helperIcon?: IconName;
  readonly error?: string;
  readonly disabled?: boolean;
  /** The sheet's heading. Defaults to the label, which is right unless the sheet needs a longer question. */
  readonly sheetTitle?: string;
  readonly style?: StyleProp<ViewStyle>;
}

const useStyles = createStyles((t) => ({
  /** The value run. `flex: 1` so the chevron stays pinned right however long the label is. */
  value: { flex: 1 },

  /**
   * The scrim and the panel share one container so the scrim is a sibling the panel sits on top of,
   * rather than a parent the panel is nested in — a nested panel would inherit the scrim's press
   * handler and dismiss the sheet on every option tap.
   */
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: t.colors.overlay.scrim,
  },

  /**
   * `radius.xl2` on the top corners only — the token comment's "full-bleed sheets and modals". Clamped
   * to 80% of the viewport so the sheet never becomes the screen: seeing the scrim above it is what
   * says "this is temporary, and tapping up there closes it".
   */
  panel: {
    maxHeight: '80%',
    width: '100%',
    maxWidth: t.size.contentMaxWidth,
    alignSelf: 'center',
    backgroundColor: t.colors.surface.primary,
    borderTopLeftRadius: t.radius.xl2,
    borderTopRightRadius: t.radius.xl2,
    overflow: 'hidden',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    paddingLeft: t.spacing.xl,
    paddingRight: t.spacing.sm,
    paddingVertical: t.spacing.sm,
  },
  panelTitle: { flex: 1 },

  /**
   * `flexShrink: 1` with no `flexGrow`: a short list sizes to its content and a long one is bounded by
   * the panel's `maxHeight` and scrolls. `flex: 1` would stretch a three-option sheet to 80% of the
   * screen with empty space under it.
   */
  optionList: { flexGrow: 0, flexShrink: 1 },

  option: {
    minHeight: t.size.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    paddingHorizontal: t.spacing.xl,
    paddingVertical: t.spacing.sm,
  },
  optionPressed: { backgroundColor: t.colors.action.tertiaryPressed },
  optionLabel: { flex: 1 },
}));

export function Select<T extends string>({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  icon,
  optional = false,
  helper,
  helperIcon,
  error,
  disabled = false,
  sheetTitle,
  style,
}: SelectProps<T>) {
  const fieldStyles = useFieldStyles();
  const styles = useStyles();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [isOpen, setOpen] = useState(false);
  const [isFocused, setFocused] = useState(false);
  const [isHovered, setHovered] = useState(false);

  const invalid = error !== undefined && error.length > 0;
  const selected = options.find((option) => option.value === value);
  const display = selected?.label ?? placeholder;

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const open = useCallback(() => {
    haptic('tap');
    setOpen(true);
  }, []);

  const choose = useCallback(
    (next: T) => {
      // `selection`, not `tap`: committing to a choice from a list is the lighter of the two in this
      // app's vocabulary, and it fires before the sheet closes so the feedback lands on the tap.
      haptic('selection');
      onChange(next);
      setOpen(false);
    },
    [onChange]
  );

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
        onPress={open}
        disabled={disabled}
        onHoverIn={() => {
          setHovered(true);
        }}
        onHoverOut={() => {
          setHovered(false);
        }}
        // Unlike `TextField`, `onFocus` here only fires for real keyboard focus — a `View` does not
        // receive focus from a touch the way a `TextInput` does — so the focused border is safe.
        onFocus={() => {
          setFocused(true);
        }}
        onBlur={() => {
          setFocused(false);
        }}
        style={fieldShellStyle(fieldStyles, {
          focused: isFocused,
          invalid,
          disabled,
          hovered: isHovered,
        })}
        accessibilityRole="button"
        accessibilityLabel={label}
        // The chosen option, announced as the control's value rather than concatenated into its name —
        // so a screen reader says "Role, Founder" and re-announces only the part that changed.
        accessibilityValue={{ text: display }}
        accessibilityHint={invalid ? error : 'Opens a list of options'}
        accessibilityState={{ disabled, expanded: isOpen }}
      >
        {icon !== undefined ? (
          <Icon
            name={icon}
            size="md"
            tone={disabled ? 'disabled' : isFocused ? 'heading' : 'tertiary'}
          />
        ) : null}

        <Text
          variant="body"
          // The placeholder takes the placeholder's colour, so an unanswered select is visibly
          // unanswered at a glance down the form.
          tone={disabled ? 'disabled' : selected === undefined ? 'tertiary' : 'heading'}
          numberOfLines={1}
          style={styles.value}
        >
          {display}
        </Text>

        <Icon name="chevronDown" size="md" tone={disabled ? 'disabled' : 'tertiary'} />
      </Pressable>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        // Android's hardware back button, and Escape on web. Without it the sheet is inescapable
        // without a pointer.
        onRequestClose={close}
        statusBarTranslucent
      >
        <View style={styles.backdrop}>
          <Pressable
            style={styles.scrim}
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />

          {/* The safe-area inset is added to the panel's own bottom padding, so the last option clears
              the home indicator instead of sitting under it. */}
          <View style={[styles.panel, { paddingBottom: insets.bottom + theme.spacing.xs }]}>
            <View style={styles.panelHeader}>
              <Text variant="title3" tone="heading" style={styles.panelTitle}>
                {sheetTitle ?? label}
              </Text>
              <IconButton name="close" accessibilityLabel="Close" onPress={close} tone="heading" />
            </View>

            <Divider tone="faint" />

            <ScrollView style={styles.optionList} accessibilityRole="radiogroup">
              {options.map((option) => {
                const isSelected = option.value === value;

                return (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      choose(option.value);
                    }}
                    style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                  >
                    <Text
                      variant={isSelected ? 'bodyStrong' : 'body'}
                      tone={isSelected ? 'accent' : 'heading'}
                      style={styles.optionLabel}
                    >
                      {option.label}
                    </Text>
                    {isSelected ? <Icon name="check" size="md" tone="accent" /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Field>
  );
}
