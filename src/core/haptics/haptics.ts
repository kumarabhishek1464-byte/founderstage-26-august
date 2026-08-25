/**
 * The single home for haptic feedback. `CLAUDE.md` lists haptics as a cross-cutting concern, and
 * this is the file it means — nothing else in the app imports `expo-haptics`.
 *
 * Two things are centralised here, and both are the reason a call site must not reach for
 * `expo-haptics` itself.
 *
 * **The vocabulary is semantic, not physical.** A screen says what happened (`'success'`), never how
 * strong the buzz should be (`ImpactFeedbackStyle.Medium`). Physical vocabulary at a call site means
 * the feel of the app is distributed across every screen that ever taps the API, and retuning it is
 * then a search-and-replace over judgement calls someone made once and did not write down. The
 * design language's "subtle haptics, used sparingly" is a property of this table, and it can be
 * retuned in one place.
 *
 * **iOS and Android are genuinely different calls,** which is the other thing a call site should
 * never carry. iOS gets `UIImpactFeedbackGenerator` / `UINotificationFeedbackGenerator`; Android
 * gets `performAndroidHapticsAsync`, which routes through `View.performHapticFeedback` and so uses
 * the device's own named effects and respects the OS touch-feedback setting. `impactAsync` on
 * Android drives the raw `Vibrator` at a fixed duration and amplitude instead — a buzz rather than a
 * tick, which is precisely the cheap-feeling feedback the design language rules out, and which is
 * why Expo's own documentation steers away from it.
 *
 * Note that avoiding `Vibrator` does *not* avoid a permission: `expo-haptics` declares
 * `android.permission.VIBRATE` in its own library manifest, so it merges into the app manifest
 * whichever function is called. Anyone auditing the manifest should not go looking for a call site
 * to remove.
 *
 * ## Web is a no-op
 *
 * `expo-haptics` has a web implementation over the Vibration API, and this module deliberately does
 * not use it. Vibration is unsupported on desktop and on iOS Safari, and on Android Chrome it is a
 * duration-based buzz with none of the haptic engine's texture. A vibration that fires on one
 * browser out of four is worse than none: the interaction stops being predictable.
 *
 * ## Failure is silent, once
 *
 * Every entry point returns `void`, not a promise. Nothing in a UI waits on a haptic, and typing it
 * as awaitable would put `void haptic(…)` or a dangling `.catch()` at every call site to satisfy
 * `no-floating-promises`. The rejection is handled here.
 *
 * Rejections are expected in normal operation — simulators have no haptic engine, and some devices
 * have none either — so a failure is logged at `debug` and only the first one is logged at all. The
 * alternative is a log line on every button press on a simulator, which trains everyone to ignore
 * the log.
 *
 * ## Not implemented: a user preference
 *
 * A "haptics off" setting is a normal thing for an app like this to have, and it is not here,
 * because there is no settings screen to drive it ([ADR-0002](../../../docs/adr/0002-expo-sdk-and-dependency-policy.md)
 * and §42 of the brief both say to stop at what is needed). The point of this module is that adding
 * it later is an early return in {@link haptic} rather than an audit of call sites.
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

import { logger } from '@/core/observability';

/**
 * What happened, in the app's terms. Deliberately short: seven entries cover every interaction the
 * design language calls for, and an eighth should have to justify itself, because a haptic
 * vocabulary that grows is one that stops meaning anything.
 */
export type HapticFeedback =
  /** Moving between discrete choices — a segmented control, a slider notch, a picker row. */
  | 'selection'
  /** A primary action committed. The button press that starts something. */
  | 'tap'
  /** A switch or checkbox entering the on state. */
  | 'toggleOn'
  /** A switch or checkbox entering the off state. */
  | 'toggleOff'
  /** A task finished. Pairs with a success toast, never fired on its own. */
  | 'success'
  /** Something needs attention but nothing was lost. */
  | 'warning'
  /** The action failed. Also the pull-to-refresh-failed and form-rejected signal. */
  | 'error';

