/**
 * `Bubble` — a filled, rounded, optionally-pressable container. The primitive a chat message and a
 * reply-preview strip and a reaction pill sit inside.
 *
 * ## Why it is not `Card`
 *
 * `Card` is the signature product surface: white, hairline `#EAEAEA` border, radius 16, xs shadow.
 * A message bubble is none of those three: it is a coloured fill on white, no border, no shadow.
 * Papering over the difference with a `variant` prop on `Card` would let a screen ship a bubble
 * that unintentionally carries the card's identity. Two primitives means two intentions.
 *
 * ## Why long-press is here and not on `Card`
 *
 * Cards navigate. A pressed card is a route change, and a *long-pressed* card would be a mystery
 * gesture on a control that already commits on tap. A bubble commits nothing on tap by default,
 * which is why long-press is a natural fit for its context menu.
 */
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { createStyles } from '../theme';

import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type { SpacingToken } from './Stack';

export type BubbleBackground = 'primary' | 'secondary' | 'tertiary' | 'accentSubtle' | 'inverse';
export type BubbleRadius = 'sm' | 'md' | 'lg' | 'xl' | 'full';

interface BubbleProps {
  readonly children: ReactNode;
  /** Defaults to `secondary`, the muted neutral used by the incoming message bubble. */
  readonly background?: BubbleBackground;
  /** Defaults to `lg` — the message-bubble radius. */
  readonly radius?: BubbleRadius;
  /** Uniform interior padding, by token name. */
  readonly padding?: SpacingToken;
  readonly onPress?: () => void;
  readonly onLongPress?: () => void;
  readonly accessibilityLabel?: string;
  readonly accessibilityHint?: string;
  /** Token-only layout escape hatch — margins, `flex`, `alignSelf`. */
  readonly style?: StyleProp<ViewStyle>;
}

const useStyles = createStyles((t) => ({
  base: {
    // No border, no shadow, no default background — every axis is a prop.
  },
  bgPrimary: { backgroundColor: t.colors.surface.primary },
  bgSecondary: { backgroundColor: t.colors.surface.secondary },
  bgTertiary: { backgroundColor: t.colors.surface.tertiary },
  bgAccentSubtle: { backgroundColor: t.colors.surface.accentSubtle },
  bgInverse: { backgroundColor: t.colors.surface.inverse },

  radSm: { borderRadius: t.radius.sm },
  radMd: { borderRadius: t.radius.md },
  radLg: { borderRadius: t.radius.lg },
  radXl: { borderRadius: t.radius.xl },
  radFull: { borderRadius: t.radius.full },

  padXxs: { padding: t.spacing.xxs },
  padXs: { padding: t.spacing.xs },
  padSm: { padding: t.spacing.sm },
  padMd: { padding: t.spacing.md },
  padLg: { padding: t.spacing.lg },
  padXl: { padding: t.spacing.xl },
  padXl2: { padding: t.spacing.xl2 },
  padXl3: { padding: t.spacing.xl3 },
  padXl4: { padding: t.spacing.xl4 },
  padXl5: { padding: t.spacing.xl5 },
  padXl6: { padding: t.spacing.xl6 },

  pressed: { opacity: t.opacity.pressed },
}));

type SheetKey = keyof ReturnType<typeof useStyles>;

const BG: Readonly<Record<BubbleBackground, SheetKey>> = {
  primary: 'bgPrimary',
  secondary: 'bgSecondary',
  tertiary: 'bgTertiary',
  accentSubtle: 'bgAccentSubtle',
  inverse: 'bgInverse',
};

const RAD: Readonly<Record<BubbleRadius, SheetKey>> = {
  sm: 'radSm',
  md: 'radMd',
  lg: 'radLg',
  xl: 'radXl',
  full: 'radFull',
};

const PAD: Readonly<Record<SpacingToken, SheetKey>> = {
  xxs: 'padXxs',
  xs: 'padXs',
  sm: 'padSm',
  md: 'padMd',
  lg: 'padLg',
  xl: 'padXl',
  xl2: 'padXl2',
  xl3: 'padXl3',
  xl4: 'padXl4',
  xl5: 'padXl5',
  xl6: 'padXl6',
};

export function Bubble({
  children,
  background = 'secondary',
  radius = 'lg',
  padding,
  onPress,
  onLongPress,
  accessibilityLabel,
  accessibilityHint,
  style,
}: BubbleProps) {
  const styles = useStyles();
  const [isPressed, setPressed] = useState(false);

  const composed = [
    styles.base,
    styles[BG[background]],
    styles[RAD[radius]],
    padding !== undefined && styles[PAD[padding]],
    isPressed && styles.pressed,
    style,
  ];

  if (onPress === undefined && onLongPress === undefined) {
    return <View style={composed}>{children}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => {
        setPressed(true);
      }}
      onPressOut={() => {
        setPressed(false);
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      // 200ms lands between iOS' default (~500ms) and Android's (~400ms), so the gesture is
      // discoverable on both without competing with a normal press.
      delayLongPress={200}
      style={composed}
    >
      {children}
    </Pressable>
  );
}
