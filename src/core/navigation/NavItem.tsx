/**
 * `NavItem` — one destination, drawn for whichever navigation orientation it finds itself in.
 *
 * One component and an `orientation` prop rather than `BarTab` and `RailTab`, because the two share
 * everything that matters: the glyph, the label, the accessible name, the selected state, the haptic,
 * the focus ring, and the rule that the label read aloud is the destination's real name. What differs
 * is a flex direction and a type role. Two components would be two places to fix a wrong
 * `accessibilityState`, and only one of them would get fixed.
 *
 * ## Half its props arrive from a slot, not from JSX
 *
 * The call site is `<TabTrigger asChild name href><NavItem destination orientation /></TabTrigger>`,
 * and expo-router's `TabTrigger` renders a Radix `Slot` that clones this element with `isFocused`,
 * `onPress`, `onLongPress`, `href` and `style` added. Radix's prop merge iterates the *child's* props,
 * so a prop the JSX above does not mention is passed straight through — which is why they are
 * declared optional here and why TypeScript is content at the call site.
 *
 * The injected `style` is `{ flexDirection: 'row', justifyContent: 'space-between' }`, which is wrong
 * for both orientations. It is therefore placed **first** in the style array and overridden. Note the
 * array lives in *this* file: the shimmed `Slot` throws in development if the element it is cloning
 * was given an array `style` in JSX, so `TabTrigger`'s child must take a single flattened value.
 *
 * ## Why press feedback is different in the two orientations
 *
 * ```
 * bar    no fill; the tone lifts 8A8A8A → 666666
 * rail   a fill; surface.secondary on hover, action.tertiaryPressed on press
 * ```
 *
 * The bar is 56pt of chrome holding five items and one hairline. Putting a grey rectangle behind a
 * tab there introduces a second competing shape and makes the sliding mark redundant, so the bar
 * acknowledges a touch by getting slightly darker and nothing else. The rail is a 240pt list of
 * 48pt rows on a desktop, where a row that does not highlight under the pointer reads as static text
 * — the convention is load-bearing, so the rail follows it.
 *
 * `pressed` is tracked in state rather than read from `Pressable`'s `style` callback because the tone
 * is needed by the *children*, not just the container, and because a function `style` cannot be
 * handed through a slot that flattens.
 */
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon, Text } from '@/core/design-system';
import { haptic } from '@/core/haptics';

// Deep import. `FocusRing` is deliberately absent from the components barrel, but that omission is
// aimed at features — they have no `Pressable` to draw a ring on, since `react-native`'s touchables
// are banned outside the design system. This module is core, it owns a `Pressable`, and it needs the
// ring for the same reason `IconButton` does. Widening the public barrel to serve one internal
// caller would trade a documented boundary for an import path.
import { FocusRing } from '@/core/design-system/components/FocusRing';
import { createStyles } from '../design-system/theme';
import { barLabel, DESTINATIONS } from './destinations';

import type { ComponentType, ReactNode } from 'react';
import type { GestureResponderEvent, PressableProps, StyleProp, ViewStyle } from 'react-native';
import type { Tone } from '@/core/design-system';
import type { DestinationName } from './destinations';

export type NavItemOrientation = 'bar' | 'rail';

interface NavItemProps {
  readonly destination: DestinationName;
  readonly orientation: NavItemOrientation;

  /**
   * Everything below is supplied by `TabTrigger`'s slot at runtime and must not be passed by hand.
   * Optional so the call site type-checks with only the two props above.
   *
   * `isFocused` is the framework's word for "this is the current route" — navigation focus, not
   * keyboard focus. It is renamed to `isActive` on the way in, because the two are genuinely
   * different states that are true at different times, and conflating them is how a focus ring ends
   * up permanently drawn around the tab you are already on.
   */
  readonly isFocused?: boolean;
  readonly onPress?: (event: GestureResponderEvent) => void;
  readonly onLongPress?: (event: GestureResponderEvent) => void;
  readonly href?: string;
  readonly style?: StyleProp<ViewStyle>;
}

/**
 * `href` on a `Pressable` is not in React Native's types, and `react-native-web` reads it anyway:
 * the rendered element becomes an `<a>`, which is what gives the tabs middle-click, ⌘-click,
 * "copy link address" and a status-bar preview on the web. Losing that would make five real URLs
 * behave like five buttons.
 *
 * One module-scope cast rather than `as any` at the JSX site — the widened type still checks every
 * other prop, and expo-router does the same thing internally with the same justification.
 */
const LinkPressable = Pressable as ComponentType<
  PressableProps & { readonly href?: string; readonly children?: ReactNode }
>;

