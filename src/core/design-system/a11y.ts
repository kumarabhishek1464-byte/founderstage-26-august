/**
 * Platform spellings for accessibility intents React Native does not unify.
 *
 * React Native's accessibility props are three separate platform vocabularies wearing one name.
 * `react-native-web` 0.21 translates some of them, ignores others, and — this is the part that
 * matters — **forwards anything it does not recognise straight to the DOM**, where React logs
 * `React does not recognize the <prop> prop on a DOM element` on every single render. That is not a
 * cosmetic warning: a shell with a header, a tab bar and five skeletons produces a wall of console
 * errors that hides the real ones.
 *
 * So the mapping has to be made explicit somewhere. Doing it inline gave six components six copies
 * of the same ternary and three that had not been updated at all, which is exactly what CLAUDE.md
 * Rule 3 exists to prevent. These spreads are that one home.
 *
 * ## Why spread objects rather than a hook or a component
 *
 * `Platform.OS` is fixed for the lifetime of a bundle, so this resolves once at module scope and
 * costs nothing per render — no hook call, no re-render, usable inside `memo`'d subtrees and inside
 * `Animated.View`. A component wrapper would add a node to the tree in the places these are used
 * most (list rows, tab bars, skeleton groups), which is the opposite of what is wanted.
 */
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

/**
 * Removes an element **and its whole subtree** from the accessibility tree.
 *
 * For decoration that carries no independent meaning: a focus ring, a rule between two rows, the red
 * mark under the active tab, a shimmering skeleton. A screen reader stopping on any of these
 * announces an empty element between every piece of real content.
 *
 * Both native props are needed, because iOS reads `accessibilityElementsHidden` and Android reads
 * `importantForAccessibility` and React Native does not bridge them — setting one leaves the other
 * platform announcing the element. On the web `aria-hidden` says the same thing to both.
 */
export const HIDDEN_FROM_ASSISTIVE_TECH = isWeb
  ? ({ 'aria-hidden': true } as const)
  : ({
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants',
    } as const);

/**
 * The same intent, conditionally — for a component that is decoration *or* content depending on
 * whether the caller named it.
 *
 * `Avatar` and `Icon` are both: with an `accessibilityLabel` they are an image worth announcing,
 * without one they sit next to a label that already says the thing. Passing `hidden: false` has to
 * produce the *positive* Android value rather than `undefined`, because an ancestor may have set
 * `no-hide-descendants` and only an explicit `'yes'` climbs back out of it.
 */
export function hiddenFromAssistiveTech(hidden: boolean) {
  if (isWeb) return hidden ? ({ 'aria-hidden': true } as const) : ({} as const);

  return {
    accessibilityElementsHidden: hidden,
    importantForAccessibility: hidden ? 'no-hide-descendants' : 'yes',
  } as const;
}
