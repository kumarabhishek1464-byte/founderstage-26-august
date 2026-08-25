/**
 * `FocusRing` — the keyboard-focus indicator, in one place because every interactive primitive needs
 * it and none of them should draw it.
 *
 * ## Why it is a ring drawn by us and not the browser's outline
 *
 * `react-native-web` does emit a default focus outline, and it is the wrong one: it is the user
 * agent's, so it differs between Chrome, Safari and Firefox, it does not follow `border.focus`, and
 * it traces the element's border-box — which on a circular `IconButton` means a rectangle around a
 * circle. Native has no outline concept at all, so an external-keyboard user on an iPad gets nothing.
 * Drawing it ourselves is the only version that is the same shape, the same weight and the same
 * colour everywhere.
 *
 * ## Why it is absolutely positioned outside the control
 *
 * A `borderWidth` on the control itself would change its layout the moment it gained focus — a 40pt
 * icon button becoming 44pt, shifting everything after it in the row. This is a sibling that floats
 * `border.focus + 1` outside the parent's box, so focus costs no layout. The `+ 1` is the visible
 * gap: a ring flush against a control reads as a thick border rather than a ring, and against a
 * bordered control it reads as nothing at all.
 *
 * ## Why the ring is blue in a red-and-white design language
 *
 * `colors.focus.ring` is `#1F5FA8`, not the brand red, and that is deliberate: red in this palette
 * means "this is the action". A focus ring means "this is where the keyboard is", which is a
 * different statement, and painting it red would make every tab-stop look like a primary button. It
 * is also the one place a blue is permitted, because a focus indicator is a platform convention
 * before it is a brand surface.
 *
 * Hidden from assistive tech: focus is already announced by the platform, and a screen reader
 * stopping on the ring itself would announce an empty element between every control.
 */
import { View } from 'react-native';

import { HIDDEN_FROM_ASSISTIVE_TECH } from '../a11y';
import { createStyles } from '../theme';

export type FocusRingRadius = 'md' | 'lg' | 'full';

interface FocusRingProps {
  /**
   * Whether the control currently has keyboard focus. Rendering nothing when `false` rather than
   * toggling opacity, so an unfocused control has no extra node in the tree at all — this sits
   * inside list rows and tab bars, where the node count is multiplied.
   */
  readonly visible: boolean;
  /**
   * Matched to the control's own radius, one step larger in effect because the ring sits outside it.
   * Named rather than numeric so a caller cannot pass a value that leaves the ring's corners cutting
   * across the control's.
   */
  readonly radius?: FocusRingRadius;
}

const useStyles = createStyles((t) => {
  // The offset the ring floats at, outside the parent's box. Computed once here rather than repeated
  // in three entries, because the relationship (`ring weight + 1pt of air`) is the decision.
  const inset = -(t.border.focus + t.border.hairline);

  const ring = {
    position: 'absolute',
    top: inset,
    left: inset,
    right: inset,
    bottom: inset,
    borderWidth: t.border.focus,
    borderColor: t.colors.focus.ring,
    // In the style rather than as a prop: the `pointerEvents` prop is deprecated in React Native and
    // `react-native-web` logs it on every render.
    pointerEvents: 'none',
  } as const;

  return {
    // A rectangular control's ring needs a slightly larger radius than the control, or the corner
    // arcs run at different centres and the gap pinches. One step up the scale is that correction.
    md: { ...ring, borderRadius: t.radius.lg },
    lg: { ...ring, borderRadius: t.radius.xl },
    full: { ...ring, borderRadius: t.radius.full },
  };
});

export function FocusRing({ visible, radius = 'md' }: FocusRingProps) {
  const styles = useStyles();

  if (!visible) return null;

  return <View style={styles[radius]} {...HIDDEN_FROM_ASSISTIVE_TECH} />;
}
