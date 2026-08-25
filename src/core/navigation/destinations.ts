/**
 * The app's five destinations, and the only place their identity is written down.
 *
 * This is the file the `Icon` registry's docblock points at. `Icon` knows it has a glyph called
 * `coins`; it must not know that FounderStage calls that place "Capital". The mapping between a
 * drawing and a destination is information architecture, and it lives here — so re-pointing Capital
 * at `landmark` is one line, and nothing in the design system changes meaning.
 *
 * Why a registry rather than props on five call sites: the bottom bar, the desktop rail, the route
 * files and the placeholder bodies all need the same label, glyph and href. Five copies of that is
 * five places for them to disagree, and the way it disagrees is a tab whose icon says one thing and
 * whose title says another.
 *
 * ## `href` is a plain string here
 *
 * Not expo-router's `Href`. That type is a union of route literals *and* an object form
 * (`{ pathname, params }`), and this module needs to compare an href to a pathname — string work
 * that an object member makes awkward for no gain. The `as const` below keeps each value's literal
 * type, so the route check still happens: `<TabTrigger href={DESTINATIONS.capital.href} />` is
 * checked against `Href` at that call site, which is the one place a wrong route matters.
 */
import type { IconName } from '@/core/design-system';

export type DestinationName = 'home' | 'capital' | 'tools' | 'hire' | 'marketplace';

export interface Destination {
  /** Route path. Checked against expo-router's `Href` where it is passed to a trigger. */
  readonly href: string;
  /**
   * The navigator's name for the screen, which is the route *file* name and not always the
   * destination name — `/` is served by `(tabs)/index.tsx`, so Home's route is `index`. `TabTrigger`
   * matches on this, and a mismatch is a tab that renders and does nothing.
   */
  readonly route: string;
  /**
   * The destination's name, and its accessible name in every orientation. Never abbreviated — see
   * {@link barLabel}.
   */
  readonly label: string;
  readonly icon: IconName;
  /**
   * What a founder comes here to do, in one line. Rendered by `DestinationPlaceholder` while the
   * destination is empty, and worth writing properly now: it is the only description of the
   * information architecture that lives in the app rather than in a document.
   */
  readonly purpose: string;
}

/**
 * Keyed by name rather than an array of objects carrying a `name` field, so the key *is* the name
 * and the two cannot drift. `as const` preserves the literal types that `href` needs; `satisfies`
 * still checks the shape, so a missing `icon` or a typo'd glyph is a compile error.
 */
export const DESTINATIONS = {
  home: {
    href: '/',
    route: 'index',
    label: 'Home',
    icon: 'home',
    purpose: 'Everything moving across your network, newest first.',
  },
  capital: {
    href: '/capital',
    route: 'capital',
    label: 'Capital',
    icon: 'coins',
    purpose: 'Open a raise, track investor conversations, close the round.',
  },
  tools: {
    href: '/tools',
    route: 'tools',
    label: 'Tools',
    icon: 'wrench',
    purpose: 'Cap tables, runway, dilution — the maths of running a company.',
  },
  hire: {
    href: '/hire',
    route: 'hire',
    label: 'Hire',
    icon: 'userPlus',
    purpose: 'Post roles, review candidates, make offers.',
  },
  marketplace: {
    href: '/marketplace',
    route: 'marketplace',
    label: 'Marketplace',
    icon: 'store',
    purpose: 'Services and products, priced for early companies.',
  },
} as const satisfies Record<DestinationName, Destination>;

/**
 * Order, left to right in the bottom bar and top to bottom in the rail.
 *
 * Separate from `DESTINATIONS` rather than derived from `Object.keys`, because the order is a
 * decision — Home first because it is where you land, Marketplace last because it is the least
 * frequent — and a derived list would silently encode whatever order the registry happened to be
 * typed in.
 *
 * The tuple is written twice, in the annotation and in the value, and that is the mechanism rather
 * than an oversight. The annotation runs the completeness check; the value has to match the
 * annotation, so the two cannot drift. A destination added to `DESTINATIONS` and forgotten here would
 * otherwise simply not render — a missing tab, with nothing failing and no test to notice.
 */
type ExhaustiveOrder<T extends readonly DestinationName[]> =
  Exclude<DestinationName, T[number]> extends never
    ? T
    : readonly [
        'Every destination must appear in DESTINATION_ORDER. Missing:',
        Exclude<DestinationName, T[number]>,
      ];

export const DESTINATION_ORDER: ExhaustiveOrder<
  readonly ['home', 'capital', 'tools', 'hire', 'marketplace']
> = ['home', 'capital', 'tools', 'hire', 'marketplace'];

/**
 * The label the bottom bar shows under the icon, and nothing else.
 *
 * One entry, because one label does not fit: "Marketplace" at `caption` (12px, +0.1 tracking) runs
 * to roughly 67pt, and a five-up bar on a 320pt device gives each slot 64. Everything else fits, so
 * everything else is absent — a full table here would be four identical strings in a file whose job
 * is to hold the differences.
 *
 * `label` remains what assistive tech announces in both orientations. A screen reader saying
 * "Market" would be reading the abbreviation the layout needed, not the name of the destination.
 */
const BAR_LABEL: Readonly<Partial<Record<DestinationName, string>>> = {
  marketplace: 'Market',
};

export function barLabel(name: DestinationName): string {
  return BAR_LABEL[name] ?? DESTINATIONS[name].label;
}

/** Ordered hrefs, so the resolver below indexes a flat array of strings and never a tuple. */
const ORDERED_HREFS: readonly string[] = DESTINATION_ORDER.map((name) => DESTINATIONS[name].href);

/**
 * A trailing slash is the same route. expo-router hands back `/capital` on native, and a browser
 * address bar can hold `/capital/`. Root stays `/`.
 */
function normalisePath(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

/**
 * Which destination a pathname belongs to, or **-1** for none.
 *
 * The `-1` is the load-bearing part. When the header pushes `/notifications` onto the root stack,
 * the tab layout stays mounted underneath and `usePathname()` returns `/notifications` — which
 * belongs to no destination. Returning `0` there would slide the active mark to Home while each
 * item's own focus state still reported Capital, and the two would visibly disagree. So this
 * function refuses to guess, and {@link useActiveDestinationIndex} decides what to do about it.
 *
 * Pure and exported for exactly that reason: the off-tab case is the one worth a test, and testing
 * it through a hook would need a router.
 */
export function activeDestinationIndex(pathname: string): number {
  const path = normalisePath(pathname);

  const exact = ORDERED_HREFS.indexOf(path);
  if (exact !== -1) return exact;

  // Failing an exact hit, the deepest prefix wins, so `/capital/rounds/42` still resolves to
  // Capital. The trailing `/` in the test is what stops `/toolsmith` matching `/tools`, and `/` is
  // excluded outright — every path starts with it, so Home would otherwise match everything.
  let deepest = -1;
  let deepestLength = 0;

  ORDERED_HREFS.forEach((href, index) => {
    if (href === '/' || !path.startsWith(`${href}/`)) return;
    if (href.length <= deepestLength) return;

    deepest = index;
    deepestLength = href.length;
  });

  return deepest;
}
