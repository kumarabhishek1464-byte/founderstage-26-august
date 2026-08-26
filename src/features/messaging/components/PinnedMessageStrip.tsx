/**
 * `PinnedMessageStrip` — the row that sits just below the header of a group thread. Renders when
 * the conversation has a pinned message and points at its author + body preview.
 *
 * The strip is a hairline-bordered row with the pin glyph on the left, two lines of text (the
 * "Pinned by X" caption in accent and the body preview on the second line), and a right-facing
 * chevron. The chevron communicates that the strip is a target — tapping it eventually scrolls the
 * timeline to the pinned seq.
 */
import { Icon, Stack, Text, createStyles } from '@/core/design-system';

import type { PinnedMessageDTO } from '../api/repository';

interface PinnedMessageStripProps {
  readonly pinned: PinnedMessageDTO;
  readonly onPress?: () => void;
}

const useStyles = createStyles((t) => ({
  row: {
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm,
    borderBottomWidth: t.border.hairline,
    borderBottomColor: t.colors.border.faint,
    backgroundColor: t.colors.surface.primary,
  },
  body: { flex: 1, minWidth: 0 },
}));

export function PinnedMessageStrip({ pinned }: PinnedMessageStripProps) {
  const styles = useStyles();

  return (
    <Stack direction="row" align="center" gap="sm" style={styles.row}>
      <Icon name="pinned" tone="accent" size="sm" accessibilityLabel="Pinned" />
      <Stack direction="column" gap="xxs" style={styles.body}>
        <Text variant="caption" tone="accent" numberOfLines={1}>
          {`Pinned by ${pinned.author_name}`}
        </Text>
        <Text variant="footnote" tone="heading" numberOfLines={1}>
          {pinned.body}
        </Text>
      </Stack>
      <Icon name="chevronRight" tone="secondary" size="sm" />
    </Stack>
  );
}
