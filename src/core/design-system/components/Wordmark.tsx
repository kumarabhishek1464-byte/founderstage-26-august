/**
 * `Wordmark` — "FounderStage" set as two voices in one word.
 *
 * ```
 * Founder   semibold, #111111   the subject
 * Stage     regular,  #666666   the place
 * ```
 *
 * The design language's first claim is that typography carries the hierarchy. A brand mark is where
 * that claim is either true or decorative, so this one is made *of* the hierarchy rather than sitting
 * next to it: no logotype, no mark, no coloured dot — one compound word whose two halves are set at
 * two weights, which is the whole identity in twelve characters.
 *
 * ## Why it does not use `Text`
 *
 * Two reasons, and either alone would be enough.
 *
 * `Text` sets one role per element, and this needs two runs on one line with a shared baseline. Nesting
 * two `Text`s would work visually and would put an `accessibilityRole="header"` on each — see below.
 *
 * More importantly, **this must not be a heading.** `Text`'s heading roles start at `title3`, which is
 * the size this wants, and `title3` carries `role="header"` and `aria-level={3}`. A brand mark
 * announced as a heading puts "FounderStage, heading level 3" at the top of every screen's heading
 * outline, ahead of the destination the user actually navigated to. The screen's own title is the
 * heading; this is the banner.
 *
 * ## Why `text.secondary` and not `text.tertiary`
 *
 * `#8A8A8A` is the more elegant drop and it measures 3.03:1 against white, which fails WCAG AA for
 * normal-size text — and "Stage" is 18pt regular, which is normal-size. `#666666` is 5.74:1 and still
 * reads clearly as the quieter of the two voices. The contrast between the halves is carried by weight,
 * which costs nothing legibility-wise, rather than by pushing the grey until it fails.
 *
 * ## One size, for now
 *
 * There is no `size` prop because there is one placement: the app header. A splash screen or a footer
 * is the trigger to add one, and adding it then is a prop with a default — no call site changes.
 */
import { Text as RNText } from 'react-native';

import { createStyles } from '../theme';

import type { StyleProp, TextStyle } from 'react-native';

interface WordmarkProps {
  readonly style?: StyleProp<TextStyle>;
}

const useStyles = createStyles((t) => ({
  /**
   * The metrics come from `title3` so the mark sits on the type scale rather than beside it. Only
   * weight and colour are overridden per run; size, line height and tracking are shared, which is what
   * keeps the two halves on one baseline.
   */
  lockup: {
    ...t.typography.title3,
    color: t.colors.text.heading,
  },
  quiet: {
    fontWeight: t.typography.weight.regular,
    color: t.colors.text.secondary,
  },
}));

export function Wordmark({ style }: WordmarkProps) {
  const styles = useStyles();

  return (
    <RNText
      style={[styles.lockup, style]}
      // One label for the whole mark. Without it, some screen readers pause at the run boundary and
      // announce "Founder. Stage." as two words — which is not the name of the product.
      accessibilityLabel="FounderStage"
      // `text` rather than the default, so the mark is one accessibility element and the nested run
      // below is not offered as a second stop.
      accessibilityRole="text"
    >
      Founder
      <RNText style={styles.quiet}>Stage</RNText>
    </RNText>
  );
}