const useStyles = createStyles((t) => ({
  /**
   * `flex: 1` is what divides the row into five equal slots, and it is the same arithmetic
   * `TabBar` uses to place the indicator — the mark and the tab it marks derive their positions from
   * one rule rather than from a measurement and a guess.
   */
  bar: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.xxs,
  },
  rail: {
    flexDirection: 'row',
    alignItems: 'center',
    height: t.size.touchTarget,
    paddingHorizontal: t.spacing.sm,
    gap: t.spacing.sm,
    borderRadius: t.radius.md,
  },
  railHovered: { backgroundColor: t.colors.surface.secondary },
  railPressed: { backgroundColor: t.colors.action.tertiaryPressed },
  /**
   * The one red pixel on the entire bottom bar. Sits below the active tab's label as a tiny
   * `#E53935` dot — the design language's "red is a signal, not a surface" rule taken to its
   * literal minimum. Every other cue (near-black tone on the glyph and label, faint grey on the
   * others) already says which tab is current; this is the confirmation, not the carrier.
   *
   * `spacing.xxs` (4pt) rather than a literal number because a bump in the spacing scale should
   * rescale the dot with everything else — a mark that stays 4 while the rest of the bar breathes
   * to 6 would suddenly look small.
   */
  activeDot: {
    width: t.spacing.xxs,
    height: t.spacing.xxs,
    borderRadius: t.radius.full,
    backgroundColor: t.colors.action.primary,
  },
  /**
   * Reserved slot the same size as `activeDot`, kept in the layout for every inactive tab so the
   * icon and label sit at the same vertical position regardless of which tab is current — swapping
   * a rendered dot in and out otherwise nudges the label by 4pt on every navigation.
   */
  activeDotPlaceholder: {
    width: t.spacing.xxs,
    height: t.spacing.xxs,
  },
}));

/**
 * Active is `text.heading` in both orientations — the same near-black the shell's own type uses,
 * so the current tab reads as "the one you are on" rather than "the one lit up in the CTA colour".
 * Inactive rests at `text.secondary` and lifts to `text.heading` while a pointer or finger is on
 * it, so a tab that is not current still signals its own affordance without pretending to be
 * chosen. Stated as a function rather than three nested ternaries at the call site because both
 * the glyph and the label need the same answer.
 *
 * The red accent used to live here, and it has moved to the 4pt `activeDot` beneath the label:
 * one signal pixel is the design language's rule, and painting five tabs in tonal grey with one
 * red dot underneath is the way that rule lands quietly.
 */
function resolveTone(isActive: boolean, isEngaged: boolean): Tone {
  if (isActive) return 'heading';
  return isEngaged ? 'heading' : 'secondary';
}

export function NavItem({
  destination,
  orientation,
  isFocused: isActive = false,
  onPress,
  onLongPress,
  href,
  style,
}: NavItemProps) {
  const styles = useStyles();
  const [isHovered, setHovered] = useState(false);
  const [isPressed, setPressed] = useState(false);
  // Keyboard focus, which is a separate fact from `isActive` above: tabbing along the bar moves this
  // without changing the route, and arriving on a destination sets the route without a keyboard ever
  // being involved.
  const [hasKeyboardFocus, setKeyboardFocus] = useState(false);

  const { label, icon } = DESTINATIONS[destination];
  const isRail = orientation === 'rail';
  const tone = resolveTone(isActive, isHovered || isPressed);

  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      // Before navigating, and `selection` rather than `tap`: moving between destinations is picking
      // from a set, which is the lighter of the two feels — the same distinction iOS draws between a
      // picker detent and a button press.
      haptic('selection');
      onPress?.(event);
    },
    [onPress]
  );

  return (
    <LinkPressable
      href={href}
      onPress={handlePress}
      onLongPress={onLongPress}
      onHoverIn={() => {
        setHovered(true);
      }}
      onHoverOut={() => {
        setHovered(false);
      }}
      onPressIn={() => {
        setPressed(true);
      }}
      onPressOut={() => {
        setPressed(false);
      }}
      onFocus={() => {
        setKeyboardFocus(true);
      }}
      onBlur={() => {
        setKeyboardFocus(false);
      }}
      // The slot's style first, so this component's layout wins over the row it tried to impose.
      style={[
        style,
        isRail ? styles.rail : styles.bar,
        isRail && isHovered && styles.railHovered,
        isRail && isPressed && styles.railPressed,
      ]}
      accessibilityRole="tab"
      // The full name, never the bar's abbreviation. "Market" is a layout compromise; it is not what
      // this place is called.
      accessibilityLabel={label}
      accessibilityState={{ selected: isActive }}
      // Both, because they are read by different platforms. `accessibilityState` is what iOS and
      // Android consume; `react-native-web` 0.21 does not translate its `selected` member to
      // `aria-selected`, so a `<a role="tab">` would reach the browser with no selected state at all —
      // verified in the rendered DOM.
      aria-selected={isActive}
    >
      <Icon name={icon} size="md" tone={tone} />
      {isRail ? (
        <Text variant="subhead" tone={tone}>
          {label}
        </Text>
      ) : (
        <>
          {/* `numberOfLines` rather than trusting the abbreviation table: a system font scale of 200%
              will overflow 64pt whatever the string says, and one clipped line is legible where two
              wrapped lines would push the glyph out of the 56pt bar. */}
          <Text variant="caption" tone={tone} numberOfLines={1}>
            {barLabel(destination)}
          </Text>
          {/* Same slot on every tab, empty until this one is current — see `activeDotPlaceholder`. */}
          <View style={isActive ? styles.activeDot : styles.activeDotPlaceholder} />
        </>
      )}
      {/**
       * Not wrapped in a spacing element. `FocusRing` is absolutely positioned, so Yoga treats it the
       * way CSS does — not a flex item — and the bar item's `gap` skips it.
       */}
      <FocusRing visible={hasKeyboardFocus && isRail} radius="md" />
    </LinkPressable>
  );
}
