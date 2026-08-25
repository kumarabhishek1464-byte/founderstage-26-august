/**
 * `Spinner` — the one wrapper over `ActivityIndicator`, which features cannot import directly.
 *
 * The design language calls for **skeletons on first load, not spinners** — a spinner is for the
 * short indeterminate wait where a skeleton would flash: a button mid-submit, a pull-to-refresh, a
 * paginating list footer. `Skeleton` covers first paint; this covers the in-place wait.
 *
 * Size is a two-value token (`'sm' | 'md'`) rather than a pixel, because `ActivityIndicator` on iOS
 * only honours the platform's `'small'`/`'large'` and silently ignores a numeric size — so a `40`
 * passed here would work on Android and web and do nothing on iOS. Naming the two real sizes makes
 * the platform floor the contract instead of a surprise.
 *
 * This is the one component that reads `useTheme()` rather than `createStyles()`, because
 * `ActivityIndicator` takes `color` as a **prop**, not a style. Going through a stylesheet to fish
 * the value back out would mean asserting `ColorValue` down to `string` — a cast that is wrong in
 * principle (`ColorValue` includes `OpaqueColorValue`, a native handle) to work around a shape this
 * component does not have. `toneColor` hands back the resolved string directly.
 */
import { ActivityIndicator } from 'react-native';

import { useTheme } from '../theme';
import { toneColor } from './tone';

import type { StyleProp, ViewStyle } from 'react-native';

export type SpinnerSize = 'sm' | 'md';

/**
 * The tones a spinner legitimately takes — a subset of the full foreground vocabulary. A spinner is
 * never `tertiary` or `disabled`, so those are not offered even though `toneColor` could resolve
 * them.
 */
export type SpinnerTone = 'accent' | 'inverse' | 'secondary' | 'error';

interface SpinnerProps {
  readonly size?: SpinnerSize;
  /**
   * Which foreground the spinner sits on. `accent` (red) on white is the default; `inverse` (white)
   * for a spinner inside a filled primary button; `secondary` for a quiet grey wait; `error` for a
   * destructive action mid-flight.
   */
  readonly tone?: SpinnerTone;
  /**
   * The wait this spinner represents, announced to assistive tech. Defaults to a generic
   * "Loading" — a caller mid-submit should say so ("Saving"). Pass `""` to stay silent when a
   * parent already announces `busy`.
   */
  readonly accessibilityLabel?: string;
  readonly style?: StyleProp<ViewStyle>;
}

const RN_SIZE: Readonly<Record<SpinnerSize, 'small' | 'large'>> = {
  sm: 'small',
  md: 'large',
};

export function Spinner({
  size = 'sm',
  tone = 'accent',
  accessibilityLabel = 'Loading',
  style,
}: SpinnerProps) {
  const theme = useTheme();

  return (
    <ActivityIndicator
      size={RN_SIZE[size]}
      color={toneColor(theme, tone)}
      accessibilityLabel={accessibilityLabel}
      style={style}
    />
  );
}
