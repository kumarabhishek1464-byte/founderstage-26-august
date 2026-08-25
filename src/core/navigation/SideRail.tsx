/**
 * `SideRail` — the same five destinations as a left-hand rail, for viewports wide enough that a
 * bottom bar would be absurd.
 *
 * A 1440pt browser window with a 56pt bar pinned to the bottom of the glass is a phone app that has
 * been stretched, and it reads as one. At `lg` and above the destinations move to a 240pt column
 * beside the content, which is what a desktop application looks like — and the shell then has one
 * genuinely different layout rather than one layout with a media query.
 *
 * The mark does not disappear on the way across. It rotates: the same 24 × 2 of `#E53935` that sat on
 * the bar's top hairline now sits on the rail's right hairline, still 24 long, still on the divider,
 * still the only red in the chrome. Someone who resizes a window from 800 to 1200 watches the
 * navigation change axis and keeps the signal.
 *
 * ## Structure
 *
 * ```
 * rail     240 wide, white, right hairline, no padding    ← the indicator's coordinate parent
 *   list   the five rows, inset 12 + safe-area left
 *   NavIndicator                                          ← sibling of `list`, not inside it
 * ```
 *
 * The indicator is a sibling of `list` for the reason set out in `NavIndicator`: it needs a parent
 * with no padding of its own, and `list` has the 16pt top inset that positions the first row. Keeping
 * the two separate means the row rhythm and the mark's travel are described by the same numbers
 * without either one having to compensate for the other's box model.
 *
 * ## Alignment with everything else
 *
 * `list`'s 12pt inset plus each row's 12pt of internal padding puts every glyph's left edge at 24 —
 * the same 24 as `AppHeader`'s wordmark lockup and the same 24 as `Screen`'s gutter on a phone. The
 * 12/12 split rather than a flat 24 is what lets a row's hover fill extend past the text on both
 * sides, so the highlight looks like a row and not like a label with a box drawn round it.
 *
 * The screen's own content is *not* on that line at rail widths: `Screen` centres its 720pt column in
 * whatever space is left, so on a 1280pt window the title lands around 424. That is deliberate — a
 * reading column belongs in the middle of the space it has, not pinned to the furniture beside it —
 * but it means the shared 24 is a property of the chrome, not of the whole page.
 */
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createStyles, useTheme } from '../design-system/theme';
import { NavIndicator } from './NavIndicator';

import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

interface SideRailProps {
  readonly activeIndex: number;
  /** The `TabTrigger` elements. Supplied by the layout; also read by expo-router's parser. */
  readonly children: ReactNode;
  /** Injected by `TabList`'s slot. Not passed by hand. */
  readonly style?: StyleProp<ViewStyle>;
}

const useStyles = createStyles((t) => ({
  // `flexDirection: 'column'` is restated because `TabList` injects a row through the slot.
  rail: {
    flexDirection: 'column',
    width: t.size.railWidth,
    backgroundColor: t.colors.surface.primary,
    borderRightWidth: t.border.hairline,
    borderRightColor: t.colors.border.subtle,
  },
  list: {
    // `paddingLeft` is applied inline, because it has to add the safe-area inset — a rail on a
    // landscape iPad sits behind the rounded corner otherwise.
    paddingTop: t.spacing.md,
    paddingRight: t.spacing.xxs,
    gap: t.spacing.xxs,
  },
}));

export function SideRail({ activeIndex, children, style }: SideRailProps) {
  const styles = useStyles();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // Row pitch is the row height plus the gap between rows, which is the whole layout — so the mark's
  // travel is the same arithmetic the rows themselves are laid out by, and the two cannot drift.
  const rowPitch = theme.size.touchTarget + theme.spacing.xxs;
  const markOffset =
    theme.spacing.md + activeIndex * rowPitch + (theme.size.touchTarget - theme.size.navMark) / 2;

  return (
    <View style={[style, styles.rail]}>
      <View
        style={[styles.list, { paddingLeft: theme.spacing.sm + insets.left }]}
        accessibilityRole="tablist"
      >
        {children}
      </View>
      <NavIndicator axis="y" offset={markOffset} />
    </View>
  );
}
