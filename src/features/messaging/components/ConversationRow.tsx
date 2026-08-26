/**
 * `ConversationRow` — one entry in the inbox. A pressable `Card` that presents:
 *
 * ```
 * [avatar]  Name  ·  timestamp        ↳ right column
 *           Preview                   ↳ second line
 *           [pinned]  [muted]  [count]
 * ```
 *
 * ## Read/unread is spoken by *typography*, not by a coloured surface
 *
 * The row does not tint red when unread — the design language forbids a red *surface*, and a whole
 * inbox where a third of the rows are pink would be exactly that. Instead:
 *
 * - the name goes from `body` to `bodyStrong`, and the tone from `body` to `heading`;
 * - the timestamp goes from `tertiary` to `accent`;
 * - a small dark pill (a `Chip` inverted with `selected`) carries the unread count.
 *
 * Three weight-and-hue changes together are far easier to skim than a saturated background, and
 * they still meet WCAG 1.4.1: the difference is luminance, not colour alone.
 *
 * ## The row is not a Stack of Views
 *
 * `View` from `react-native` is banned in features, so every internal region of this row is
 * either a `Stack`, a `Text`, an `Icon`, an `Avatar` or a `Chip`. That constraint is what stops a
 * "just this once" rectangle turning into every screen's own list-row primitive — see
 * `eslint.config.js` §"RN_PRIMITIVE_RESTRICTION".
 */
import { Avatar, Card, Chip, Icon, Stack, Text } from '@/core/design-system';

import type { InboxItem } from '../model/use-inbox';

interface ConversationRowProps {
  readonly item: InboxItem;
  readonly onPress: (id: string) => void;
}

/**
 * Titles a group by its explicit name and a DM by the first partner's name. When the partner list
 * has not resolved (a message from a since-deleted account, a permission edge) `title` on the
 * conversation itself is the fallback the inbox RPC writes so this component never renders a blank
 * name.
 */
function displayTitle(item: InboxItem): string {
  if (item.type === 'group') {
    return item.title ?? 'Group chat';
  }
  const first = item.partners[0];
  return first?.name ?? item.title ?? 'Direct message';
}

/**
 * The one-line preview. Deleted messages read as "Message deleted" rather than as an empty line;
 * system events read in italics elsewhere but here we simply pass the body through so the caller
 * does not need a second render path. Long previews truncate at one line via `numberOfLines={1}`
 * on the `Text` below — the caller does not slice.
 */
function previewBody(item: InboxItem): string {
  const message = item.last_message;
  if (message === null) return 'No messages yet';
  if (message.deleted) return 'Message deleted';
  if (message.kind === 'voice') return 'Voice message';
  if (message.kind === 'attachment') return 'Attachment';
  return message.body;
}

/**
 * "9:41", "Yesterday", "Mon", "Aug 12" — the same casual timeline every mature inbox uses. A user
 * reads a *relative* time as the interesting part of an inbox row, so an absolute clock time
 * appears only when it *is* today.
 */
function shortWhen(isoOrNull: string | null): string {
  if (isoOrNull === null) return '';
  const then = new Date(isoOrNull);
  const now = new Date();

  const sameDay =
    then.getFullYear() === now.getFullYear() &&
    then.getMonth() === now.getMonth() &&
    then.getDate() === now.getDate();
  if (sameDay) {
    return then.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  const oneDay = 24 * 60 * 60 * 1000;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diffDays = Math.floor((startOfToday - then.getTime()) / oneDay);
  if (diffDays === 0) return 'Yesterday';
  if (diffDays < 7) return then.toLocaleDateString(undefined, { weekday: 'short' });
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function ConversationRow({ item, onPress }: ConversationRowProps) {
  const isUnread = item.unread_count > 0;
  const title = displayTitle(item);
  const preview = previewBody(item);
  const when = shortWhen(item.last_message_at);
  const partnerName = item.type === 'direct' ? (item.partners[0]?.name ?? undefined) : undefined;

  return (
    <Card
      padding="md"
      onPress={() => {
        onPress(item.id);
      }}
      accessibilityLabel={
        isUnread
          ? `${title}, ${String(item.unread_count)} unread. ${preview}`
          : `${title}. ${preview}`
      }
    >
      <Stack direction="row" gap="md" align="center">
        <Avatar size="md" name={item.type === 'group' ? title : partnerName} />

        <Stack direction="column" gap="xxs" fill>
          <Stack direction="row" gap="xs" align="center" justify="between">
            <Text
              variant={isUnread ? 'bodyStrong' : 'body'}
              tone={isUnread ? 'heading' : 'body'}
              numberOfLines={1}
              style={{ flexShrink: 1 }}
            >
              {title}
            </Text>
            <Text variant="caption" tone={isUnread ? 'accent' : 'tertiary'} numberOfLines={1}>
              {when}
            </Text>
          </Stack>

          <Stack direction="row" gap="xs" align="center" justify="between">
            <Text
              variant="footnote"
              tone={isUnread ? 'body' : 'secondary'}
              numberOfLines={1}
              style={{ flexShrink: 1 }}
            >
              {preview}
            </Text>
            <Stack direction="row" gap="xs" align="center">
              {item.is_pinned ? <Icon name="pinned" size="sm" tone="tertiary" /> : null}
              {item.is_muted ? <Icon name="notificationsOff" size="sm" tone="tertiary" /> : null}
              {/*
                A dark pill rather than a red one, on purpose. Red is a signal in this design
                language; a red badge on every unread row makes the whole inbox red, which then
                reads as "everything is urgent" — the same failure a whole-tab red banner would
                produce. Black-on-white inverting to white-on-black is a luminance difference,
                which every viewer perceives, and leaves the accent for the row's typography.
              */}
              {item.unread_count > 0 ? (
                <Chip size="sm" selected label={String(Math.min(item.unread_count, 99))} />
              ) : null}
            </Stack>
          </Stack>
        </Stack>
      </Stack>
    </Card>
  );
}
