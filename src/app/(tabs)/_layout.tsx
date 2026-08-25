/**
 * The shell. A header that never moves, five destinations, and one decision: bar or rail.
 *
 * Every component here comes from `@/core/navigation`, which is the point — `src/app/**` is barred
 * from importing `react-native`'s primitives, so a layout file physically cannot grow into a
 * component. What is left is the only thing a layout should say: which pieces, in which order.
 *
 * ## Why `expo-router/ui` and not `Tabs` from `expo-router`
 *
 * The default `Tabs` is `@react-navigation/bottom-tabs`, which brings its own bar — a grey-tinted
 * background, platform-specific label metrics, and a set of `tabBarStyle` escape hatches to override
 * them with. Overriding a bar into submission gets you something that is nearly right on one platform.
 * `expo-router/ui` hands over the markup instead: the framework keeps the navigator state, the focus
 * tracking, the deep links and the back behaviour, and `TabBar`/`SideRail` draw every pixel.
 *
 * ## The single breakpoint
 *
 * ```
 *  <1024   bar    phone portrait and landscape, tablet portrait
 *  ≥1024   rail   tablet landscape, desktop web
 * ```
 *
 * One breakpoint rather than three, because there are only two ways to arrange this. `md` (768) is
 * tempting and wrong: a 768pt iPad in portrait is held like a large phone and reaching a bottom bar is
 * still easier than reaching a rail. The change belongs where the pointer arrives, not where the pixels
 * do.
 */
import { useBreakpoint } from '@/core/design-system';
import {
  AppHeader,
  DESTINATION_ORDER,
  DESTINATIONS,
  NavItem,
  SideRail,
  TabBar,
  useActiveDestinationIndex,
} from '@/core/navigation';
import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';

export default function TabsLayout() {
  const activeIndex = useActiveDestinationIndex();
  const breakpoint = useBreakpoint();
  const isRail = breakpoint === 'lg' || breakpoint === 'xl';

  /**
   * One array, built once and handed to whichever chrome is mounted. expo-router walks the children of
   * `TabList` with `React.Children.forEach`, which flattens arrays, so a keyed array registers as five
   * triggers exactly as five sibling elements would — and the alternative, writing the five out twice,
   * is two lists to keep in step.
   */
  const triggers = DESTINATION_ORDER.map((name) => (
    <TabTrigger key={name} name={DESTINATIONS[name].route} href={DESTINATIONS[name].href} asChild>
      <NavItem destination={name} orientation={isRail ? 'rail' : 'bar'} />
    </TabTrigger>
  ));

  return (
    <>
      {/* Outside `Tabs`, so it does not participate in the tab transition. The application's identity
          is not a per-screen element. */}
      <AppHeader />

      {/* `flex: 1` is restated because `Tabs` spreads its own `style` before `...rest`, so anything
          passed here replaces its default rather than merging with it. */}
      <Tabs style={{ flex: 1, flexDirection: isRail ? 'row' : 'column' }}>
        {isRail ? (
          <>
            <TabList asChild>
              <SideRail activeIndex={activeIndex}>{triggers}</SideRail>
            </TabList>
            <TabSlot />
          </>
        ) : (
          <>
            {/* Content first, chrome second: the bar sits at the bottom of the column. */}
            <TabSlot />
            <TabList asChild>
              <TabBar activeIndex={activeIndex}>{triggers}</TabBar>
            </TabList>
          </>
        )}
      </Tabs>
    </>
  );
}
