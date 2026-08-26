/**
 * `MessageBubble` — one row in the thread: an incoming or an outgoing message with its optional
 * reply preview, its body (or attachment), its reactions, and its footer (timestamp, edited mark,
 * read tick, pending / failed state).
 *
 * ## Direct vs group chrome
 *
 * A group thread adds two pieces of chrome that a direct thread does not: an avatar sitting on
 * the left of an incoming bubble, and the sender's name in the accent tone above the bubble body
 * (only on the *first* message of a same-sender run). Both are opt-in through `senderChrome` — a
 * direct thread passes `senderChrome === 'none'` and the row renders exactly as before.
 *
 * ## Incoming vs outgoing colour
 *
 * Both sides now sit on a light fill — incoming on `surface.secondary` (neutral grey), outgoing on
 * `surface.accentSubtle` (soft red-pink). The reference reads outgoing as a warm signal rather
 * than a dark inversion; the two shapes share the same silhouette so the run remains legible.
 *
 * ## The corner tuck
 *
 * The last bubble of a sender's run has its outer bottom corner slightly clipped — the classic
 * chat "tail" without drawing an actual tail. Applied only when `showTail` is set, so a stacked
 * run of bubbles from the same sender still reads as a single utterance.
 *
 * ## Pending and failed states
 *
 * A pending message dims to disabled and the footer shows a clock. A failed message shows a red
 * exclamation and stays fully opaque — a user should read what did not send rather than have it
 * fade into the timeline.
 */
import { Avatar, Bubble, Icon, Stack, Text, createStyles, useTheme } from '@/core/design-system';

import { AttachmentCard } from './AttachmentCard';
import { ReactionRow } from './ReactionRow';

import type { ThreadMessageDTO } from '../api/repository';

/**
 * `'none'` — direct thread. No avatar, no name row.
 * `'first-of-run'` — group thread, first bubble of a sender's run. Avatar and name row rendered.
 * `'continuation'` — group thread, later bubble of a sender's run. Avatar slot reserved but empty
 *   so the run stays aligned with the first bubble; name row suppressed.
 */
type SenderChromeMode = 'none' | 'first-of-run' | 'continuation';

interface MessageBubbleProps {
  readonly message: ThreadMessageDTO;
  readonly outgoing: boolean;
  readonly showTail: boolean;
  readonly isRead: boolean;
  readonly partnerName: string;
  readonly senderChrome?: SenderChromeMode;
  readonly onLongPress: (message: ThreadMessageDTO) => void;
  readonly onToggleReaction: (messageId: string, emoji: string) => void;
}

const useStyles = createStyles((t) => ({
  outerLeft: { alignItems: 'flex-start', paddingRight: t.spacing.xl3 },
  outerRight: { alignItems: 'flex-end', paddingLeft: t.spacing.xl3 },
  // The avatar column reserves the same width whether or not it renders a photo, so a run of
  // messages from the same sender stays visually aligned to the same left rail.
  avatarColumn: {
    width: t.size.avatarSm,
    alignItems: 'flex-start',
  },
  bubbleColumn: { flex: 1, minWidth: 0 },
  bubbleBase: {
    paddingHorizontal: t.spacing.sm,
    paddingVertical: t.spacing.xs,
  },
  tailIncoming: { borderBottomLeftRadius: t.radius.xs },
  tailOutgoing: { borderBottomRightRadius: t.radius.xs },
  senderNameRow: {
    marginBottom: t.spacing.xxs,
  },
  replyStrip: {
    borderLeftWidth: t.border.thin,
    borderLeftColor: t.colors.text.accent,
    backgroundColor: t.colors.surface.tertiary,
    borderRadius: t.radius.sm,
    paddingLeft: t.spacing.xs,
    paddingRight: t.spacing.sm,
    paddingVertical: t.spacing.xxs,
    marginBottom: t.spacing.xxs,
  },
  footer: {
    marginTop: t.spacing.xxs,
  },
  reactionsSlot: {
    marginTop: t.spacing.xxs,
  },
  attachmentSlot: {
    marginBottom: t.spacing.xxs,
  },
}));

type FooterGlyph = 'time' | 'check' | 'checks' | 'error';

function footerGlyphFor(message: ThreadMessageDTO, isRead: boolean): FooterGlyph {
  if (message.failed === true) return 'error';
  if (message.pending === true) return 'time';
  return isRead ? 'checks' : 'check';
}

