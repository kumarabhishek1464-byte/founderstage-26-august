/**
 * `Stack` — a row or a column with a gap. The layout primitive, and the reason a feature can build a
 * screen at all.
 *
 * ## Why this has to exist
 *
 * `eslint.config.js` bans `View` from `react-native` in `src/features/**` and `src/app/**`. That ban is
 * right — it is what stops a feature from inventing a card or a control — but taken alone it also
 * leaves a feature with **no way to put two things side by side**. Every screen past a single column of
 * text needs a row: a label and an "Optional" marker, an icon and a message, a chip that wraps. Without
 * a primitive for it, the ban is either defeated by an eslint-disable or worked around by adding a
 * one-off component per row, and both are worse than the box.
 *
 * ## Why the gap is a token *name* and not a number
 *
 * ```tsx
 * <Stack gap="md">           // ✅ 16, from the scale
 * <Stack gap={16}>           // ✗ would compile, and 18 would too
 * ```
 *
 * A numeric `gap` would make `Stack` the hole in the spacing scale — the one component through which
 * any number reaches a layout. `SpacingToken` closes it in the type system rather than in a lint rule,
 * so `gap="massive"` does not compile and there is nothing to police in review.
 *
 * The same argument gives `padding` a prop instead of leaving it to `style`. A padded box is the second
 * most common layout need after a gapped one, and `style={{ padding: theme.spacing.lg }}` costs the
 * caller a `useTheme()` — which is how a component ends up reading the theme for reasons that have
 * nothing to do with the theme.
 *
 * ## Why every prop goes through the stylesheet
 *
 * `style={{ gap: t.spacing[gap] }}` is shorter and it is a new object identity on every render, which
 * defeats `React.memo` on anything containing a stack — and at this app's scale, that is every list
 * row. The maps below are interning, the same trade `Text` makes for its tones
 * ([ADR-0005](../../../../docs/adr/0005-styling-approach.md)).
 *
 * ## Deliberately not
 *
 * No `backgroundColor`, no `borderRadius`, no border, no shadow. A box with a surface and a radius is a
 * `Card`, and a `Stack` that could paint one would make `Card` optional — at which point the signature
 * radius and the almost-imperceptible shadow become things every screen re-decides. Layout here,
 * surface there.
 *
 * No `accessibilityRole`. A stack is a box; its children carry the meaning. A `role` prop would invite
 * `<Stack accessibilityRole="button">`, which is the control the `Pressable` ban exists to prevent.
 */
import { View } from 'react-native';

import { createStyles } from '../theme';

import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type { Theme } from '../theme';

/**
 * The eleven legal spacing values, by name. Derived from the theme rather than written out, so the
 * scale has exactly one definition — adding a step to `tokens/metrics.ts` widens this automatically,
 * and the `Record`s below then fail to compile until they cover it.
 */
export type SpacingToken = keyof Theme['spacing'];

export type StackDirection = 'row' | 'column';

/**
 * Cross-axis alignment, named for the reading rather than for flexbox. `start`/`end` instead of
 * `flex-start`/`flex-end` because the flex prefix carries no information at a call site, and because
 * these names survive a layout engine that is not flexbox.
 */
export type StackAlign = 'start' | 'center' | 'end' | 'stretch' | 'baseline';

/**
 * Main-axis distribution. Four values, not six: `space-around` and `space-evenly` produce edge gaps
 * that are not on the spacing scale, so a layout using them is off the grid by construction.
 */
export type StackJustify = 'start' | 'center' | 'end' | 'between';

interface StackProps {
  readonly children: ReactNode;
  /** Defaults to `column` — the common case, and the safe one: a row that should have been a column clips. */
  readonly direction?: StackDirection;
  /** Space between children, by token name. Omitted means no gap. */
  readonly gap?: SpacingToken;
  /** Uniform inner padding, by token name. Per-axis padding goes through `style`. */
  readonly padding?: SpacingToken;
  readonly align?: StackAlign;
  readonly justify?: StackJustify;
  /** Lets children wrap onto a second line. Pair with `gap`, which then spaces both axes. */
  readonly wrap?: boolean;
  /** `flex: 1` — the stack takes the remaining space along its parent's main axis. */
  readonly fill?: boolean;
  /** Token-only escape hatch for what the props above do not cover. Last in the cascade, so it overrides. */
  readonly style?: StyleProp<ViewStyle>;
}

const useStyles = createStyles((t) => ({
  row: { flexDirection: 'row' },
  column: { flexDirection: 'column' },

  gapXxs: { gap: t.spacing.xxs },
  gapXs: { gap: t.spacing.xs },
  gapSm: { gap: t.spacing.sm },
  gapMd: { gap: t.spacing.md },
  gapLg: { gap: t.spacing.lg },
  gapXl: { gap: t.spacing.xl },
  gapXl2: { gap: t.spacing.xl2 },
  gapXl3: { gap: t.spacing.xl3 },
  gapXl4: { gap: t.spacing.xl4 },
  gapXl5: { gap: t.spacing.xl5 },
  gapXl6: { gap: t.spacing.xl6 },

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

  alignStart: { alignItems: 'flex-start' },
  alignCenter: { alignItems: 'center' },
  alignEnd: { alignItems: 'flex-end' },
  alignStretch: { alignItems: 'stretch' },
  alignBaseline: { alignItems: 'baseline' },

  justifyStart: { justifyContent: 'flex-start' },
  justifyCenter: { justifyContent: 'center' },
  justifyEnd: { justifyContent: 'flex-end' },
  justifyBetween: { justifyContent: 'space-between' },

  wrap: { flexWrap: 'wrap' },
  fill: { flex: 1 },
}));

type SheetKey = keyof ReturnType<typeof useStyles>;

/** Token name → sheet key. A new spacing step widens `SpacingToken` and breaks this until it is covered. */
const GAP_STYLE: Readonly<Record<SpacingToken, SheetKey>> = {
  xxs: 'gapXxs',
  xs: 'gapXs',
  sm: 'gapSm',
  md: 'gapMd',
  lg: 'gapLg',
  xl: 'gapXl',
  xl2: 'gapXl2',
  xl3: 'gapXl3',
  xl4: 'gapXl4',
  xl5: 'gapXl5',
  xl6: 'gapXl6',
};

const PADDING_STYLE: Readonly<Record<SpacingToken, SheetKey>> = {
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

const ALIGN_STYLE: Readonly<Record<StackAlign, SheetKey>> = {
  start: 'alignStart',
  center: 'alignCenter',
  end: 'alignEnd',
  stretch: 'alignStretch',
  baseline: 'alignBaseline',
};

const JUSTIFY_STYLE: Readonly<Record<StackJustify, SheetKey>> = {
  start: 'justifyStart',
  center: 'justifyCenter',
  end: 'justifyEnd',
  between: 'justifyBetween',
};

export function Stack({
  children,
  direction = 'column',
  gap,
  padding,
  align,
  justify,
  wrap = false,
  fill = false,
  style,
}: StackProps) {
  const styles = useStyles();

  return (
    <View
      style={[
        styles[direction],
        gap !== undefined && styles[GAP_STYLE[gap]],
        padding !== undefined && styles[PADDING_STYLE[padding]],
        align !== undefined && styles[ALIGN_STYLE[align]],
        justify !== undefined && styles[JUSTIFY_STYLE[justify]],
        wrap && styles.wrap,
        fill && styles.fill,
        style,
      ]}
    >
      {children}
    </View>
  );
}
