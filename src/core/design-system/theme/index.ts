/**
 * The theme layer's public surface.
 *
 * `lightTheme` is exported for the provider and for tests that assert a concrete value; product
 * code reads `useTheme()` and `createStyles()` and never names a palette
 * ([ADR-0013](../../../../docs/adr/0013-single-light-theme.md)).
 */
export { lightTheme } from './light';
export { ThemeProvider, useTheme } from './theme-context';
export { createStyles } from './create-styles';
export { useBreakpoint, resolveBreakpoint } from './use-breakpoint';

export type { Theme, ThemeColors } from './theme';
