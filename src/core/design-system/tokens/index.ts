/**
 * The token barrel. Every value in the visual language is reachable from here and nowhere
 * else.
 *
 * Consumers inside the design system import from `../tokens`. Consumers *outside* it —
 * features, screens — import nothing from here at all: they read `useTheme()`. That is not
 * style preference, it is what makes a second palette possible later without touching a
 * component ([ADR-0013](../../../../docs/adr/0013-single-light-theme.md)), and it is why the
 * theme module is the only importer of this barrel in production code.
 */
export { colors } from './colors';
export { spacing, radius, border, opacity, size } from './metrics';
export { typography } from './typography';
export { shadow } from './shadow';
export { motion } from './motion';
export { breakpoint, BREAKPOINTS_DESC } from './breakpoint';

export type { TypographyRole } from './typography';
export type { ShadowLevelName } from './shadow';
export type { MotionDuration, MotionEasing, MotionSpring } from './motion';
export type { BreakpointName } from './breakpoint';
