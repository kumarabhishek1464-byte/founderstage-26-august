/**
 * The `Theme` contract.
 *
 * ADR-0013 §3 proposes `export type Theme = typeof lightTheme`, on the reasoning that a future
 * `darkTheme` would then be structurally forced to be complete. **That does not work**, and it
 * was verified rather than assumed — with the token modules declared `as const`,
 * `typeof lightTheme` carries string *literal* types, so `tsc` rejects a second palette with:
 *
 *     Type '"#000000"' is not assignable to type '"#FFFFFF"'.
 *
 * The type would force a dark theme to be *identical*, not merely complete — the exact opposite
 * of the intent. See [ADR-0018](../../../../docs/adr/0018-theme-contract.md).
 *
 * So the contract is declared explicitly, and it draws a line the naive version could not:
 * **only colour is theme-variable.** Spacing, radius, type scale, motion and breakpoints are the
 * same in any palette — a dark mode that changes the spacing scale is a redesign, not a theme.
 * Those keys therefore reference the token types directly (`typeof spacing`), which keeps their
 * literal types and full autocomplete, while `colors` is widened to `string` at the leaves so a
 * second palette can supply different values.
 */
import type { colors } from '../tokens/colors';
import type { spacing, radius, border, opacity, size } from '../tokens/metrics';
import type { typography } from '../tokens/typography';
import type { shadow } from '../tokens/shadow';
import type { motion } from '../tokens/motion';
import type { breakpoint } from '../tokens/breakpoint';

/**
 * The palette shape with the values widened to `string`.
 *
 * Exactly two levels deep — group, then name — because that is the shape the palette actually
 * has. A generic deep-widen would also flatten `typography.weight`, and `fontWeight: string` is
 * not assignable to `TextStyle['fontWeight']`, so the blanket version breaks every component
 * that sets a weight. The narrow version is both safer and more honest about what varies.
 *
 * A future `darkTheme` typed as `ThemeColors` gets a compile error for a missing group or a
 * missing name, which is the audit ADR-0013 §3 was reaching for.
 */
export type ThemeColors = {
  readonly [Group in keyof typeof colors]: {
    readonly [Name in keyof (typeof colors)[Group]]: string;
  };
};

export interface Theme {
  /** The only theme-variable subtree. */
  readonly colors: ThemeColors;

  readonly spacing: typeof spacing;
  readonly radius: typeof radius;
  readonly border: typeof border;
  readonly opacity: typeof opacity;
  readonly size: typeof size;
  readonly typography: typeof typography;
  readonly shadow: typeof shadow;
  readonly motion: typeof motion;
  readonly breakpoint: typeof breakpoint;
}
