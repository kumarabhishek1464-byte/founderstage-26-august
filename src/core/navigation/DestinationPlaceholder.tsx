/**
 * `DestinationPlaceholder` — what a destination says while it has nothing to say.
 *
 * Three lines, each doing one job and getting quieter:
 *
 * ```
 * Capital                                                        title1 / #111111
 * Open a raise, track investor conversations, close the round.    body   / #666666
 * Nothing here yet. This is the shell.                           footnote / #8A8A8A
 * ```
 *
 * The third line exists because the first two do not distinguish "empty" from "broken". A screen
 * showing a title and a description and no content is exactly what a failed data fetch looks like,
 * and the whole point of this shell is that someone opens it in Expo Go and in a browser and judges
 * what they see. So it says what is true, in the interface's voice, without apologising for it.
 *
 * The middle line is the destination's `purpose` from the registry, and it is not filler. It is the
 * only statement of the information architecture that lives in the running app rather than in a
 * document — five sentences that say what the product is, checked against the thing itself.
 *
 * This is not an `EmptyState` component and should not become one by accident. "No results for your
 * search" and "this is not built yet" are different messages with different remedies, and a shared
 * component would end up with a prop that selects between them.
 */
import { View } from 'react-native';

import { Text } from '@/core/design-system';

import { createStyles } from '../design-system/theme';
import { DESTINATIONS } from './destinations';

import type { DestinationName } from './destinations';

interface DestinationPlaceholderProps {
  readonly destination: DestinationName;
}

const useStyles = createStyles((t) => ({
  /**
   * Top-aligned, one and a half steps down from the header, rather than centred in the viewport.
   * Centring is the reflex for an empty screen and it is wrong here: these will be scrolling lists,
   * and a title that starts at the top now stays where it is when content arrives, so switching tabs
   * in the finished app does not move the heading.
   */
  block: {
    paddingTop: t.spacing.xl3,
    gap: t.spacing.xs,
  },
  /** Separated from the pair above it — the disclosure is an aside, not part of the description. */
  aside: {
    paddingTop: t.spacing.md,
  },
}));

export function DestinationPlaceholder({ destination }: DestinationPlaceholderProps) {
  const styles = useStyles();
  const { label, purpose } = DESTINATIONS[destination];

  return (
    <View style={styles.block}>
      <Text variant="title1" tone="heading">
        {label}
      </Text>
      <Text variant="body" tone="secondary">
        {purpose}
      </Text>
      <View style={styles.aside}>
        <Text variant="footnote" tone="tertiary">
          Nothing here yet. This is the shell.
        </Text>
      </View>
    </View>
  );
}
