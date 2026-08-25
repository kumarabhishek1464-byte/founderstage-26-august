/**
 * `TabBar` — the bottom navigation chrome. 56pt of white, one hairline, five equal slots, and the
 * red mark riding on the hairline under whichever slot you are in.
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
 *     NavIndicator                                     ← absolutely positioned against `row`
 * ```
 *
 * `chrome` carries the safe-area insets, because a white bar has to run to the bottom of the display
 * — stopping short of the home indicator leaves a strip of whatever is behind it. `row` carries the
 * height and the content clamp, and deliberately carries **no padding and no border**, because an
 * absolutely positioned child is laid out against its parent's padding box: give `row` padding and
 * the indicator's `top: -1` stops landing on the hairline.
 *
 * `flexDirection: 'column'` is restated on `chrome` because `TabList` injects
 * `{ flexDirection: 'row', justifyContent: 'space-between' }` through the slot. Without the restate,
 * `row`'s `alignSelf: 'center'` would centre on the vertical axis and the bar would collapse.
 *
 * ## Why the indicator's position is arithmetic and not a measurement
 *
 * Five items at `flex: 1` in a known width are five equal slots, so the active slot's centre is
 * computable — no `onLayout`, no state, no first-frame jump at 0. The one thing that has to be kept
 * true is that the divisor here and the `flex: 1` in `NavItem` describe the same layout, which is why
 * the count comes from `DESTINATION_ORDER` rather than a literal 5.
 */
import { View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createStyles, useTheme } from '../design-system/theme';
import { DESTINATION_ORDER } from './destinations';
import { NavIndicator } from './NavIndicator';

import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

interface TabBarProps {
  /**
   * Which destination the mark sits under. Always a real index — `useActiveDestinationIndex` resolves
   * the off-tab case before it gets here, so there is no "nothing selected" state to draw.
   */
  readonly activeIndex: number;
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

export function TabBar({ activeIndex, children, style }: TabBarProps) {
  const styles = useStyles();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const rowWidth = Math.min(width - insets.left - insets.right, theme.size.contentMaxWidth);
  const slotWidth = rowWidth / DESTINATION_ORDER.length;
  const markOffset = activeIndex * slotWidth + (slotWidth - theme.size.navMark) / 2;

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
        <NavIndicator axis="x" offset={markOffset} />
      </View>
    </View>
  );
}
