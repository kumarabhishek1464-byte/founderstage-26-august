/**
 * Breakpoint boundaries. Every off-by-one in a responsive system lives at the threshold, so the
 * table tests the value below, at, and above each one.
 */
import { resolveBreakpoint } from '../use-breakpoint';

import type { BreakpointName } from '../../tokens/breakpoint';

describe('resolveBreakpoint', () => {
  it.each<[number, BreakpointName]>([
    [0, 'sm'],
    [320, 'sm'],
    [767, 'sm'],
    [768, 'md'],
    [1023, 'md'],
    [1024, 'lg'],
    [1439, 'lg'],
    [1440, 'xl'],
    [3840, 'xl'],
  ])('resolves %ipx to %s', (width, expected) => {
    expect(resolveBreakpoint(width)).toBe(expected);
  });

  it('treats a breakpoint as a lower bound, not a range', () => {
    // Mobile-first: `md` means "768 and up", which is what makes adding a wider band later a
    // pure addition rather than a retune of every existing boundary.
    expect(resolveBreakpoint(768)).toBe('md');
    expect(resolveBreakpoint(769)).toBe('md');
  });
});
