/**
 * `HomeFeedView` — the home feed, composed.
 *
 * ```
 * ┌────────────────────────────┐  white
 * │ composer                   │
 * │ For You  Following  …      │  ← hairline closes the white block
 * ├────────────────────────────┤
 * │ ░ post card                │  grey canvas, inset cards
 * │ ░ post card                │
 * │ ░ Intelligent Discoveries  │
 * │ ░ post card                │
 * └────────────────────────────┘
 * ```
 *
 * ## Two surfaces, one seam
 *
 * The composer and the tabs are *chrome* — they belong to the screen and never scroll away from it
 * conceptually — so they sit on white, continuous with the header above. Everything below is *content*,
 * so it sits on the grey canvas where an inset white card reads as an object you can pick up. One seam,
 * at the tab row's hairline. Alternating the two further down would turn the canvas into stripes.
 *
 * ## Discovery is positioned, not sorted
 *
 * The carousel is injected after the second post rather than living in the post list, because it is not
 * a post: it has no author, no timestamp and no engagement. Its index is a product decision — far
 * enough down that the feed has established itself, close enough to be seen without a deliberate
 * scroll — so it is stated as a named constant rather than buried in a conditional inside a `map`.
 *
 * ## Why the list is a `map` and not three named posts
 *
 * The previous version pulled `FEED_POSTS[0..2]` into locals, which silently dropped a fourth post the
 * moment one was added. Iterating means the data decides how many cards there are, which is the only
 * arrangement that survives this being replaced by a paginated query.
 */
import { useState } from 'react';

import { Stack } from '@/core/design-system';
import { createStyles } from '@/core/design-system/theme';

import { CreatePostBar } from './CreatePostBar';
import { DiscoverySection } from './DiscoverySection';
import { FeedTabs } from './FeedTabs';
import { PostCard } from './PostCard';
import { FEED_POSTS } from '../model/feed-data';

import type { FeedTab } from '../model/feed-data';

/** The carousel follows this many posts. See the note above. */
const DISCOVERY_AFTER = 2;

const useStyles = createStyles((t) => ({
  canvas: {
    backgroundColor: t.colors.surface.secondary,
    // Clears the tab bar, so the last card can scroll fully into view rather than resting under it.
    paddingBottom: t.spacing.xl4,
  },
  /** The chrome block: white, flush to the header, closed by the tab row's own hairline. */
  chrome: {
    backgroundColor: t.colors.surface.primary,
    paddingTop: t.spacing.sm,
    gap: t.spacing.sm,
  },
  composer: { paddingHorizontal: t.spacing.md },
  /** The content column. Cards are inset from the canvas edges; the carousel bleeds past them. */
  feed: {
    paddingTop: t.spacing.md,
    gap: t.spacing.md,
  },
  card: { paddingHorizontal: t.spacing.md },
}));

export function HomeFeedView() {
  const styles = useStyles();
  const [activeTab, setActiveTab] = useState<FeedTab>('For You');

  const leading = FEED_POSTS.slice(0, DISCOVERY_AFTER);
  const trailing = FEED_POSTS.slice(DISCOVERY_AFTER);

  return (
    <Stack style={styles.canvas}>
      <Stack style={styles.chrome}>
        <Stack style={styles.composer}>
          <CreatePostBar />
        </Stack>
        <FeedTabs activeTab={activeTab} onTabChange={setActiveTab} />
      </Stack>

      <Stack style={styles.feed}>
        {leading.map((post) => (
          <Stack key={post.id} style={styles.card}>
            <PostCard post={post} />
          </Stack>
        ))}

        <DiscoverySection />

        {trailing.map((post) => (
          <Stack key={post.id} style={styles.card}>
            <PostCard post={post} />
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}
