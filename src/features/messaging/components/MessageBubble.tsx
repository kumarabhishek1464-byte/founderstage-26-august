/**
 * `MessageBubble` — one row in the thread: an incoming or an outgoing message with its optional
 * reply preview, its body (or attachment), its reactions, and its footer (timestamp, edited mark,
 * read tick, pending / failed state).
 *
 * ## Incoming vs outgoing
 *
 * Incoming sits on `surface.secondary` with body text in the heading tone — the muted neutral used
 * for received bubbles across the reference. Outgoing sits on `surface.inverse` (near-black) with
 * inverse text, matching the reference's dark accent bubble on the sender's side. Both use the
 * bubble radius so the two shapes are the same silhouette; only the fill differs.
 *
 * ## The corner tuck
 *
 * The bubble on the sender's most recent run has its outer bottom corner slightly clipped — the
 * classic chat "tail" without drawing an actual tail. Rendered by overriding the corner radius on
 * the outward-facing corner. Applied only when `tail` is set, so a stacked run of bubbles from the
 * same sender still reads as a single utterance.
 *
 * ## Pending and failed states
 *
 * A pending message dims to disabled and the footer shows a clock. A failed message shows a red
 * exclamation and stays fully opaque — a user should read what did not send rather than have it
 * fade into the timeline.
 */
import { Bubble, Icon, Stack, Text, createStyles, useTheme } from '@/core/design-system';

import { AttachmentCard } from './AttachmentCard';
import { ReactionRow } from './ReactionRow';

import type { ThreadMessageDTO } from '../api/repository';

interface MessageBubbleProps {
  readonly message: ThreadMessageDTO;
  readonly outgoing: boolean;
  readonly showTail: boolean;
  readonly isRead: boolean;
  readonly partnerName: string;
  readonly onLongPress: (message: ThreadMessageDTO) => void;
  readonly onToggleReaction: (messageId: string, emoji: string) => void;
}

const useStyles = createStyles((t) => ({
  outerLeft: { alignItems: 'flex-start', paddingRight: t.spacing.xl3 },
  outerRight: { alignItems: 'flex-end', paddingLeft: t.spacing.xl3 },
  bubbleBase: {
    paddingHorizontal: t.spacing.sm,
    paddingVertical: t.spacing.xs,
  },
  tailIncoming: { borderBottomLeftRadius: t.radius.xs },
  tailOutgoing: { borderBottomRightRadius: t.radius.xs },
  replyStrip: {
    borderLeftWidth: t.border.thin,
    paddingLeft: t.spacing.xs,
    paddingVertical: t.spacing.xxs,
    marginBottom: t.spacing.xxs,
  },
  replyIncoming: {
    borderLeftColor: t.colors.text.accent,
    backgroundColor: t.colors.surface.tertiary,
    borderRadius: t.radius.sm,
    paddingRight: t.spacing.sm,
  },
  replyOutgoing: {
    borderLeftColor: t.colors.text.inverse,
    backgroundColor: t.colors.overlay.scrim,
    borderRadius: t.radius.sm,
    paddingRight: t.spacing.sm,
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
  onLongPress,
  onToggleReaction,
}: MessageBubbleProps) {
  const styles = useStyles();
  const theme = useTheme();

  const outer = outgoing ? styles.outerRight : styles.outerLeft;
  const bg = outgoing ? 'inverse' : 'secondary';
  const bodyTone = outgoing ? 'inverse' : 'heading';
  const metaTone = outgoing ? 'inverse' : 'tertiary';

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
      : message.reply_to.sender_id === null || message.reply_to.sender_id !== message.sender_id
        ? partnerName
        : 'You';

  return (
    <Stack direction="column" gap="xxs" style={outer} align={outgoing ? 'end' : 'start'}>
      <Bubble
        background={bg}
        radius="lg"
        style={bubbleStyle}
        onLongPress={() => {
          onLongPress(message);
        }}
        accessibilityLabel={outgoing ? `You: ${message.body}` : `${partnerName}: ${message.body}`}
        accessibilityHint="Long press for actions"
      >
        {message.reply_to !== null ? (
          <Stack
            direction="column"
            style={[styles.replyStrip, outgoing ? styles.replyOutgoing : styles.replyIncoming]}
          >
            <Text variant="caption" tone={outgoing ? 'inverse' : 'accent'} numberOfLines={1}>
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
              tone={
                message.failed === true
                  ? 'error'
                  : isRead && message.pending !== true
                    ? 'accent'
                    : 'inverse'
              }
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
