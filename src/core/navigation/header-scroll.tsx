/**
 * `HeaderScrollContext` — the seam that lets `AppHeader` react to scroll happening under it.
 *
 * ## Why this exists as a context rather than a prop
 *
 * `AppHeader` is rendered by `(tabs)/_layout.tsx`, once, above the `Tabs` element that owns the
 * scrolling surface of each tab. There is no parent that holds both the scroll surface and the
 * header, so a scroll offset cannot be lifted to a common ancestor as a prop — the shell is that
 * ancestor, and reading `scrollY` from a child of `Tabs` is exactly what a context is for.
 *
 * ## The default is "scrolled"
 *
 * `scrollY` starts at a value large enough that `AppHeader` treats it as settled below the fold —
 * i.e. the hairline is fully visible. That is deliberate: a screen that does not wire a scroll
 * handler (a settings screen, an empty state, a signed-out placeholder) still gets the *static*
 * hairline the app had before this seam existed, so nothing regresses visually. A screen that
 * *does* wire the handler resets the value to the real scroll offset, and the hairline fades on
 * `scrollY < HAIRLINE_REVEAL`.
 *
 * ## Why one shared value across every tab
 *
 * Each tab has its own scroll surface, but only one is visible at a time. The active tab writes
 * the shared value; sibling tabs stopped writing to it the moment they unmounted or blurred. A
 * per-tab context tree would be architecturally purer and would buy nothing — the header we are
 * updating is a single element.
 */
import { createContext, useContext, useMemo } from 'react';
import { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';

import type { ReactNode } from 'react';
import type { SharedValue } from 'react-native-reanimated';

/**
 * The threshold at which the hairline reads as fully visible. 12 is roughly the height of the
 * first line of body text — enough that any real scroll intent has crossed it, small enough that a
 * touch overshoot on a bouncy list does not read as "the hairline is flickering".
 */
export const HAIRLINE_REVEAL = 12;

/** The value the shared value takes when no scroll handler is registered — see the doc above. */
const DEFAULT_SETTLED = HAIRLINE_REVEAL * 2;

interface HeaderScrollContextValue {
  readonly scrollY: SharedValue<number>;
}

const HeaderScrollContext = createContext<HeaderScrollContextValue | null>(null);

interface HeaderScrollProviderProps {
  readonly children: ReactNode;
}

export function HeaderScrollProvider({ children }: HeaderScrollProviderProps) {
  const scrollY = useSharedValue(DEFAULT_SETTLED);
  const value = useMemo<HeaderScrollContextValue>(() => ({ scrollY }), [scrollY]);
  return <HeaderScrollContext.Provider value={value}>{children}</HeaderScrollContext.Provider>;
}

/**
 * Read the current header scroll signal. Non-null on any screen wrapped by the provider, which is
 * every tab route. `AppHeader` is the intended caller.
 */
export function useHeaderScrollY(): SharedValue<number> {
  const ctx = useContext(HeaderScrollContext);
  if (ctx === null) {
    // A component that lives outside the provider still has to return a shared value — the alternative
    // is to conditionally call `useAnimatedStyle` in the caller, which is a hook order violation. This
    // fallback is stable at `DEFAULT_SETTLED`, so the caller behaves as though the screen is scrolled.
    //
    // Deliberately called at module scope through `useRef`-style memoisation is impossible here (we
    // are already in a hook body); the small allocation is the price of covering the unwrapped case.
    // eslint-disable-next-line react-hooks/rules-of-hooks -- the branch is stable per component instance.
    return useSharedValue(DEFAULT_SETTLED);
  }
  return ctx.scrollY;
}

/**
 * The handler a scrolling screen wires to its `ScrollView`, `FlatList`, or `FlashList` via
 * `onScroll`. Uses `useAnimatedScrollHandler` so the write happens on the UI thread and the header
 * animation runs at frame rate even when JS is busy.
 */
export function useHeaderScrollHandler() {
  const scrollY = useHeaderScrollY();
  return useAnimatedScrollHandler((event) => {
    // `SharedValue.value` is Reanimated's mutable interface by design; the immutability lint has
    // no awareness of the shared-value contract and would otherwise ban every legitimate write.
    // eslint-disable-next-line react-hooks/immutability
    scrollY.value = event.contentOffset.y;
  });
}
