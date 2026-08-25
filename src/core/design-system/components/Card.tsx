/**
 * `Card` — the signature surface: white, hairline `#EAEAEA` border, radius 16, a shadow at the
 * threshold of perceptible. Three of the four carry the visual identity, so they are not props.
 *
 * What *is* a prop is padding (a card wrapping a full-bleed image needs none) and pressability.
 *
 * ## Pressable without a layout shift
 *
 * A pressed card moves its **background** to `surface.secondary` and its shadow from `xs` to `none`.
 * It does not scale and it does not translate. Two reasons: a scale transform on a bordered surface
 * resamples the 1px border and it visibly softens, and a card is usually in a list where one row
 * scaling under the finger drags the eye off the row the user is actually reading. Apple's own list
 * rows highlight rather than scale, which is the reference here.
 *
 * Dropping the shadow on press is what reads as "pressed in" — the surface settling onto the canvas.
 * That is the whole animation, and it needs no animation driver, which is why this component pulls
 * in no Reanimated.
 *
 * ## `onPress` decides the semantics, not a prop
 *
 * With `onPress` this renders a `Pressable` with `accessibilityRole="button"`; without it, a plain
 * `View` with no role at all. A card that looks pressable and announces nothing is the failure mode,
 * and inferring it from the handler makes the two impossible to get out of sync.
 *
 * No haptic on press, unlike `Button`. A card tap is almost always navigation, and iOS deliberately
 * does not buzz on a list-row push — feedback there would make the app feel chattier, not more
 * responsive. `Button` buzzes because it commits something.
 */
import { Pressable, View } from 'react-native';

import { createStyles } from '../theme';

import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export type CardPadding = 'none' | 'md' | 'lg';

interface CardProps {
  readonly children: ReactNode;
  /**
   * Interior padding. `lg` (20) is the design language's card padding and the default; `md` (16) for
   * dense list rows; `none` for a card whose child bleeds to the edge, which then owns its own
   * inset.
   */
  readonly padding?: CardPadding;
  /** Makes the card a button. Omit for a static surface. */
  readonly onPress?: () => void;
  /**
   * Required when `onPress` is set and the card's content is not a single obvious string — a
   * screen reader otherwise reads every text node in the card as one run.
   */
  readonly accessibilityLabel?: string;
  readonly accessibilityHint?: string;
  /** Token-only layout escape hatch — margins, `flex`. Not for colour, radius or border. */
  readonly style?: StyleProp<ViewStyle>;
}

const useStyles = createStyles((t) => ({
  base: {
    backgroundColor: t.colors.surface.primary,
    borderWidth: t.border.hairline,
    borderColor: t.colors.border.subtle,
    borderRadius: t.radius.lg,
    // `overflow: hidden` so a `padding="none"` child's own corners are clipped to the card's
    // radius. Without it, an image inside a rounded card renders square corners over the border —
    // the single most common way a card looks broken.
    overflow: 'hidden',
    ...t.shadow.xs,
  },

  paddingNone: {},
  paddingMd: { padding: t.spacing.md },
  paddingLg: { padding: t.spacing.lg },

  pressed: {
    backgroundColor: t.colors.surface.secondary,
    ...t.shadow.none,
  },
}));

type SheetKey = keyof ReturnType<typeof useStyles>;

const PADDING_STYLE: Readonly<Record<CardPadding, SheetKey>> = {
  none: 'paddingNone',
  md: 'paddingMd',
  lg: 'paddingLg',
};

export function Card({
  children,
  padding = 'lg',
  onPress,
  accessibilityLabel,
  accessibilityHint,
  style,
}: CardProps) {
  const styles = useStyles();
  const base = [styles.base, styles[PADDING_STYLE[padding]], style];

  if (onPress === undefined) {
    return <View style={base}>{children}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [...base, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}
