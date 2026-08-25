/**
 * `Tab` — one label in a scope selector, with the rule that marks it.
 *
 * This exists because a tab is a control, and `Stack` is deliberately not one: it has no `onPress` and
 * no accessibility props, and features cannot reach past it to `Pressable` (the RN primitives are
 * lint-banned outside `core`). Without this, every tab row in the app re-derives a press target, a
 * role, a selected state and an underline — and gets the third of those wrong.
 *
 * ## Not navigation
 *
 * `accessibilityRole="tab"`, not `button` or `link`. A tab selects among views of the same content;
 * `NavItem` is the thing that changes route. The distinction is what tells a screen-reader user
 * whether they are about to leave the screen.
 *
 * ## The rule is always mounted
 *
 * Transparent when idle rather than absent. Mounting it on selection would shift every label up by
 * `border.marker` plus the gap, so the whole row twitches each time you change tab.
 *
 * ## The rule overlaps its container's hairline
 *
 * `marginBottom: -border.hairline` pulls it down onto the bottom border of the row that holds the
 * tabs, so the mark sits *on* the line rather than floating above it. A 1pt gap there reads as a
 * misaligned underline, which is why the negative margin is here and not left to the caller.
 */
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { createStyles } from '../theme';
import { FocusRing } from './FocusRing';
import { Text } from './Text';

import type { StyleProp, ViewStyle } from 'react-native';

interface TabProps {
  readonly label: string;
  readonly selected: boolean;
  readonly onPress: () => void;
  readonly style?: StyleProp<ViewStyle>;
}

const useStyles = createStyles((t) => ({
  tab: {
    // Top only: the rule has to reach the container's bottom border, so there is no bottom inset and
    // the height is the label plus this.
    paddingTop: t.spacing.sm,
    alignItems: 'stretch',
  },
  rule: {
    height: t.border.marker,
    marginTop: t.spacing.xs,
    marginBottom: -t.border.hairline,
    backgroundColor: t.colors.action.primary,
  },
  ruleIdle: { backgroundColor: 'transparent' },
}));

/**
 * The row is ~44pt tall — under the 48pt floor — and cannot simply be padded, because the rule must
 * stay welded to the container's hairline. `hitSlop` is the mechanism the design language already uses
 * for exactly this: the ink stays small, the target does not.
 */
const HIT_SLOP = { top: 4, bottom: 4, left: 4, right: 4 } as const;

export function Tab({ label, selected, onPress, style }: TabProps) {
  const styles = useStyles();
  const [hasKeyboardFocus, setKeyboardFocus] = useState(false);
  const [isEngaged, setEngaged] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      hitSlop={HIT_SLOP}
      onHoverIn={() => {
        setEngaged(true);
      }}
      onHoverOut={() => {
        setEngaged(false);
      }}
      onFocus={() => {
        setKeyboardFocus(true);
      }}
      onBlur={() => {
        setKeyboardFocus(false);
      }}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      // Both spellings, because they are read by different platforms: `accessibilityState` is what
      // iOS and Android consume, and `react-native-web` does not translate its `selected` member to
      // `aria-selected` — a `role="tab"` would reach the browser with no selected state at all.
      aria-selected={selected}
      style={[styles.tab, style]}
    >
      <Text variant="subhead" tone={selected || isEngaged ? 'heading' : 'secondary'}>
        {label}
      </Text>
      <View style={[styles.rule, !selected && styles.ruleIdle]} />
      <FocusRing visible={hasKeyboardFocus} radius="md" />
    </Pressable>
  );
}
