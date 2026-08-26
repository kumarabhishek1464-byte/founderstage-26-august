/**
 * `FilterBar` — the horizontal strip of choices at the top of a discovery surface.
 *
 * ## What this is, and is not
 *
 * A single-selection horizontal picker. "All / Founders / Investors / Operators / Advisors" is the
 * shape. It is **not** a tab bar: switching a filter re-queries the same list, switching a tab
 * changes what the user is looking at. That distinction is what determines the accessibility role
 * (`radiogroup` here, `tablist` on `Tabs`) and the semantics — a filter can be cleared to "All", a
 * tab cannot be "unselected".
 *
 * ## Why the selected pill is a hair larger
 *
 * The design language forbids red backgrounds, so the selected filter is drawn in
 * `surface.inverse` — black on white — and inversion alone is already a strong luminance cue. The
 * `1.03` scale on top of it is a **motion** cue: a static screen with one filter black and four
 * white is a screen where the eye lands on the black pill; a live screen where the tapped pill
 * *pops* to that state is one where the eye follows the interaction. Two channels for one signal,
 * neither redundant: luminance survives colour-blindness, motion survives peripheral vision.
 *
 * The scale is small on purpose. `1.03` is 3% — enough to register when the pill sits next to its
 * unselected neighbours, small enough that the row does not appear to physically grow when tapped.
 * A larger number would reshuffle the horizontal rhythm and, on a phone in a thumb-driven row,
 * that is the kind of change that makes users tap the wrong option.
 *
 * ## Why the strip is not virtualised
 *
 * `FlashList` and `FlatList` add cell recycling that hurts more than it helps for the sizes filter
 * rows come in: 3–10 options, all visible or nearly so. A plain horizontal `ScrollView` measures
 * once, lays out once, and gets the standard `contentOffset` animation for free. Cell recycling is
 * a strategy for lists that scroll indefinitely; a filter bar does not.
 */
import { useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { createStyles } from '../theme';
import { motion } from '../tokens';
import { Chip } from './Chip';
import { HorizontalScroll } from './HorizontalScroll';

import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export interface FilterBarOption {
  readonly id: string;
  readonly label: string;
}

interface FilterBarProps {
  readonly options: readonly FilterBarOption[];
  readonly selectedId: string;
  readonly onSelect: (id: string) => void;
  readonly style?: StyleProp<ViewStyle>;
  /** Renders before the first pill — a "Filters" icon, a count, whatever the screen wants there. */
  readonly leading?: ReactNode;
}

const useStyles = createStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.sm,
  },
  leading: {
    marginRight: t.spacing.xs,
  },
}));

const SELECTED_SCALE = 1.03;
const REST_SCALE = 1;

interface SelectedScaleProps {
  readonly selected: boolean;
  readonly children: ReactNode;
}

/**
 * The tiny "pop" the selected pill wears on top of Chip's own press spring. Kept inside this file
 * because it only makes sense as a member of a group: a single Chip does not need a selected-vs-rest
 * scale, but a *row* of chips where one is the current answer does.
 *
 * The two transforms compose naturally — press-in from the Chip drops to 0.98 while this outer
 * layer holds at 1.03 → net ~1.01, which is exactly what "the emphasized pill just got tapped"
 * should feel like: it settles rather than jumping.
 */
function SelectedScale({ selected, children }: SelectedScaleProps) {
  const scale = useSharedValue(selected ? SELECTED_SCALE : REST_SCALE);

  useEffect(() => {
    scale.value = withSpring(selected ? SELECTED_SCALE : REST_SCALE, motion.spring.snappy);
  }, [selected, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}

export function FilterBar({ options, selectedId, onSelect, style, leading }: FilterBarProps) {
  const styles = useStyles();

  return (
    <HorizontalScroll style={style} contentStyle={styles.row}>
      {leading !== undefined ? <Animated.View style={styles.leading}>{leading}</Animated.View> : null}
      {options.map((option) => {
        const isSelected = option.id === selectedId;
        return (
          <SelectedScale key={option.id} selected={isSelected}>
            <Chip
              label={option.label}
              selected={isSelected}
              onPress={() => {
                // No-op re-selects are still forwarded — the caller might want to scroll a list to top,
                // or refresh a query. It is the caller's choice, not the primitive's.
                onSelect(option.id);
              }}
            />
          </SelectedScale>
        );
      })}
    </HorizontalScroll>
  );
}
