/**
 * `Button` — the only pressable call to action. Four variants, three sizes, and no way to invent a
 * fifth without editing this file, which is the point of
 * [Rule 1](../../../../CLAUDE.md): there is no `ButtonV2`, and a genuinely new need becomes a
 * variant in {@link ButtonVariant}.
 *
 * ## `label`, not `children`
 *
 * A `children` API lets a caller pass an icon alone, and the resulting button announces nothing to a
 * screen reader. Requiring a `label: string` makes the accessible name structurally impossible to
 * omit; icons go in the `iconLeft`/`iconRight` slots *alongside* it. An icon-only control is a
 * different component with a different contract (a required `accessibilityLabel`), not this one with
 * an empty label.
 *
 * ## The variant hierarchy, and why `destructive` is not a red fill
 *
 * The design language allows exactly one red **surface** per screen — `primary`. Red is a signal,
 * and roughly 90% of a screen is white or neutral. A filled red destructive button would put two
 * competing red fills on the confirmation screen where telling "commit" from "destroy" matters most,
 * so `destructive` mirrors `secondary`'s mechanics — white fill, hairline border — recoloured to
 * `status.error`. Red still reads as the warning; it just does not become the background.
 *
 * That `status.error` (`#C62828`) is a *different* red from `action.primary` (`#E53935`) is
 * deliberate and predates this component — see
 * [ADR-0017 §5](../../../../docs/adr/0017-token-schema.md).
 *
 * ## Loading preserves width
 *
 * The label stays mounted at zero opacity while a spinner is overlaid, so a button does not collapse
 * to spinner-width mid-submit and shove the layout around it. Swapping the label out — the obvious
 * implementation — is a visible jump on every form submission in the app.
 */
import { Pressable, View } from 'react-native';

import { haptic } from '@/core/haptics';

import { createStyles } from '../theme';
import { Spinner } from './Spinner';
import { Text } from './Text';

import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type { SpinnerTone } from './Spinner';
import type { Tone } from './tone';

export type ButtonVariant =
  'primary' | 'secondary' | 'tertiary' | 'destructive' | 'dark' | 'accentSoft';
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Outline shape. `pill` is the default and the identity; `rounded` exists for buttons that sit inside
 * a card and have to echo its corner rather than fight it — a pill inside a 160pt carousel card reads
 * as a chip that escaped.
 */
export type ButtonShape = 'pill' | 'rounded';

interface ButtonProps {
  /** The accessible name and the visible text. Required — see the note above. */
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  /** Corner treatment. Defaults to `pill`. */
  readonly shape?: ButtonShape;
  /** Blocks the press and dims to `opacity.disabled`. */
  readonly disabled?: boolean;
  /**
   * Blocks the press, overlays a spinner, and announces `busy` to assistive tech. Distinct from
   * `disabled` so a screen can say "in flight" without saying "unavailable".
   */
  readonly loading?: boolean;
  /** Rendered before the label, inside the same row. Pair with `Icon`. */
  readonly iconLeft?: ReactNode;
  readonly iconRight?: ReactNode;
  /** Stretches to the container. The form-submit case; intrinsic width otherwise. */
  readonly fullWidth?: boolean;
  /** What happens on press, when the label alone does not say. Read after the label. */
  readonly accessibilityHint?: string;
  /** Token-only layout escape hatch — margins, `flex`. Not for colour or size. */
  readonly style?: StyleProp<ViewStyle>;
}