/**
 * iOS routes to one of three generators, so the map has to carry which. A discriminated union
 * rather than three separate maps: this way the `switch` below is exhaustive over the shape, and a
 * new feedback entry cannot be added without choosing a generator for it.
 */
type IosEffect =
  | { readonly generator: 'selection' }
  | { readonly generator: 'impact'; readonly style: ImpactFeedbackStyle }
  | { readonly generator: 'notification'; readonly type: NotificationFeedbackType };

/**
 * `Light` for `tap` rather than `Medium`: a primary button is not a collision between heavy
 * objects, and the design language's restraint applies to touch as much as to colour. `Rigid` for
 * the toggles because a switch should feel like a mechanism engaging, which is a crisper, less
 * cushioned tick than a button press.
 */
const IOS_EFFECT: Readonly<Record<HapticFeedback, IosEffect>> = {
  selection: { generator: 'selection' },
  tap: { generator: 'impact', style: ImpactFeedbackStyle.Light },
  toggleOn: { generator: 'impact', style: ImpactFeedbackStyle.Rigid },
  toggleOff: { generator: 'impact', style: ImpactFeedbackStyle.Rigid },
  success: { generator: 'notification', type: NotificationFeedbackType.Success },
  warning: { generator: 'notification', type: NotificationFeedbackType.Warning },
  error: { generator: 'notification', type: NotificationFeedbackType.Error },
};

/**
 * Android's named effects, which are a closer match to this vocabulary than iOS's are — it has
 * dedicated toggle and segment effects.
 *
 * `warning` maps to `Reject` because Android has no warning effect. That is a real loss of nuance:
 * a warning and an error feel identical on Android and distinct on iOS. `Reject` is still the right
 * choice — both are "this did not go as intended" signals, and the honest alternative is
 * `Context_Click`, which means something else entirely and would read as a mis-fire.
 */
const ANDROID_EFFECT: Readonly<Record<HapticFeedback, AndroidHaptics>> = {
  selection: AndroidHaptics.Segment_Tick,
  tap: AndroidHaptics.Virtual_Key,
  toggleOn: AndroidHaptics.Toggle_On,
  toggleOff: AndroidHaptics.Toggle_Off,
  success: AndroidHaptics.Confirm,
  warning: AndroidHaptics.Reject,
  error: AndroidHaptics.Reject,
};

/**
 * Module-level rather than per-call, so the log carries one line per app run instead of one per
 * press. Reset is not offered; a test that needs to observe the log spies on the transport.
 */
let hasLoggedFailure = false;

function onFailure(feedback: HapticFeedback, error: unknown): void {
  if (hasLoggedFailure) return;
  hasLoggedFailure = true;

  // `debug`, not `warn`: a device without a haptic engine is not a defect, and this is the only
  // line that will be emitted for the rest of the session, so it exists to answer "why is nothing
  // buzzing" and nothing more.
  logger.debug('Haptic feedback unavailable; further failures will not be logged', {
    feedback,
    reason: error instanceof Error ? error.message : String(error),
  });
}

function iosFeedback(feedback: HapticFeedback): Promise<void> {
  const effect = IOS_EFFECT[feedback];

  switch (effect.generator) {
    case 'selection':
      return selectionAsync();
    case 'impact':
      return impactAsync(effect.style);
    case 'notification':
      return notificationAsync(effect.type);
  }
}

/**
 * Fire a haptic. Returns immediately; the feedback happens on its own.
 *
 * ```tsx
 * <Button label="Save" onPress={() => { haptic('tap'); void save(); }} />
 * ```
 */
export function haptic(feedback: HapticFeedback): void {
  // `Platform.OS`, not a `.web.ts` extension. The three platforms need three different bodies —
  // web returns, iOS picks a generator, Android reads a different map — and a platform extension
  // splits web from native but cannot split iOS from Android, so it would leave this same switch
  // in place and add two files and a shared type module around it.
  if (Platform.OS === 'web') return;

  const effect =
    Platform.OS === 'android'
      ? performAndroidHapticsAsync(ANDROID_EFFECT[feedback])
      : iosFeedback(feedback);

  effect.catch((error: unknown) => {
    onFailure(feedback, error);
  });
}
