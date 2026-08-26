/**
 * `AttachmentCard` — a file attachment as it appears inside a message bubble. The reference shows a
 * PDF plate (red-tinted icon square + filename + "2.4 MB • PDF"), which is what this renders.
 *
 * ## Why the icon plate is a `Bubble`, not a `Card`
 *
 * The plate is a coloured square behind a glyph — no border, no shadow. `Bubble` is the primitive
 * for exactly that surface; `Card` would introduce a hairline and a shadow the plate does not want.
 *
 * The outer container is *not* a card either, because it sits inside a message bubble that already
 * has a background: a nested rounded fill would produce two layered surfaces. A plain `Stack` row
 * suffices.
 */
import { Bubble, Icon, Stack, Text, createStyles } from '@/core/design-system';

import type { AttachmentDTO } from '../api/repository';

interface AttachmentCardProps {
  readonly attachment: AttachmentDTO;
  readonly onPress?: () => void;
}

const useStyles = createStyles((t) => ({
  row: {
    paddingVertical: t.spacing.xxs,
  },
  meta: { minWidth: 0, flex: 1 },
}));

export function AttachmentCard({ attachment, onPress }: AttachmentCardProps) {
  const styles = useStyles();

  const kindLabel = mimeToLabel(attachment.mime);
  const sizeLabel = formatBytes(attachment.size);

  return (
    <Bubble
      background="primary"
      radius="md"
      padding="sm"
      onPress={onPress}
      accessibilityLabel={`Attachment: ${attachment.name}, ${sizeLabel}, ${kindLabel}`}
    >
      <Stack direction="row" gap="md" align="center" style={styles.row}>
        <Bubble background="accentSubtle" radius="md" padding="sm">
          <Icon name="document" size="lg" tone="accent" />
        </Bubble>
        <Stack direction="column" gap="xxs" style={styles.meta}>
          <Text variant="bodyStrong" tone="heading" numberOfLines={1}>
            {attachment.name}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {`${sizeLabel} • ${kindLabel}`}
          </Text>
        </Stack>
      </Stack>
    </Bubble>
  );
}

/**
 * Human bytes rounded to one decimal past kilobytes, and to an integer at bytes. `1024 * 1024` for
 * MB because file managers report the same way — a "2.4 MB PDF" in a chat bubble matches what the
 * OS will show once it lands.
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes.toString()} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

function mimeToLabel(mime: string): string {
  if (mime === 'application/pdf') return 'PDF';
  if (mime.startsWith('image/')) return mime.split('/')[1]?.toUpperCase() ?? 'Image';
  if (mime.startsWith('video/')) return mime.split('/')[1]?.toUpperCase() ?? 'Video';
  if (mime.includes('word')) return 'DOCX';
  if (mime.includes('sheet') || mime.includes('excel')) return 'XLSX';
  if (mime.includes('presentation') || mime.includes('powerpoint')) return 'PPTX';
  if (mime.startsWith('text/')) return 'TXT';
  return 'File';
}
