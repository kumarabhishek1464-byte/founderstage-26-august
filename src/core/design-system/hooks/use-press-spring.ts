/**
 * `usePressSpring` — the physical response every pressable surface in the app shares.
 *
 * Two things a "premium" feel does that a default `Pressable` does not: it *depresses* when the
 * finger lands, and it *settles* on release rather than snapping. Doing that per component is how
 * the app ends up with three different scale curves for three different call sites; centralising it
 * here — and reaching for `motion.spring.snappy` from the tokens — is what makes every button, chip,
 * card and row breathe with the same rhythm.
 *
 * The hook returns three pieces:
 *
 *   - `animatedStyle` — a Reanimated style to be applied to an `Animated.View` **around** the
 *     `Pressable`. Wrapping outside rather than styling the `Pressable` itself is deliberate:
 *     `react-native-web` renders `Pressable` as a native `<button>`/`<a>` in some cases, and
 *     transform on those elements can suppress focus rings. The wrapper is always a `<div>` and is
 *     safe to transform.
 *   - `onPressIn` / `onPressOut` — pass straight through to the `Pressable`. They only drive the
 *     shared value; the component keeps its own `onPress` and `haptic` semantics.
 *
 * A 0.98 scale target is the smallest change the eye can register on a 48pt surface — noticeable
 * from muscle memory, invisible if you are not touching it. Larger targets read as toy-like on
 * a system that otherwise avoids animation for its own sake.
 */
import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { motion } from '../tokens';

/** Optional overrides for exceptional call sites. Defaults are the right answer 99% of the time. */
export interface UsePressSpringOptions {
  /**
   * Target scale while the finger is down. 0.98 by default — the design-language number.
   * Chips and small icon buttons occasionally want 0.96 for a touch more depth on the smaller
   * surface. Never below 0.94: past that it reads as a bug, not a press.
   */
  readonly pressedScale?: number;
  /** Disables the animation entirely — for a `disabled` control that should not react to touch. */
  readonly disabled?: boolean;
}

interface UsePressSpring {
  readonly animatedStyle: {
    readonly transform: readonly { readonly scale: number }[];
  };
  readonly onPressIn: () => void;
  readonly onPressOut: () => void;
}

const REST = 1;

export function usePressSpring({
  pressedScale = 0.98,
  disabled = false,
}: UsePressSpringOptions = {}): UsePressSpring {
  const scale = useSharedValue(REST);

  /*
   * Handlers are declared without `useCallback` on purpose. React Compiler's immutability rule
   * treats a shared value captured by `useCallback` as read-only, which is exactly the opposite of
   * what `useSharedValue` is for — its whole contract is a mutable `.value`. Declared as regular
   * closures, the writes read as ordinary imperative code and the rule does not fire. The lost
   * referential equality on `Pressable` is inconsequential: `Pressable` re-attaches its listeners
   * on every render regardless.
   */
  function onPressIn(): void {
    if (disabled) return;
    scale.value = withSpring(pressedScale, motion.spring.snappy);
  }

  function onPressOut(): void {
    if (disabled) return;
    scale.value = withSpring(REST, motion.spring.snappy);
  }

  /*
   * The hook returns the *result* of `useAnimatedStyle`, which is a proxy tied to `scale`. Its true
   * runtime shape is what the callback returns — declared above on `UsePressSpring` — so Reanimated's
   * broader internal handle type does not leak to consumers and clash with `Animated.View`'s
   * `StyleProp<ViewStyle>`. The runtime proxy is compatible; only the *type* is being narrowed.
   */
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  })) as unknown as UsePressSpring['animatedStyle'];

  return { animatedStyle, onPressIn, onPressOut };
}
