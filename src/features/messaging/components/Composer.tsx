/**
 * `Composer` — the sticky bottom row that turns typing into a sent message. Attachment button on the
 * left, a rounded pill holding the input and the emoji affordance, and mic → send on the right.
 *
 * ## The mic/send swap
 *
 * The trailing action is `mic` while the input is empty and `send` the moment a non-whitespace
 * character lands. Two IconButtons behind one boolean rather than a single button whose glyph
 * changes: the a11y label changes with the intent ("Record voice" vs "Send message"), and the two
 * actions are different commitments that should not share a control.
 *
 * ## The reply preview
 *
 * When the user tapped Reply on a bubble, the composer grows a small strip above the input showing
 * who is being replied to and the first line of their message, with a close button. Dismissing the
 * strip clears the reply; sending consumes it. Both are the parent screen's decisions — this
 * component only renders what it is given and reports intent.
 */
import { useCallback } from 'react';

import { Bubble, IconButton, MessageInput, Stack, Text, createStyles } from '@/core/design-system';

import type { ThreadMessageDTO } from '../api/repository';

interface ComposerProps {
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly onSend: () => void;
  readonly onAttach?: () => void;
  readonly onEmoji?: () => void;
  readonly onMic?: () => void;
  readonly replyTo: ThreadMessageDTO | null;
  readonly replyToLabel: string;
  readonly onClearReply?: () => void;
  readonly disabled?: boolean;
  /** Placeholder shown inside the input pill. Defaults to `"Message"`. */
  readonly placeholder?: string;
  /**
   * Group variant: renders the mic and the send button side-by-side at all times rather than
   * swapping one for the other. The reference draws the group composer this way; the direct
   * thread keeps the swap behaviour by leaving this unset.
   */
  readonly alwaysShowSend?: boolean;
}

const useStyles = createStyles((t) => ({
  wrapper: {
    borderTopWidth: t.border.hairline,
    borderTopColor: t.colors.border.faint,
    backgroundColor: t.colors.surface.primary,
    paddingHorizontal: t.spacing.sm,
    paddingTop: t.spacing.xs,
    paddingBottom: t.spacing.sm,
  },
  replyStrip: {
    borderLeftWidth: t.border.thin,
    borderLeftColor: t.colors.text.accent,
    backgroundColor: t.colors.surface.tertiary,
    borderRadius: t.radius.sm,
    paddingLeft: t.spacing.sm,
    paddingRight: t.spacing.xxs,
    paddingVertical: t.spacing.xxs,
    marginBottom: t.spacing.xs,
  },
  replyBody: { flex: 1, minWidth: 0 },
  pill: {
    flex: 1,
    paddingLeft: t.spacing.sm,
    paddingRight: t.spacing.xxs,
    paddingVertical: t.spacing.xxs,
  },
  pillRow: {
    minHeight: t.size.touchTarget,
  },
}));

export function Composer({
  value,
  onChangeText,
  onSend,
  onAttach,
  onEmoji,
  onMic,
  replyTo,
  replyToLabel,
  onClearReply,
  disabled = false,
  placeholder = 'Message',
  alwaysShowSend = false,
}: ComposerProps) {
  const styles = useStyles();

  const trimmed = value.trim();
  const canSend = trimmed.length > 0 && !disabled;

  const handleSend = useCallback(() => {
    if (!canSend) return;
    onSend();
  }, [canSend, onSend]);

  const noop = useCallback(() => {
    // Attachments / emoji / voice all live behind separate flows the spec calls out as staged.
    // The buttons stay so the surface reads complete and a screen reader announces the intent.
  }, []);

  return (
    <Stack direction="column" style={styles.wrapper}>
      {replyTo !== null ? (
        <Stack direction="row" align="center" gap="sm" style={styles.replyStrip}>
          <Stack direction="column" gap="xxs" style={styles.replyBody}>
            <Text variant="caption" tone="accent" numberOfLines={1}>
              Replying to {replyToLabel}
            </Text>
            <Text variant="footnote" tone="secondary" numberOfLines={1}>
              {replyTo.deleted ? 'Message deleted' : replyTo.body}
            </Text>
          </Stack>
          <IconButton
            name="close"
            tone="secondary"
            accessibilityLabel="Clear reply"
            onPress={onClearReply ?? noop}
          />
        </Stack>
      ) : null}

      <Stack direction="row" align="center" gap="xs" style={styles.pillRow}>
        <IconButton
          name="add"
          tone="heading"
          accessibilityLabel="Add attachment"
          onPress={onAttach ?? noop}
        />

        <Bubble background="secondary" radius="full" style={styles.pill}>
          <Stack direction="row" align="center" gap="xs">
            <MessageInput
              value={value}
              onChangeText={onChangeText}
              placeholder={placeholder}
              accessibilityLabel="Message"
              accessibilityHint="Type a message and tap send"
            />
            <IconButton
              name="emoji"
              tone="secondary"
              accessibilityLabel="Insert emoji"
              onPress={onEmoji ?? noop}
            />
          </Stack>
        </Bubble>

        {alwaysShowSend ? (
          <>
            <IconButton
              name="mic"
              tone="heading"
              accessibilityLabel="Record voice message"
              onPress={onMic ?? noop}
            />
            <IconButton
              name="send"
              tone="accent"
              accessibilityLabel="Send message"
              onPress={handleSend}
              disabled={!canSend}
            />
          </>
        ) : canSend ? (
          <IconButton
            name="send"
            tone="accent"
            accessibilityLabel="Send message"
            onPress={handleSend}
          />
        ) : (
          <IconButton
            name="mic"
            tone="heading"
            accessibilityLabel="Record voice message"
            onPress={onMic ?? noop}
          />
        )}
      </Stack>
    </Stack>
  );
}
