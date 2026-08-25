/**
 * Motion. The design language asks for Apple-like animation: short, eased, and never
 * bouncy for its own sake.
 *
 * Two systems, and mixing them is the usual mistake:
 *
 *   spring    physical, no duration — for anything a finger drives (sheets, drags, press)
 *   timing    duration + easing — for state changes (fade, colour, height)
 *
 * A gesture-driven surface animated with a fixed duration feels detached from the finger,
 * because the animation cannot inherit the gesture's velocity. A colour fade animated with
 * a spring overshoots, which on a colour looks like a flicker.
 *
 * Durations are deliberately short. 200ms is already at the edge of feeling slow for a
 * press; the identity is restraint, and slow is the most common way a "premium" animation
 * reads as sluggish instead.
 */
export const motion = {
  duration: {
    /** Press feedback, colour and opacity changes. Below this reads as instant. */
    instant: 100,
    /** The default. Fades, small position changes. */
    fast: 160,
    /** Entering content, expanding a section. */
    medium: 240,
    /** Full-screen or sheet transitions. The longest anything should take. */
    slow: 320,
  },

  /**
   * Periods for animation that **repeats** rather than transitions. A separate group from
   * `duration` because the two are not the same quantity and are tuned against different
   * references: a duration is how long a state change takes, and 240ms there reads as
   * responsive; a period is one cycle of an indefinite loop, and 240ms there reads as a
   * strobe. Putting a 700 into the `instant → slow` scale would corrupt the scale's meaning.
   */
  loop: {
    /**
     * One half of a skeleton pulse. `withRepeat(…, -1, true)` reverses, so a full breath is
     * twice this — about 1.4s, which is slow enough to read as breathing rather than blinking.
     */
    skeletonPulse: 700,
  },

  /**
   * Cubic-bézier control points, for `Easing.bezier(...)`. Stored as tuples rather than
   * pre-built `Easing` functions so this module imports nothing from Reanimated — a token
   * file that pulls in an animation runtime cannot be used from a test or from web SSR.
   */
  easing: {
    /**
     * The workhorse. Matches the iOS system curve closely: quick departure, gentle arrival.
     * Anything not covered by the two below should use this.
     */
    standard: [0.4, 0.0, 0.2, 1.0],
    /** Entering: decelerates into place. Content arriving should not overshoot. */
    entrance: [0.0, 0.0, 0.2, 1.0],
    /** Leaving: accelerates away. An exit does not need to be watched. */
    exit: [0.4, 0.0, 1.0, 1.0],
  },

  /**
   * Reanimated spring configs. `damping` high enough that nothing visibly oscillates —
   * a single settle, no bounce. `stiffness` is what separates "responsive" from "loose".
   */
  spring: {
    /** Press states and small toggles. Settles almost immediately. */
    snappy: { damping: 24, stiffness: 340, mass: 1 },
    /** Sheets and cards under a finger. The default for gesture-driven motion. */
    gentle: { damping: 20, stiffness: 200, mass: 1 },
  },
} as const;

/** Named durations, for `withTiming`'s `duration`. */
export type MotionDuration = keyof typeof motion.duration;
/** Named curves, for `Easing.bezier(...easing)`. */
export type MotionEasing = keyof typeof motion.easing;
/** Named spring configs, for `withSpring`. */
export type MotionSpring = keyof typeof motion.spring;