const useStyles = createStyles((t) => ({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.xs,
    // Declared on every variant so a bordered variant and a filled one are the same height. A
    // border added only where it is visible makes `secondary` 2px taller than `primary`, which
    // shows up as a misaligned row the moment the two sit side by side.
    borderWidth: t.border.hairline,
    borderColor: 'transparent',
  },
  fullWidth: { alignSelf: 'stretch' },

  shapePill: { borderRadius: t.radius.full },
  shapeRounded: { borderRadius: t.radius.md },

  // Sizes. `md` is pinned to `size.touchTarget` rather than repeating 48, so the accessibility
  // floor and the default button are provably the same number.
  sizeSm: { minHeight: 40, paddingHorizontal: t.spacing.md },
  sizeMd: { minHeight: t.size.touchTarget, paddingHorizontal: t.spacing.lg },
  sizeLg: { minHeight: 56, paddingHorizontal: t.spacing.xl },

  primary: { backgroundColor: t.colors.action.primary, borderColor: t.colors.action.primary },
  primaryPressed: {
    backgroundColor: t.colors.action.primaryPressed,
    borderColor: t.colors.action.primaryPressed,
  },

  dark: { backgroundColor: t.colors.surface.inverse, borderColor: t.colors.surface.inverse },
  darkPressed: {
    backgroundColor: '#333333',
    borderColor: '#333333',
  },

  secondary: { backgroundColor: t.colors.action.secondary, borderColor: t.colors.border.subtle },
  secondaryPressed: { backgroundColor: t.colors.action.secondaryPressed },

  // Transparent rather than the canvas white: a tertiary button has to be invisible on
  // `surface.secondary` too, and a hardcoded white would show as a pale patch on grey.
  tertiary: { backgroundColor: 'transparent' },
  tertiaryPressed: { backgroundColor: t.colors.action.tertiaryPressed },

  destructive: { backgroundColor: t.colors.action.secondary, borderColor: t.colors.status.error },
  destructivePressed: { backgroundColor: t.colors.action.secondaryPressed },

  /**
   * The quiet accent: a red-tinted fill under a red label, borderless. For an offer repeated several
   * times in one view — the discovery carousel — where filled `primary` would turn the scarce accent
   * into a texture.
   */
  accentSoft: {
    backgroundColor: t.colors.action.accentSubtle,
    borderColor: t.colors.action.accentSubtle,
  },
  accentSoftPressed: {
    backgroundColor: t.colors.action.accentSubtlePressed,
    borderColor: t.colors.action.accentSubtlePressed,
  },

  disabled: { opacity: t.opacity.disabled },

  /**
   * The label row, dimmed to nothing while loading. `opacity: 0` rather than unmounting, so the
   * button keeps its width — see the note in the module header.
   */
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
  },
  contentHidden: { opacity: 0 },

  /** `StyleSheet.absoluteFillObject` centred, so the spinner lands where the label was. */
  spinnerOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

type SheetKey = keyof ReturnType<typeof useStyles>;

/**
 * Everything a variant decides, in one row per variant. A typed record rather than four `if`
 * branches or a constructed `` `${variant}Pressed` `` key: adding a variant to the union without
 * filling this in is a compile error, and nothing here depends on a naming convention holding.
 */
interface VariantSpec {
  readonly container: SheetKey;
  readonly containerPressed: SheetKey;
  readonly textTone: Tone;
  readonly spinnerTone: SpinnerTone;
}

const VARIANT: Readonly<Record<ButtonVariant, VariantSpec>> = {
  primary: {
    container: 'primary',
    containerPressed: 'primaryPressed',
    textTone: 'inverse',
    spinnerTone: 'inverse',
  },
  dark: {
    container: 'dark',
    containerPressed: 'darkPressed',
    textTone: 'inverse',
    spinnerTone: 'inverse',
  },
  secondary: {
    container: 'secondary',
    containerPressed: 'secondaryPressed',
    textTone: 'heading',
    spinnerTone: 'secondary',
  },
  tertiary: {
    container: 'tertiary',
    containerPressed: 'tertiaryPressed',
    textTone: 'accent',
    spinnerTone: 'accent',
  },
  destructive: {
    container: 'destructive',
    containerPressed: 'destructivePressed',
    textTone: 'error',
    spinnerTone: 'error',
  },
  accentSoft: {
    container: 'accentSoft',
    containerPressed: 'accentSoftPressed',
    textTone: 'accent',
    spinnerTone: 'accent',
  },
};
const SHAPE_STYLE: Readonly<Record<ButtonShape, SheetKey>> = {
  pill: 'shapePill',
  rounded: 'shapeRounded',
};

const SIZE_STYLE: Readonly<Record<ButtonSize, SheetKey>> = {
  sm: 'sizeSm',
  md: 'sizeMd',
  lg: 'sizeLg',
};

/**
 * Vertical padding on the *touch* area, not the ink, so a small button stays visually small and
 * still clears the 48pt floor. `sm` is 40 tall, hence 4 either side; `md` and `lg` already clear it.
 *
 * Only the vertical axis needs it: horizontal padding already puts every size well past 48 wide for
 * any real label.
 */
const HIT_SLOP: Readonly<Record<ButtonSize, number>> = { sm: 4, md: 0, lg: 0 };

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  shape = 'pill',
  disabled = false,
  loading = false,
  iconLeft,
  iconRight,
  fullWidth = false,
  accessibilityHint,
  style,
}: ButtonProps) {
  const styles = useStyles();
  const spec = VARIANT[variant];

  // A button mid-submit must not be pressable again — a double-submit is a duplicate row in the
  // database, not a cosmetic bug. Collapsed here rather than asked of every call site.
  const isInert = disabled || loading;

  function handlePress(): void {
    // Fired here, not in the caller's handler, so every button in the app feels the same and no
    // screen has to remember. `tap` is the semantic name; the physical effect lives in core/haptics.
    haptic('tap');
    onPress();
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={isInert}
      hitSlop={{ top: HIT_SLOP[size], bottom: HIT_SLOP[size] }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      // `disabled` and `busy` are separate states on purpose: a screen reader says "dimmed" for one
      // and "busy" for the other, and conflating them loses the distinction the props preserve.
      accessibilityState={{ disabled: isInert, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        styles[SHAPE_STYLE[shape]],
        styles[SIZE_STYLE[size]],
        styles[spec.container],
        pressed && styles[spec.containerPressed],
        fullWidth && styles.fullWidth,
        isInert && styles.disabled,
        style,
      ]}
    >
      <View style={[styles.content, loading && styles.contentHidden]}>
        {iconLeft}
        <Text variant={size === 'lg' ? 'headline' : 'label'} tone={spec.textTone}>
          {label}
        </Text>
        {iconRight}
      </View>

      {loading && (
        <View style={styles.spinnerOverlay}>
          {/*
            No `accessibilityLabel` on the spinner: `accessibilityState.busy` on the Pressable
            already announces the wait, and a nested "Loading" would be read as a second element
            inside the button.
          */}
          <Spinner size="sm" tone={spec.spinnerTone} accessibilityLabel="" />
        </View>
      )}
    </Pressable>
  );
}
