/**
 * Where the navigation chrome should show itself as being.
 *
 * `activeDestinationIndex` answers a narrower question — which destination *owns this pathname* —
 * and answers `-1` when none does. That is the honest answer and the wrong thing to render. Pushing
 * `/notifications` from the header leaves the tab layout mounted underneath, so the bar is still on
 * screen with nothing to point at; a `-1` would drop the red mark off the left edge, and a `0` would
 * park it under Home while Home is not where you were.
 *
 * So the chrome keeps pointing at the last destination that did match. That is what a user reads it
 * as anyway: the bar behind a pushed screen shows the tab you will return to.
 */
import { usePathname } from 'expo-router';
import { useState } from 'react';

import { activeDestinationIndex } from './destinations';

export function useActiveDestinationIndex(): number {
  const pathname = usePathname();
  // Home, so the very first paint has somewhere to be even if the app opens straight onto a pushed
  // route — a deep link to `/notifications` on a cold start reaches here before any tab has matched.
  const [lastMatched, setLastMatched] = useState(0);

  const index = activeDestinationIndex(pathname);

  // State rather than a ref, set during render rather than in an effect. This is React's documented
  // "adjusting state when a prop changes" case: the update is guarded by a comparison, so it runs
  // once and React re-renders before painting — no flash of the old position, and no effect firing
  // after the mark has already been drawn in the wrong place. A ref would be the smaller-looking
  // version of this and is genuinely wrong: writing one during render is invisible to React, so a
  // pathname that only changes the *fallback* would not repaint.
  if (index !== -1 && index !== lastMatched) setLastMatched(index);

  return index === -1 ? lastMatched : index;
}
