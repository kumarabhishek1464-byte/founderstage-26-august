/**
 * `PostMediaBlock` — the thumbnail on the right of a post.
 *
 * Two treatments, and they are not interchangeable:
 *
 * - **`insight`** — a dark panel the app generated: a breakdown, a chart. It gets `surface.spotlight`
 *   and a violet headline, which is the same violet the composer's sparkle and the discovery header
 *   use. That consistency is the point: violet means *the system produced this*.
 * - **`preview`** — somebody else's page. Light chrome, a title bar with a domain, body lines and the
 *   page's own buttons, so it reads as a quotation of a thing that exists elsewhere rather than as
 *   content authored here.
 *
 * The chart on an `insight` is drawn from three tapering bars rather than shipped as an asset: it is a
 * texture standing in for a chart at 100×90, where a real plot would be illegible anyway, and an image
 * would be a network request and a cache entry for decoration.
 */
import { Icon, Stack, Text } from '@/core/design-system';
import { createStyles } from '@/core/design-system/theme';

import type { PostMedia } from '../model/feed-data';

interface PostMediaBlockProps {
  readonly media: PostMedia;
}

/** Fixed, because the text column beside it needs a predictable measure to wrap against. */
const MEDIA_WIDTH = 116;

const useStyles = createStyles((t) => ({
  insight: {
    width: MEDIA_WIDTH,
    backgroundColor: t.colors.surface.spotlight,
    borderRadius: t.radius.md,
    padding: t.spacing.sm,
    overflow: 'hidden',
  },
  /** The stand-in chart: bars rising left to right along the bottom of the panel. */
  chartRow: {
    marginTop: t.spacing.xs,
    height: t.size.iconLg,
    alignItems: 'flex-end',
  },
  bar: {
    flex: 1,
    backgroundColor: t.colors.text.violet,
    borderRadius: t.radius.xs,
    opacity: 0.55,
  },
  barShort: { height: '35%' },
  barMid: { height: '62%' },
  barTall: { height: '100%', opacity: 0.9 },

  preview: {
    width: MEDIA_WIDTH,
    backgroundColor: t.colors.surface.primary,
    borderWidth: t.border.hairline,
    borderColor: t.colors.border.subtle,
    borderRadius: t.radius.md,
    overflow: 'hidden',
  },
  /** The browser-chrome band: a domain on the left, a menu glyph on the right. */
  previewBar: {
    backgroundColor: t.colors.surface.secondary,
    borderBottomWidth: t.border.hairline,
    borderBottomColor: t.colors.border.subtle,
    paddingHorizontal: t.spacing.xs,
    paddingVertical: t.spacing.xxs,
  },
  previewBody: { padding: t.spacing.xs },
  previewActions: { marginTop: t.spacing.xxs },
  actionPrimary: {
    backgroundColor: t.colors.action.primary,
    borderRadius: t.radius.xs,
    paddingHorizontal: t.spacing.xxs,
  },
  actionSecondary: {
    borderWidth: t.border.hairline,
    borderColor: t.colors.border.strong,
    borderRadius: t.radius.xs,
    paddingHorizontal: t.spacing.xxs,
  },
}));

export function PostMediaBlock({ media }: PostMediaBlockProps) {
  const styles = useStyles();

  if (media.kind === 'insight') {
    return (
      <Stack style={styles.insight}>
        {media.eyebrow !== undefined ? (
          <Text variant="caption" tone="tertiary" numberOfLines={1}>
            {media.eyebrow}
          </Text>
        ) : null}
        <Text variant="footnote" tone="violet" numberOfLines={2}>
          {media.accentLine ?? media.headline}
        </Text>

        <Stack direction="row" gap="xxs" style={styles.chartRow}>
          <Stack style={[styles.bar, styles.barShort]}>{null}</Stack>
          <Stack style={[styles.bar, styles.barMid]}>{null}</Stack>
          <Stack style={[styles.bar, styles.barTall]}>{null}</Stack>
        </Stack>
      </Stack>
    );
  }

  return (
    <Stack style={styles.preview}>
      <Stack direction="row" align="center" justify="between" style={styles.previewBar}>
        <Text variant="overline" tone="secondary" numberOfLines={1}>
          {media.eyebrow ?? ''}
        </Text>
        <Icon name="moreHorizontal" size="sm" tone="tertiary" />
      </Stack>

      <Stack gap="xxs" style={styles.previewBody}>
        <Text variant="footnote" tone="heading">
          {media.headline}
        </Text>

        {media.lines?.map((line) => (
          <Text key={line} variant="overline" tone="tertiary" numberOfLines={1}>
            {line}
          </Text>
        ))}

        {media.actions !== undefined ? (
          <Stack direction="row" gap="xxs" align="center" style={styles.previewActions}>
            {media.actions.map((action, index) => (
              <Stack
                key={action}
                style={index === 0 ? styles.actionPrimary : styles.actionSecondary}
              >
                <Text variant="overline" tone={index === 0 ? 'inverse' : 'secondary'}>
                  {action}
                </Text>
              </Stack>
            ))}
          </Stack>
        ) : null}
      </Stack>
    </Stack>
  );
}
