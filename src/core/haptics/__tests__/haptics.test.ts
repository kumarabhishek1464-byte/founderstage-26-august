/**
 * This is the suite that owns the *physical* mapping. `Button.test.tsx` mocks `@/core/haptics` and
 * asserts only "a press fires a tap"; the claim that a tap is `ImpactFeedbackStyle.Light` on iOS and
 * `Virtual_Key` on Android is tested here, once, because the table in `haptics.ts` is the single place
 * the feel of the app is decided.
 *
 * ## Why the platform is not mocked
 *
 * `Platform.OS` is left alone and the assertions are gated on it instead. `jest.config.js` runs every
 * suite under three projects — `ios`, `android` and `web` — so the iOS branch is exercised with
 * `Platform.OS === 'ios'` for real, on the same code path the device takes. Overriding `Platform`
 * would test a stub of the branch selector rather than the selector, and it is the selector that
 * decides whether Android gets a named device effect or the raw vibrator.
 *
 * ## What is mocked, and what is not
 *
 * The four `expo-haptics` entry points are replaced; the enums are the real ones, pulled through
 * `requireActual`. Asserting against a hand-written `'virtual-key'` string would pass even if the
 * enum member were renamed or removed upstream, which is the failure this suite most needs to catch —
 * the native side silently does nothing for an unrecognised effect.
 */
import {
  AndroidHaptics,
  ImpactFeedbackStyle,
  NotificationFeedbackType,
  impactAsync,
  notificationAsync,
  performAndroidHapticsAsync,
  selectionAsync,
} from 'expo-haptics';
import { Platform } from 'react-native';

import { haptic } from '@/core/haptics';
import { logger } from '@/core/observability';

import type { HapticFeedback } from '@/core/haptics';

// The doubles are created *inside* the factory and read back with `jest.mocked`, rather than being
// declared above and closed over. A factory runs when its module is first required, which happens
// during the hoisted imports — before any `const` in this file has been assigned — so a closed-over
// double is `undefined` under Babel's commonjs transform and a TDZ error under the web project's.
jest.mock('expo-haptics', () => ({
  __esModule: true,
  ...jest.requireActual<object>('expo-haptics'),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  performAndroidHapticsAsync: jest.fn(() => Promise.resolve()),
}));

// The whole module, not a spy on the singleton: `@/core/observability`'s index builds a logger from
// `@/core/config/env` at import time, and this suite has no business booting the environment to
// observe one `debug` call.
jest.mock('@/core/observability', () => ({ logger: { debug: jest.fn() } }));

const mockImpactAsync = jest.mocked(impactAsync);
const mockNotificationAsync = jest.mocked(notificationAsync);
const mockSelectionAsync = jest.mocked(selectionAsync);
const mockPerformAndroidHapticsAsync = jest.mocked(performAndroidHapticsAsync);
const mockDebug = jest.mocked(logger.debug);

/**
 * `haptic` attaches a `.catch` and returns synchronously, so the rejection handler runs a microtask
 * later. `setImmediate` lands after the whole microtask queue has drained, which `await Promise.resolve()`
 * would not guarantee once the rejection travels through more than one `then`.
 */
