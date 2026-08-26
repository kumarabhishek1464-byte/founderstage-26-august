/**
 * `MessageActionSheet` — the bottom sheet that opens on a long-press. Two rows: the seven reaction
 * emojis at the top, and a list of message actions below (Reply, Copy, Forward, Pin, Report / Edit /
 * Delete depending on who owns the message).
 *
 * ## Emoji as text nodes
 *
 * The seven emojis are `Text` runs, not icons — an emoji glyph is a character, and pushing it
 * through the `Icon` registry would mean turning coloured glyphs into monochrome vector paths. The
 * design intent is precisely the coloured emoji.
 */
import { forwardRef, useCallback, useMemo } from 'react';

import { Bubble, Divider, Icon, Sheet, Stack, Text, createStyles } from '@/core/design-system';

import type { IconName, SheetRef } from '@/core/design-system';
import type { ThreadMessageDTO } from '../api/repository';

/** The seven reactions the spec calls out, in the reference's order. */
export const REACTION_EMOJIS: readonly string[] = ['❤️', '👍', '🔥', '😂', '👏', '😮', '😢'];

interface MessageActionSheetProps {
  readonly message: ThreadMessageDTO | null;
  readonly isMine: boolean;
  readonly onClose: () => void;
  readonly onReact: (messageId: string, emoji: string) => void;
  readonly onReply: (message: ThreadMessageDTO) => void;
  readonly onCopy: (message: ThreadMessageDTO) => void;
  readonly onEdit?: (message: ThreadMessageDTO) => void;
  readonly onDelete?: (message: ThreadMessageDTO) => void;
  readonly onReport?: (message: ThreadMessageDTO) => void;
}

interface ActionRow {
  readonly key: string;
  readonly icon: IconName;
  readonly label: string;
  readonly destructive?: boolean;
  readonly onPress: () => void;
}

const useStyles = createStyles((t) => ({
  reactionsRow: {
    paddingVertical: t.spacing.sm,
    paddingHorizontal: t.spacing.xs,
    marginBottom: t.spacing.sm,
  },
  reactionButton: {
    width: t.size.touchTarget,
    height: t.size.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: t.typography.title2.fontSize,
    lineHeight: t.typography.title2.lineHeight,
  },
  actionRow: {
    paddingVertical: t.spacing.sm,
    paddingHorizontal: t.spacing.md,
  },
  divider: {
    height: t.border.hairline,
    backgroundColor: t.colors.border.faint,
  },
}));

export const MessageActionSheet = forwardRef<SheetRef, MessageActionSheetProps>(
  function MessageActionSheet(
    { message, isMine, onClose, onReact, onReply, onCopy, onEdit, onDelete, onReport },
    ref
  ) {
    const styles = useStyles();

    const handleReact = useCallback(
      (emoji: string) => {
        if (message === null) return;
        onReact(message.id, emoji);
        onClose();
      },
      [message, onReact, onClose]
    );

    const actions = useMemo<readonly ActionRow[]>(() => {
      if (message === null) return [];
      const base: ActionRow[] = [
        {
          key: 'reply',
          icon: 'reply',
          label: 'Reply',
          onPress: () => {
            onReply(message);
            onClose();
          },
        },
        {
          key: 'copy',
          icon: 'copy',
          label: 'Copy',
          onPress: () => {
            onCopy(message);
            onClose();
          },
        },
        {
          key: 'forward',
          icon: 'forward',
          label: 'Forward',
          onPress: () => {
            // Forward flow lands in a follow-up route. The button stays so the surface reads
            // complete; the callback is a no-op today.
            onClose();
          },
        },
        {
          key: 'pin',
          icon: 'pinned',
          label: 'Pin',
          onPress: () => {
            onClose();
          },
        },
      ];

      if (isMine) {
        if (onEdit !== undefined) {
          base.push({
            key: 'edit',
            icon: 'compose',
            label: 'Edit',
            onPress: () => {
              onEdit(message);
              onClose();
            },
          });
        }
        if (onDelete !== undefined) {
          base.push({
            key: 'delete',
            icon: 'close',
            label: 'Delete',
            destructive: true,
            onPress: () => {
              onDelete(message);
              onClose();
            },
          });
        }
      } else if (onReport !== undefined) {
        base.push({
          key: 'report',
          icon: 'flag',
          label: 'Report',
          destructive: true,
          onPress: () => {
            onReport(message);
            onClose();
          },
        });
      }

      return base;
    }, [message, isMine, onReply, onCopy, onEdit, onDelete, onReport, onClose]);

    return (
      <Sheet ref={ref} snapPoints={['50%']} onClose={onClose}>
        <Sheet.ScrollView>
          <Stack
            direction="row"
            justify="between"
            align="center"
            gap="xxs"
            style={styles.reactionsRow}
          >
            {REACTION_EMOJIS.map((emoji) => (
              <Bubble
                key={emoji}
                background="secondary"
                radius="full"
                onPress={() => {
                  handleReact(emoji);
                }}
                accessibilityLabel={`React ${emoji}`}
                style={styles.reactionButton}
              >
                <Text variant="title2" tone="primary" style={styles.emoji}>
                  {emoji}
                </Text>
              </Bubble>
            ))}
          </Stack>

          {actions.map((action, index) => (
            <Stack key={action.key} direction="column">
              {index > 0 ? <Divider tone="faint" /> : null}
              <Bubble
                background="primary"
                radius="sm"
                onPress={action.onPress}
                accessibilityLabel={action.label}
                style={styles.actionRow}
              >
                <Stack direction="row" gap="md" align="center">
                  <Icon
                    name={action.icon}
                    size="md"
                    tone={action.destructive === true ? 'error' : 'heading'}
                  />
                  <Text variant="body" tone={action.destructive === true ? 'error' : 'heading'}>
                    {action.label}
                  </Text>
                </Stack>
              </Bubble>
            </Stack>
          ))}
        </Sheet.ScrollView>
      </Sheet>
    );
  }
);
