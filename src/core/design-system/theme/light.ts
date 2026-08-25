/**
 * The one theme that ships. [ADR-0013](../../../../docs/adr/0013-single-light-theme.md).
 *
 * This module is the only place the token barrel is imported in production code. Everything
 * downstream — every component, every screen — reads `useTheme()`, which is the indirection a
 * second palette would need and costs one line today.
 *
 * `satisfies Theme` rather than `: Theme`: the annotation would widen the whole object, and the
 * literal types are worth keeping for anything that imports this module directly (a snapshot
 * test asserting a specific hex, for instance). `satisfies` still gives the completeness check —
 * a missing key here is a compile error.
 */
import {
  colors,
  spacing,
  radius,
  border,
  opacity,
  size,
  typography,
  shadow,
  motion,
  breakpoint,
} from '../tokens';

import type { Theme } from './theme';

export const lightTheme = {
  colors,
  spacing,
  radius,
  border,
  opacity,
  size,
  typography,
  shadow,
  motion,
  breakpoint,
} satisfies Theme;