export function MessageBubble({
  message,
  outgoing,
  showTail,
  isRead,
  partnerName,
  senderChrome = 'none',
  onLongPress,
  onToggleReaction,
}: MessageBubbleProps) {
  const styles = useStyles();
  const theme = useTheme();

  const outer = outgoing ? styles.outerRight : styles.outerLeft;

  // Both sides now use a light fill; body/meta tones read against a light background either way.
  const bg = outgoing ? 'accentSubtle' : 'secondary';
  const bodyTone = 'heading';
  const metaTone = 'tertiary';

  const bubbleStyle = [
    styles.bubbleBase,
    showTail && (outgoing ? styles.tailOutgoing : styles.tailIncoming),
    message.pending === true && { opacity: theme.opacity.disabled },
  ];

  const time = formatClock(message.created_at);
  const reactions = message.reactions;

  const replyWho =
    message.reply_to === null
      ? ''
      : (message.reply_to.sender_name ?? null) !== null
        ? (message.reply_to.sender_name as string)
        : message.reply_to.sender_id === null || message.reply_to.sender_id !== message.sender_id
          ? partnerName
          : 'You';

  const senderName = message.sender_name ?? null;
  const senderAvatarUrl = message.sender_avatar_url ?? null;
  // Incoming-only chrome. Outgoing bubbles never render the avatar column or name row — the
  // caller is implicit on the right side of the timeline.
  const showAvatarColumn = !outgoing && senderChrome !== 'none';
  const showAvatarPhoto = !outgoing && senderChrome === 'first-of-run';
  const showSenderName = !outgoing && senderChrome === 'first-of-run' && senderName !== null;

  const bubbleBlock = (
    <Stack direction="column" gap="xxs" style={styles.bubbleColumn} align={outgoing ? 'end' : 'start'}>
      {showSenderName ? (
        <Stack style={styles.senderNameRow}>
          <Text variant="footnote" tone="accent">
            {senderName}
          </Text>
        </Stack>
      ) : null}

      <Bubble
        background={bg}
        radius="lg"
        style={bubbleStyle}
        onLongPress={() => {
          onLongPress(message);
        }}
        accessibilityLabel={outgoing ? `You: ${message.body}` : `${senderName ?? partnerName}: ${message.body}`}
        accessibilityHint="Long press for actions"
      >
        {message.reply_to !== null ? (
          <Stack direction="column" style={styles.replyStrip}>
            <Text variant="caption" tone="accent" numberOfLines={1}>
              {replyWho}
            </Text>
            <Text variant="footnote" tone={metaTone} numberOfLines={2}>
              {message.reply_to.deleted ? 'Message deleted' : message.reply_to.body}
            </Text>
          </Stack>
        ) : null}

        {message.attachment !== null ? (
          <Stack style={styles.attachmentSlot}>
            <AttachmentCard attachment={message.attachment} />
          </Stack>
        ) : null}

        {message.body.length > 0 ? (
          <Text variant="body" tone={bodyTone}>
            {message.deleted ? 'Message deleted' : message.body}
          </Text>
        ) : null}

        <Stack direction="row" gap="xxs" align="center" justify="end" style={styles.footer}>
          {message.edited_at !== null && !message.deleted ? (
            <Text variant="caption" tone={metaTone}>
              edited
            </Text>
          ) : null}
          <Text variant="caption" tone={metaTone}>
            {time}
          </Text>
          {outgoing ? (
            <Icon
              name={footerGlyphFor(message, isRead)}
              size="sm"
              tone={message.failed === true ? 'error' : 'accent'}
            />
          ) : null}
        </Stack>
      </Bubble>

      {reactions.length > 0 ? (
        <Stack style={styles.reactionsSlot}>
          <ReactionRow
            reactions={reactions}
            alignEnd={outgoing}
            onToggle={(emoji) => {
              onToggleReaction(message.id, emoji);
            }}
          />
        </Stack>
      ) : null}
    </Stack>
  );

  // Direct chats keep the pre-existing column layout. Group incoming rows render as a two-column
  // row (avatar rail + bubble stack) so the sender's chrome stays visually anchored to the run.
  if (!showAvatarColumn) {
    return (
      <Stack direction="column" gap="xxs" style={outer} align={outgoing ? 'end' : 'start'}>
        {bubbleBlock}
      </Stack>
    );
  }

  return (
    <Stack direction="row" gap="xs" style={outer} align="start">
      <Stack style={styles.avatarColumn}>
        {showAvatarPhoto ? (
          <Avatar size="sm" name={senderName ?? partnerName} source={senderAvatarUrl ?? undefined} />
        ) : null}
      </Stack>
      {bubbleBlock}
    </Stack>
  );
}

/**
 * Human clock for a message footer. Local rather than shared with the inbox row because a bubble
 * shows `H:MM AM/PM` for every message — the day, when it changes, is carried by the separator
 * above the run, and repeating it in every footer would be noise.
 */
function formatClock(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h.toString()}:${m.toString().padStart(2, '0')} ${suffix}`;
}
