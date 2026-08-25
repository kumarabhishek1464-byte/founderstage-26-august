/**
 * `Skeleton` is the only component here running a real animation, so the assertions are about the two
 * things that decide whether it is usable rather than decorative: the layout it reserves, and what
 * happens when the user has asked for less motion.
 *
 * `useReducedMotion` is mocked rather than the whole of Reanimated. Reanimated itself runs for real
 * under Jest — its `IS_JEST` path is the same JS path it uses on web — so `useAnimatedStyle` computes
 * an actual `backgroundColor` here. Mocking the library wholesale would replace that with a no-op and
 * the reduced-motion branch would then pass whether or not it worked.
 *
 * The colour is read with `getAnimatedStyle`, not `toHaveStyle`. Under Jest, Reanimated does not
 * re-render the host on each frame — it mutates a `jestAnimatedStyle` value that the host carries as
 * a prop — so the `style` prop keeps showing frame zero forever. Asserting the pulse through
 * `toHaveStyle` would therefore read the same value before and after time passes, which is exactly
 * the false pass these two tests exist to rule out.
 */
import { View } from 'react-native';
import { getAnimatedStyle, useReducedMotion } from 'react-native-reanimated';

import { Skeleton } from '@/core/design-system';
import { lightTheme } from '@/core/design-system/theme';
import { render, screen } from '@/test';

import type { TestElement } from '@/test';
import type { ReactElement } from 'react';

// Only `useReducedMotion` is replaced; everything else is the real module. `__esModule` has to be
// carried across explicitly — spreading the namespace copies `default` but not that flag, and without
// it Babel's interop hands `Animated` the whole namespace object instead of the default export, so
// `Animated.View` is undefined and every render fails with "element type is invalid".
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  ...jest.requireActual<object>('react-native-reanimated'),
  useReducedMotion: jest.fn(() => false),
}));

const reducedMotionMock = jest.mocked(useReducedMotion);

/**
 * `interpolateColor` returns `rgba(r, g, b, a)`, never the hex it was handed, so a token has to be
 * converted before the pulse's colour can be compared to it. Written out rather than pulled from a
 * library: this is the only place it is needed, and a colour-parsing dependency for six characters is
 * not a trade.
 */
function rgba(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, 1)`;
}

/** Same reasoning as `Divider`: a skeleton is deliberately invisible to every accessibility query. */
async function renderSkeleton(element: ReactElement): Promise<TestElement> {
  await render(<View testID="wrap">{element}</View>);

  const [bar] = screen.getByTestId('wrap').children;
  if (bar === undefined || typeof bar === 'string') {
    throw new Error('Skeleton did not render a host element');
  }
  return bar;
}

describe('Skeleton', () => {
  it('reserves a full-width text line by default', async () => {
    const bar = await renderSkeleton(<Skeleton />);

    // The reserved layout *is* the information a skeleton carries — it tells the user how much
    // content is coming. A default of `'100%'` × 16 is one line of body copy.
    expect(bar).toHaveStyle({ width: '100%', height: 16 });
  });

  it('takes a percentage width, which is what makes a stack read as a paragraph', async () => {
    const bar = await renderSkeleton(<Skeleton width="60%" />);

    expect(bar).toHaveStyle({ width: '60%' });
  });

  it('resolves each radius to a token', async () => {
    expect(await renderSkeleton(<Skeleton />)).toHaveStyle({
      borderRadius: lightTheme.radius.sm,
    });
    expect(await renderSkeleton(<Skeleton radius="lg" />)).toHaveStyle({
      borderRadius: lightTheme.radius.lg,
    });
    // `full` for a circular avatar — a large finite number, because RN does not accept `'50%'`.
    expect(await renderSkeleton(<Skeleton radius="full" />)).toHaveStyle({
      borderRadius: lightTheme.radius.full,
    });
  });

  it('is hidden from assistive tech, so twelve bars do not say "Loading" twelve times', async () => {
    const bar = await renderSkeleton(<Skeleton />);

    // The screen's loading state owns the announcement, once, at the container level.
    expect(bar).toHaveProp('accessibilityElementsHidden', true);
    expect(bar).toHaveProp('importantForAccessibility', 'no-hide-descendants');
  });

  it('still reserves its shape when reduced motion is on, and does not pulse', async () => {
    reducedMotionMock.mockReturnValue(true);
    jest.useFakeTimers();

    const bar = await renderSkeleton(<Skeleton width={120} height={40} />);

    // The decisive accessibility assertion: honouring reduced motion must not make the placeholder
    // invisible. Only the pulse is decoration; the box is the content. A user who asked for less
    // motion still needs to know how much is coming.
    expect(bar).toHaveStyle({ width: 120, height: 40 });

    // Pinned to the base neutral rather than left wherever a half-finished fade stopped.
    const base = rgba(lightTheme.colors.overlay.skeleton);
    expect(getAnimatedStyle(bar)).toMatchObject({ backgroundColor: base });

    // Half a pulse period. The colour must be *unchanged* — this is what makes the assertion mean
    // something. Reading frame zero alone would pass whether or not the branch suppressed the
    // animation, because frame zero is the base colour either way.
    jest.advanceTimersByTime(lightTheme.motion.loop.skeletonPulse / 2);
    jest.runOnlyPendingTimers();
    expect(getAnimatedStyle(bar)).toMatchObject({ backgroundColor: base });

    jest.useRealTimers();
  });

  it('pulses off the base neutral when motion is allowed', async () => {
    reducedMotionMock.mockReturnValue(false);
    jest.useFakeTimers();

    const bar = await renderSkeleton(<Skeleton />);

    // The pulse runs from `overlay.skeleton` towards `overlay.skeletonSheen`, so frame zero is the
    // base — the same value the reduced-motion case is pinned to.
    const base = rgba(lightTheme.colors.overlay.skeleton);
    expect(getAnimatedStyle(bar)).toMatchObject({ backgroundColor: base });

    // The counterpart to the assertion above: with motion allowed, the same elapsed time *must*
    // move the colour. The two tests together are what prove the branch does anything at all.
    jest.advanceTimersByTime(lightTheme.motion.loop.skeletonPulse / 2);
    jest.runOnlyPendingTimers();
    expect(getAnimatedStyle(bar)).not.toMatchObject({ backgroundColor: base });

    jest.useRealTimers();
  });
});
