/**
 * `Divider` — a one-pixel rule. Trivial to inline, which is exactly why it is a component: inlined,
 * it is the single most likely place for `#EEE` or `borderBottomWidth: 1` to appear in a feature, and
 * it appears dozens of times.
 *
 * Two tones because the design language distinguishes them: `subtle` (`#EAEAEA`) between rows on the
 * canvas, `faint` (`#F0F0F0`) inside an already-bordered container, where the default would read as a
 * second frame.
 *
 * Hidden from assistive technology: a rule carries no information, and left visible it inserts an
 * empty stop between every pair of list rows in a screen reader's traversal. The spread comes from
 * `../a11y` rather than being written out here, because the iOS, Android and web spellings of that
 * one intent differ and `react-native-web` forwards the native ones to the DOM.
 */
import { View } from 'react-native';

import { HIDDEN_FROM_ASSISTIVE_TECH } from '../a11y';
import { createStyles } from '../theme';

import type { StyleProp, ViewStyle } from 'react-native';

export type DividerTone = 'subtle' | 'faint';
export type DividerOrientation = 'horizontal' | 'vertical';

interface DividerProps {
  readonly tone?: DividerTone;
  /** `vertical` needs a height from its parent — usually `alignSelf: 'stretch'` in a row. */
  readonly orientation?: DividerOrientation;
  /**
   * Insets the rule from the leading and trailing edges, the way a settings list indents its
   * separators past the icon column. A spacing token, applied on the cross axis.
   */
  readonly inset?: number;
  readonly style?: StyleProp<ViewStyle>;
}

const useStyles = createStyles((t) => ({
  // Width and height rather than a border, so the rule is one box the layout can measure. A
  // `borderBottomWidth` on a zero-height view collapses on web.
  horizontal: { height: t.border.hairline, alignSelf: 'stretch' },
  vertical: { width: t.border.hairline, alignSelf: 'stretch' },

  subtle: { backgroundColor: t.colors.border.subtle },
  faint: { backgroundColor: t.colors.border.faint },
}));

type SheetKey = keyof ReturnType<typeof useStyles>;

const ORIENTATION_STYLE: Readonly<Record<DividerOrientation, SheetKey>> = {
  horizontal: 'horizontal',
  vertical: 'vertical',
};

const TONE_STYLE: Readonly<Record<DividerTone, SheetKey>> = {
  subtle: 'subtle',
  faint: 'faint',
};

export function Divider({
  tone = 'subtle',
  orientation = 'horizontal',
  inset,
  style,
}: DividerProps) {
  const styles = useStyles();

  // The inset runs along the rule, so it is horizontal margin on a horizontal rule and vertical on
  // a vertical one. Computed inline rather than as sheet entries because the value is a caller's
  // token, not one of a fixed set.
  const insetStyle =
    inset === undefined
      ? undefined
      : orientation === 'horizontal'
        ? { marginHorizontal: inset }
        : { marginVertical: inset };

  return (
    <View
      style={[styles[ORIENTATION_STYLE[orientation]], styles[TONE_STYLE[tone]], insetStyle, style]}
      {...HIDDEN_FROM_ASSISTIVE_TECH}
    />
  );
}
