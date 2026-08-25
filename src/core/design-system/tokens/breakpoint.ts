/**
 * Breakpoints, in dp on native and CSS px on web, measured against **window** width rather
 * than screen width — on web the window is what the user resizes, and on native a split-screen
 * Android app gets a window narrower than its screen.
 *
 * Only two things need these at launch: the constrained content width on web (a founder
 * profile stretched across a 2560px monitor is the failure this prevents) and tablet padding.
 * Everything else is a single-column phone layout that works unchanged at every width, which
 * is why there are four values and not a grid system —
 * [ADR-0005](../../../../docs/adr/0005-styling-approach.md).
 *
 * These are lower bounds, mobile-first: `md` means "768 and up". `sm` is `0` so that every
 * width matches exactly one name and `useBreakpoint` never has to return `undefined`.
 *
 * The cap on a text column is *not* here — it is `size.contentMaxWidth`, because it is a
 * typographic measure (~70 characters) rather than a device threshold, and conflating the two
 * is how a max-width ends up changing every time a breakpoint is retuned.
 */
export const breakpoint = {
  /** Phones. The base case; no query needed to hit it. */
  sm: 0,
  /** Tablets in portrait, narrow desktop windows. The tablet/phone divide. */
  md: 768,
  /** Desktop, tablets in landscape. */
  lg: 1024,
  /** Wide desktop. Nothing gets *wider* here — layouts get more margin. */
  xl: 1440,
} as const;

export type BreakpointName = keyof typeof breakpoint;

/**
 * Ordered widest-first, so a resolver returns the first threshold a width clears. Derived
 * from the object rather than written out again: a fifth breakpoint added above without a
 * matching entry here would otherwise be silently unreachable.
 */
export const BREAKPOINTS_DESC: readonly BreakpointName[] = (
  Object.keys(breakpoint) as BreakpointName[]
).sort((a, b) => breakpoint[b] - breakpoint[a]);
