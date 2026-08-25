/**
 * `createStyles` — the single sanctioned way a component turns theme values into styles.
 *
 * ```ts
 * const useStyles = createStyles((t) => ({
 *   card: {
 *     backgroundColor: t.colors.surface.primary,
 *     borderColor: t.colors.border.subtle,
 *     borderWidth: t.border.hairline,
 *     borderRadius: t.radius.lg,
 *     padding: t.spacing.lg,
 *     ...t.shadow.xs,
 *   },
 * }));
 *
 * function Card() {
 *   const styles = useStyles();
 *   …
 * }
 * ```
 *
 * The call happens at module scope and returns a hook, rather than being a hook that takes a
 * factory. That ordering is what makes the per-theme cache below possible: the factory identity
 * is fixed once per module instead of being a new closure on every render
 * ([ADR-0005](../../../../docs/adr/0005-styling-approach.md)).
 */
import { StyleSheet } from 'react-native';

import { useTheme } from './theme-context';

import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';
import type { Theme } from './theme';

/**
 * `Partial` is not used here on purpose: a style object with every property optional would make
 * `{ colour: 'red' }` (a typo) type-check as a valid empty style.
 */
type NamedStyles = Record<string, ViewStyle | TextStyle | ImageStyle>;

export function createStyles<T extends NamedStyles>(factory: (theme: Theme) => T): () => T {
  /**
   * Keyed on the theme object, so the sheet is built **once per theme for the whole app** — not
   * once per component instance. A list of 200 rows sharing one `createStyles` call does one
   * `StyleSheet.create`, and every row gets the identical object, which is what lets
   * `React.memo` on those rows actually hold.
   *
   * A `WeakMap` rather than a single slot: with one theme a slot would do, but a slot silently
   * thrashes the day a second theme exists, and the fix would have to be found by profiling.
   */
  const cache = new WeakMap<Theme, T>();

  return function useStyles(): T {
    const theme = useTheme();

    const cached = cache.get(theme);
    if (cached !== undefined) return cached;

    const created = StyleSheet.create(factory(theme));
    cache.set(theme, created);
    return created;
  };
}
