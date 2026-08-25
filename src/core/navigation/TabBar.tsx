/**
 * `TabBar` — the bottom navigation chrome. 56pt of white, one hairline, five equal slots.
 *
 * It is rendered through `<TabList asChild>`, which means expo-router owns the *behaviour* of the tabs
 * and this file owns 100% of their appearance. No `@react-navigation/bottom-tabs`, no `tabBarStyle`
 * overrides, no fighting a default that ships a grey background and a platform-specific label. The
 * cost of that is having to restate a couple of things the framework injects; the benefit is that the
 * chrome is ordinary code in this repository.
 *
 * ## The two-View structure is load-bearing
 *
 * ```
 * chrome   white, top hairline, safe-area padding      ← touches the screen edges
 *   row    56pt, five slots, clamped to 720, centred   ← no padding, no border
 *     …five NavItems…
 * ```
 *
 * `chrome` carries the safe-area insets, because a white bar has to run to the bottom of the display
 * — stopping short of the home indicator leaves a strip of whatever is behind it. `row` carries the
 * height and the content clamp.
 *
 * `flexDirection: 'column'` is restated on `chrome` because `TabList` injects
 * `{ flexDirection: 'row', justifyContent: 'space-between' }` through the slot. Without the restate,
 * `row`'s `alignSelf: 'center'` would centre on the vertical axis and the bar would collapse.
 *
 * ## Why there is no active mark
 *
 * There was one — a 24×2 red segment riding the hairline under the active slot. It is gone because the
 * active destination is already stated twice in the slot itself: `NavItem` turns both the glyph and
 * the label `accent`. A third simultaneous statement of the same fact is noise, and on a five-up bar
 * it reads as a progress indicator rather than as "you are here". The rail has never had one, so this
 * also makes the two orientations agree.
 *
 * `NavIndicator` is still used by nothing else; it is left in place because the arithmetic in it is
 * the non-obvious part, and a future segmented control will want exactly that.
 */
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createStyles } from '../design-system/theme';

import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

interface TabBarProps {
  /** The `TabTrigger` elements. Supplied by the layout; also read by expo-router's parser. */
  readonly children: ReactNode;
  /** Injected by `TabList`'s slot. Not passed by hand. */
  readonly style?: StyleProp<ViewStyle>;
}

const useStyles = createStyles((t) => ({
  chrome: {
    flexDirection: 'column',
    backgroundColor: t.colors.surface.primary,
    borderTopWidth: t.border.hairline,
    borderTopColor: t.colors.border.subtle,
  },
  row: {
    flexDirection: 'row',
    height: t.size.chrome,
    width: '100%',
    // The same clamp `Screen` puts on content. On a wide tablet in portrait the bar would otherwise
    // spread five items across 1000pt, leaving each one adrift in the middle of its own slot.
    maxWidth: t.size.contentMaxWidth,
    alignSelf: 'center',
  },
}));

export function TabBar({ children, style }: TabBarProps) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        style,
        styles.chrome,
        {
          paddingLeft: insets.left,
          paddingRight: insets.right,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <View style={styles.row} accessibilityRole="tablist">
        {children}
      </View>
    </View>
  );
}
