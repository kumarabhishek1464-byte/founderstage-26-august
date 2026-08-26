/**
 * The navigation module's public surface — the app shell.
 *
 * Everything here exists because `src/app/**` cannot build it. The lint config bans `View`, `Text`,
 * `Pressable` and `StyleSheet` from `react-native` inside the routes tree, which is exactly the
 * restriction that stops a `_layout.tsx` from quietly growing into a component library. The chrome
 * still has to be *made* of those primitives, so it is made here, and `(tabs)/_layout.tsx` stays what
 * a layout file should be: a statement about which pieces go where.
 *
 * `NavIndicator` is intentionally absent. It is meaningless without a parent that guarantees it a
 * padding-free, border-free coordinate box, and the two components that guarantee that are in this
 * folder. Exporting it would be exporting a component that only works from two call sites.
 */
export { AppHeader } from './AppHeader';
export { DestinationPlaceholder } from './DestinationPlaceholder';
export {
  HAIRLINE_REVEAL,
  HeaderScrollProvider,
  useHeaderScrollHandler,
  useHeaderScrollY,
} from './header-scroll';
export { NavItem } from './NavItem';
export { ScreenHeader } from './ScreenHeader';
export { SideRail } from './SideRail';
export { TabBar } from './TabBar';

export { activeDestinationIndex, barLabel, DESTINATION_ORDER, DESTINATIONS } from './destinations';
export { useActiveDestinationIndex } from './use-active-destination';

export type { Destination, DestinationName } from './destinations';
export type { NavItemOrientation } from './NavItem';
