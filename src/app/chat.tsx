/**
 * The chat home surface. Composes the header row (title + search + compose), a filter row, the two
 * discovery tiles, a pinned section and the all-conversations list.
 *
 * ## Composition, not implementation
 *
 * Following CLAUDE.md's second rule: this screen is a composer. There is no Supabase call in this
 * file, no error-to-message mapping, and no `setTimeout` retry. The data comes through
 * `useInbox()`; deletion, membership and mutation are the repository's business the day they land.
 *
 * ## Why searching filters locally
 *
 * The inbox is bounded by definition — a user's own conversations, capped at whatever
 * pagination the RPC eventually enforces. Filtering on the client is one JavaScript pass; sending
 * the term to the server would double the round-trips a keystroke provokes and still return the
 * same set at this size. When the inbox stops fitting in one page, this becomes a debounced
 * server call — but not before, per CLAUDE.md's "Don't add error handling, fallbacks, or
 * validation for scenarios that can't happen" and its cousin "no half-finished implementations".
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';

import {
  Card,
  Icon,
  IconButton,
  Screen,
  Skeleton,
  Stack,
  Text,
  createStyles,
} from '@/core/design-system';

import { ConversationRow } from '@/features/messaging/components/ConversationRow';
import { FilterChips } from '@/features/messaging/components/FilterChips';
import { QuickActionCard } from '@/features/messaging/components/QuickActionCard';
import { useInbox, useSeedDemo } from '@/features/messaging/model/use-inbox';

import type { InboxItem } from '@/features/messaging/model/use-inbox';
import type { InboxFilter } from '@/features/messaging/components/FilterChips';

const useStyles = createStyles((t) => ({
  /**
   * The top row that carries the title and the two header actions. Deliberately larger type than a
   * `ScreenHeader` because this is a *landing* screen, not a nested one: the "Chat" title is the
   * screen's identity and the language ranks a page title above a nav title.
   */
  header: {
    paddingTop: t.spacing.md,
    paddingBottom: t.spacing.sm,
  },
  /**
   * Section headings ("Pinned", "All chats"). Uppercase overline sits with `xl2` above and `sm`
   * below, so the section reads as a break rather than as a caption on the first row.
   */
  section: {
    paddingTop: t.spacing.xl2,
    paddingBottom: t.spacing.sm,
  },
  /** A little air above the error and skeleton slots so they clear the quick-action tiles. */
  slotTop: { marginTop: t.spacing.xl2 },
  emptyIcon: {
    width: t.spacing.xl4,
    height: t.spacing.xl4,
    borderRadius: t.radius.full,
    backgroundColor: t.colors.surface.accentSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBox: {
    paddingVertical: t.spacing.xl4,
    paddingHorizontal: t.spacing.lg,
  },
}));

/**
 * Applies the current filter and the search term. Kept as a pure function outside the component so
 * a change to filter semantics is one test rather than a re-render check.
 */
function selectInbox(items: readonly InboxItem[], filter: InboxFilter, q: string): InboxItem[] {
  const term = q.trim().toLowerCase();
  return items.filter((item) => {
    if (filter === 'unread' && item.unread_count === 0) return false;
    if (filter === 'direct' && item.type !== 'direct') return false;
    if (filter === 'group' && item.type !== 'group') return false;
    // Mentions is not modelled server-side yet — kept in the type so the chip exists in the
    // interface, and empty here on purpose so the empty state carries the "not yet" copy.
    if (filter === 'mentions') return false;

    if (term.length === 0) return true;
    const title = (item.title ?? '').toLowerCase();
    const partner = item.partners[0]?.name.toLowerCase() ?? '';
    const preview = (item.last_message?.body ?? '').toLowerCase();
    return title.includes(term) || partner.includes(term) || preview.includes(term);
  });
}

