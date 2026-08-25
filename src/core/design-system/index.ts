/**
 * The design system's public surface. Features import from here and from nowhere deeper:
 *
 * ```tsx
 * import { Screen, Text, Button, useTheme } from '@/core/design-system';
 * ```
 *
 * ## What is deliberately absent
 *
 * **The tokens.** `colors`, `spacing`, `typography` and the rest are not re-exported, and a feature
 * cannot reach them. Design values are read through `useTheme()` or `createStyles()`, which is the
 * single indirection that makes a second palette a change to one object rather than to every
 * component ([ADR-0013](../../../docs/adr/0013-single-light-theme.md)).
 *
 * **`lightTheme`.** Naming a palette is exactly what product code must not do. The provider closes
 * over it; a test that needs to assert a concrete value imports `@/core/design-system/theme`
 * directly, which keeps that import visible in review rather than looking like ordinary usage.
 *
 * **`toneColor`.** Resolving a tone name to a hex string is the components' business. A feature says
 * `tone="secondary"`; if it could resolve the colour itself, it could pass it anywhere, and the
 * no-raw-colours rule would become advisory.
 */
export * from './components';

/**
 * `ThemeProvider` is here for `AppProviders` at the root; `useTheme` and `createStyles` for feature
 * components that need to lay out their own composition. `useBreakpoint` is for tablet-width
 * adjustments — the constrained content column is already handled inside `Screen`, so most screens
 * need no width query at all.
 */
export { ThemeProvider, useTheme, createStyles, useBreakpoint } from './theme';

export type { Theme, ThemeColors } from './theme';
