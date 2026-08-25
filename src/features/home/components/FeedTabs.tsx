/**
 * `FeedTabs` — the feed's own scope selector, under the composer.
 *
 * Not navigation. These filter what the list below shows, which is why they are local state and not
 * five routes: "For You" and "Following" are the same screen with a different query, and making them
 * routes would put a back-stack entry between two views of one feed.
 *
 * Everything about a single tab — the press target, the `tab` role, the selected state, the label tone
 * and the red rule — belongs to `Tab`. This file owns only the row: which tabs exist, that it scrolls,
 * and the hairline the rules land on.
 */
import { HorizontalScroll, Tab } from '@/core/design-system';
import { createStyles } from '@/core/design-system/theme';

import { FEED_TABS } from '../model/feed-data';

import type { FeedTab } from '../model/feed-data';

interface FeedTabsProps {
  readonly activeTab: FeedTab;
  readonly onTabChange: (tab: FeedTab) => void;
}

const useStyles = createStyles((t) => ({
  scroll: {
    backgroundColor: t.colors.surface.primary,
    borderBottomWidth: t.border.hairline,
    borderBottomColor: t.colors.border.subtle,
  },
  content: {
    paddingHorizontal: t.spacing.md,
    gap: t.spacing.lg,
  },
}));

export function FeedTabs({ activeTab, onTabChange }: FeedTabsProps) {
  const styles = useStyles();

  return (
    <HorizontalScroll style={styles.scroll} contentStyle={styles.content}>
      {FEED_TABS.map((tab) => (
        <Tab
          key={tab}
          label={tab}
          selected={tab === activeTab}
          onPress={() => {
            onTabChange(tab);
          }}
        />
      ))}
    </HorizontalScroll>
  );
}