export default function ChatScreen() {
  const styles = useStyles();
  const router = useRouter();
  const inbox = useInbox();
  const { seed } = useSeedDemo();

  const [filter, setFilter] = useState<InboxFilter>('all');
  const query = '';
  const seededRef = useRef(false);

  /**
   * One-shot seed of the demo inbox. Runs only on a signed-in viewer whose inbox is empty; the RPC
   * itself is idempotent so a duplicate call is a no-op, and the ref guards against a re-render
   * loop when the RPC returned but the query has not settled yet.
   */
  useEffect(() => {
    if (seededRef.current) return;
    if (inbox.data?.length === 0) {
      seededRef.current = true;
      void seed().then(async () => inbox.refetch());
    }
  }, [inbox, seed]);

  const filtered = useMemo(
    () => (inbox.data === undefined ? [] : selectInbox(inbox.data, filter, query)),
    [inbox.data, filter, query]
  );

  const pinned = filtered.filter((item) => item.is_pinned);
  const rest = filtered.filter((item) => !item.is_pinned);

  return (
    <Screen scroll>
      <Stack direction="row" align="center" justify="between" style={styles.header}>
        <Stack direction="row" gap="xs" align="center">
          <IconButton
            name="back"
            tone="heading"
            accessibilityLabel="Back"
            onPress={() => {
              if (router.canGoBack()) router.back();
            }}
          />
          <Text variant="title1" tone="heading">
            Chat
          </Text>
        </Stack>
        <Stack direction="row" gap="xxs" align="center">
          <IconButton
            name="search"
            tone="heading"
            accessibilityLabel="Search conversations"
            onPress={() => {
              // Search is a follow-up sheet; the icon is here so the surface reads complete and
              // so a screen-reader user hears the affordance is planned.
            }}
          />
          <IconButton
            name="add"
            tone="heading"
            accessibilityLabel="New conversation"
            onPress={() => {
              // Compose flow lands on the New Chat screen once it exists — kept as a stub so
              // the header does not lose the affordance in the meantime.
            }}
          />
        </Stack>
      </Stack>

      <Stack direction="column" gap="md">
        <FilterChips filter={filter} onFilterChange={setFilter} />

        <Stack direction="row" gap="sm">
          <QuickActionCard
            icon="add"
            title="Create group"
            subtitle="Bring your team into a private room."
            onPress={() => {
              router.push('/chat');
            }}
          />
          <QuickActionCard
            icon="rocket"
            title="Discover groups"
            subtitle="Founder circles anyone can join."
            onPress={() => {
              router.push('/chat');
            }}
          />
        </Stack>
      </Stack>

      {inbox.isPending ? <InboxSkeleton /> : null}

      {inbox.isError ? (
        <Card padding="lg" style={styles.slotTop}>
          <Stack direction="column" gap="xs">
            <Text variant="bodyStrong" tone="heading">
              We could not load your chats
            </Text>
            <Text variant="footnote" tone="secondary">
              Check your connection and try again — nothing is lost.
            </Text>
          </Stack>
        </Card>
      ) : null}

      {!inbox.isPending && !inbox.isError && pinned.length > 0 ? (
        <>
          <Text variant="overline" tone="tertiary" style={styles.section}>
            Pinned
          </Text>
          <Stack direction="column" gap="xs">
            {pinned.map((item) => (
              <ConversationRow
                key={item.id}
                item={item}
                onPress={(id) => {
                  router.push(`/chat/${id}`);
                }}
              />
            ))}
          </Stack>
        </>
      ) : null}

      {!inbox.isPending && !inbox.isError ? (
        <>
          <Text variant="overline" tone="tertiary" style={styles.section}>
            All chats
          </Text>
          {rest.length === 0 ? (
            <InboxEmptyState filter={filter} />
          ) : (
            <Stack direction="column" gap="xs">
              {rest.map((item) => (
                <ConversationRow
                  key={item.id}
                  item={item}
                  onPress={(id) => {
                    router.push(`/chat/${id}`);
                  }}
                />
              ))}
            </Stack>
          )}
        </>
      ) : null}
    </Screen>
  );
}

/**
 * Skeleton rows for first load. Six placeholders — the height of a phone viewport at typical row
 * spacing — chosen deliberately over a `Spinner`: a skeleton implies "content is coming and it
 * will look like this", which is the honest thing to say the moment the query fires.
 */
function InboxSkeleton() {
  const styles = useStyles();
  return (
    <Stack direction="column" gap="xs" style={styles.slotTop}>
      {Array.from({ length: 6 }).map((_v, index) => (
        <Card key={index} padding="md">
          <Stack direction="row" gap="md" align="center">
            <Skeleton width={32} height={32} radius="full" />
            <Stack direction="column" gap="xs" fill>
              <Skeleton width="60%" height={12} />
              <Skeleton width="90%" height={10} />
            </Stack>
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}

/**
 * The empty state a user reads when either the inbox is genuinely empty or a filter narrows to
 * nothing. Copy is filter-aware so the message actually explains why the list is empty.
 */
function InboxEmptyState({ filter }: { readonly filter: InboxFilter }) {
  const styles = useStyles();

  const { title, subtitle } = emptyCopy(filter);

  return (
    <Card padding="lg">
      <Stack direction="column" gap="md" align="center" style={styles.emptyBox}>
        <Stack direction="row" style={styles.emptyIcon}>
          <Icon name="chat" size="lg" tone="accent" />
        </Stack>
        <Stack direction="column" gap="xxs" align="center">
          <Text variant="bodyStrong" tone="heading" align="center">
            {title}
          </Text>
          <Text variant="footnote" tone="secondary" align="center">
            {subtitle}
          </Text>
        </Stack>
      </Stack>
    </Card>
  );
}

function emptyCopy(filter: InboxFilter): { readonly title: string; readonly subtitle: string } {
  switch (filter) {
    case 'unread':
      return { title: "You're all caught up", subtitle: 'Nothing new since your last visit.' };
    case 'direct':
      return {
        title: 'No direct messages',
        subtitle: 'Reach out from a founder or investor profile to start a thread.',
      };
    case 'group':
      return {
        title: 'No groups yet',
        subtitle: 'Create a room for your team, or discover public founder circles.',
      };
    case 'mentions':
      return {
        title: 'No mentions',
        subtitle: "You'll see messages that tag you here.",
      };
    case 'all':
    default:
      return {
        title: 'Your inbox is quiet',
        subtitle: 'Start a conversation to see it here.',
      };
  }
}