function flushRejections(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

const describeIos = Platform.OS === 'ios' ? describe : describe.skip;
const describeAndroid = Platform.OS === 'android' ? describe : describe.skip;
const describeWeb = Platform.OS === 'web' ? describe : describe.skip;
const describeNative = Platform.OS === 'web' ? describe.skip : describe;

describeIos('haptic on iOS', () => {
  it('routes a selection to the selection generator', () => {
    haptic('selection');

    // `selectionAsync` rather than a light impact: moving between picker rows is a different physical
    // event from committing an action, and iOS models that distinction with a separate generator.
    expect(mockSelectionAsync).toHaveBeenCalledTimes(1);
    expect(mockImpactAsync).not.toHaveBeenCalled();
    expect(mockNotificationAsync).not.toHaveBeenCalled();
  });

  it.each<[HapticFeedback, ImpactFeedbackStyle]>([
    ['tap', ImpactFeedbackStyle.Light],
    ['toggleOn', ImpactFeedbackStyle.Rigid],
    ['toggleOff', ImpactFeedbackStyle.Rigid],
  ])('gives %s an impact of style %s', (feedback, style) => {
    haptic(feedback);

    // `Light` for a tap and `Rigid` for the toggles is the design language's restraint expressed in
    // touch: a primary button is not a collision, and a switch should feel like a mechanism engaging.
    expect(mockImpactAsync).toHaveBeenCalledWith(style);
  });

  it.each<[HapticFeedback, NotificationFeedbackType]>([
    ['success', NotificationFeedbackType.Success],
    ['warning', NotificationFeedbackType.Warning],
    ['error', NotificationFeedbackType.Error],
  ])('gives %s the %s notification', (feedback, type) => {
    haptic(feedback);

    // Outcomes go through the notification generator, which is the one users have learned from the
    // system: an impact would read as "something was pressed" rather than "something concluded".
    expect(mockNotificationAsync).toHaveBeenCalledWith(type);
  });

  it('never reaches for the Android path', () => {
    (['selection', 'tap', 'toggleOn', 'toggleOff', 'success', 'warning', 'error'] as const).forEach(
      haptic
    );

    expect(mockPerformAndroidHapticsAsync).not.toHaveBeenCalled();
  });
});

describeAndroid('haptic on Android', () => {
  it.each<[HapticFeedback, AndroidHaptics]>([
    ['selection', AndroidHaptics.Segment_Tick],
    ['tap', AndroidHaptics.Virtual_Key],
    ['toggleOn', AndroidHaptics.Toggle_On],
    ['toggleOff', AndroidHaptics.Toggle_Off],
    ['success', AndroidHaptics.Confirm],
    ['warning', AndroidHaptics.Reject],
    ['error', AndroidHaptics.Reject],
  ])('maps %s to the %s device effect', (feedback, effect) => {
    haptic(feedback);

    expect(mockPerformAndroidHapticsAsync).toHaveBeenCalledWith(effect);
  });

  it('collapses warning and error onto the same effect, deliberately', () => {
    haptic('warning');
    haptic('error');

    // Android has no warning effect, so this nuance genuinely exists on iOS and not here. Asserted
    // rather than left implicit so that the loss is a recorded decision — the tempting alternative,
    // `Context_Click`, means "the user long-pressed an object" and would read as a mis-fire.
    expect(mockPerformAndroidHapticsAsync).toHaveBeenNthCalledWith(1, AndroidHaptics.Reject);
    expect(mockPerformAndroidHapticsAsync).toHaveBeenNthCalledWith(2, AndroidHaptics.Reject);
  });

  it('never calls impactAsync, which would drive the raw vibrator instead of a named effect', () => {
    (['selection', 'tap', 'toggleOn', 'toggleOff', 'success', 'warning', 'error'] as const).forEach(
      haptic
    );

    // This is the assertion with the most value in the file. `impactAsync` on Android does not use
    // `View.performHapticFeedback` — it drives `Vibrator` at a fixed duration and amplitude, which is
    // a buzz rather than a tick and ignores the OS touch-feedback setting. It is also the mapping a
    // future edit is most likely to reintroduce by treating the two platforms as one.
    expect(mockImpactAsync).not.toHaveBeenCalled();
    expect(mockNotificationAsync).not.toHaveBeenCalled();
    expect(mockSelectionAsync).not.toHaveBeenCalled();
  });
});

describeWeb('haptic on web', () => {
  it('does nothing at all', () => {
    (['selection', 'tap', 'toggleOn', 'toggleOff', 'success', 'warning', 'error'] as const).forEach(
      haptic
    );

    // `expo-haptics` does have a web implementation over the Vibration API and this module refuses
    // it: unsupported on desktop and on iOS Safari, and a textureless duration buzz on Android
    // Chrome. Feedback that fires on one browser in four is less predictable than none.
    expect(mockImpactAsync).not.toHaveBeenCalled();
    expect(mockNotificationAsync).not.toHaveBeenCalled();
    expect(mockSelectionAsync).not.toHaveBeenCalled();
    expect(mockPerformAndroidHapticsAsync).not.toHaveBeenCalled();
  });
});

describeNative('haptic failure handling', () => {
  it('swallows a missing engine, logging it at debug exactly once per run', async () => {
    const unavailable = new Error('no haptic engine');
    // Both platforms' entry points reject, so this single test covers whichever branch the current
    // project takes. `mockRejectedValue` rather than `…Once` because the point is three failures.
    mockImpactAsync.mockRejectedValue(unavailable);
    mockPerformAndroidHapticsAsync.mockRejectedValue(unavailable);

    // Returning `void` synchronously is the whole point: were this awaitable, every call site would
    // need `void haptic(…)` or a dangling `.catch()` to satisfy `no-floating-promises`.
    expect(() => {
      haptic('tap');
    }).not.toThrow();
    haptic('tap');
    haptic('tap');
    await flushRejections();

    // A simulator has no haptic engine and neither do some devices, so a failure is expected
    // operation rather than a defect — hence `debug`, and hence the latch. Three failures, one line:
    // a line per press would train everyone reading Metro to ignore the log, which costs more than
    // the detail it would carry.
    expect(mockDebug).toHaveBeenCalledTimes(1);
    // The context is asserted because it is the only thing that makes the single line actionable —
    // it has to say which feedback failed and why, or it answers nothing.
    expect(mockDebug).toHaveBeenCalledWith(expect.stringContaining('Haptic feedback unavailable'), {
      feedback: 'tap',
      reason: 'no haptic engine',
    });
  });
});
