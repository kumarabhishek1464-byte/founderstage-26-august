/**
 * `useBreakpoint` — the active width band.
 *
 * Reads the **window**, not the screen: on web that is what the user resizes, and on Android a
 * split-screen app gets a window narrower than its screen. `useWindowDimensions` re-renders on
 * change, which is the behaviour a layout query needs and the reason `Dimensions.get()` is wrong
 * here (it snapshots at first call and never updates).
 *
 * Deliberately small. The launch surface for responsive behaviour is one constrained content
 * width, handled once in `Screen` with `size.contentMaxWidth` — a plain `maxWidth`, no hook and no
 * platform extension ([ADR-0005](../../../../docs/adr/0005-styling-approach.md)). This exists for
 * tablet padding and is not a grid system.
 */
import { useWindowDimensions } from 'react-native';

import { BREAKPOINTS_DESC, breakpoint } from '../tokens/breakpoint';

import type { BreakpointName } from '../tokens/breakpoint';

/**
 * Pure, and exported so the band boundaries can be tested at 767/768/1023/1024 without
 * rendering anything. Every off-by-one in a breakpoint system lives exactly there.
 */
export function resolveBreakpoint(width: number): BreakpointName {
  // `?? 'sm'` is unreachable — `sm` is 0 and a width is never negative — but `find` is typed as
  // possibly-undefined and the alternative is a non-null assertion, which would be a worse trade
  // for the same zero runtime cost.
  return BREAKPOINTS_DESC.find((name) => width >= breakpoint[name]) ?? 'sm';
}

export function useBreakpoint(): BreakpointName {
  const { width } = useWindowDimensions();
  return resolveBreakpoint(width);
}
