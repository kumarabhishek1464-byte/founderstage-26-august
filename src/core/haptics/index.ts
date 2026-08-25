/**
 * The one import site for haptics. Screens and components call `haptic('tap')`; nothing reaches for
 * `expo-haptics`. See `haptics.ts` for why the vocabulary is semantic and why web is a no-op.
 */
export { haptic } from './haptics';
export type { HapticFeedback } from './haptics';
