/**
 * `PostCard` — one post in the feed.
 *
 * ```
 * ┌────────────────────────────────────────────────────┐
 * │ ◉  Ananya Verma  CEO at BuildIt  Founder        ⋮  │  ← identity
 * │    2h ago · ⊕ Public                               │
 * │                                                    │
 * │ Just closed our pre-seed round! 🎉        ┌──────┐  │  ← body, media
 * │ What were the biggest challenges…        │ media │  │
 * │ #funding #startups #raisingcapital       └──────┘  │
 * │                                                    │
 * │ 👍 126   💬 48   ↗ 12               Save  🔖       │  ← engagement
 * │────────────────────────────────────────────────────│
 * │ ◉◉◉ Rahul, Karan and 124 others liked this      ›  │  ← social proof
 * └────────────────────────────────────────────────────┘
 * ```
 *
 * ## The media is a column, not a block after the text
 *
 * Header, body and tags share a `fill` column and the thumbnail is its sibling, so the text wraps
 * against the thumbnail's edge for the *whole* card rather than only alongside the paragraph. Stacking
 * the thumbnail under the body instead would leave the author line running the full width while the
 * body ran short — two different measures in one card, which reads as a layout bug.
 *
 * ## Why the identity line is three `Text` runs and not one
 *
 * Name, headline and role each carry a different weight, tone and meaning, and the role is the one the
 * eye is looking for. The row wraps, so a long "Co-founder at TechNova" pushes the badge to a second
 * line rather than truncating it — losing the badge is worse than spending a line on it.
 *
 * ## The counts are not pressable yet
 *
 * Deliberately: there is no mutation behind them, and a control that looks pressable and does nothing
 * is worse than one that does not. When the feed gets a repository, each becomes an `IconButton` with
 * its own accessible name and optimistic state.
 */
import { Avatar, Divider, Icon, Stack, Text } from '@/core/design-system';
import { createStyles } from '@/core/design-system/theme';

import { PostMediaBlock } from './PostMediaBlock';

import type { IconName } from '@/core/design-system';
import type { FeedPost } from '../model/feed-data';

interface PostCardProps {
  readonly post: FeedPost;
}

const useStyles = createStyles((t) => ({
  card: {
    backgroundColor: t.colors.surface.primary,
    borderWidth: t.border.hairline,
    borderColor: t.colors.border.subtle,
    borderRadius: t.radius.lg,
    overflow: 'hidden',
  },
  /** Everything above the social-proof strip, which needs to bleed to the card's edges. */
  main: {
    paddingHorizontal: t.spacing.md,
    paddingTop: t.spacing.md,
    paddingBottom: t.spacing.sm,
    gap: t.spacing.sm,
  },
  avatarWrap: { position: 'relative' },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: t.size.iconSm * 0.75,
    height: t.size.iconSm * 0.75,
    borderRadius: t.radius.full,
    backgroundColor: t.colors.status.success,
    borderWidth: t.border.focus,
    borderColor: t.colors.surface.primary,
  },
  identityRow: { flexWrap: 'wrap' },
  tagRow: { flexWrap: 'wrap' },
  /**
   * The engagement row sits tighter to the text than the `md` rhythm above it: the counts belong to
   * the post, and a full gap would float them between the post and whatever is below.
   */
  engagement: {
    paddingHorizontal: t.spacing.md,
    paddingBottom: t.spacing.sm,
  },
  /** Takes the slack between the faces and the chevron, so the sentence is what truncates. */
  socialLabel: { flex: 1 },
  /** A quiet band, so the strip reads as a footer of the card rather than as another paragraph. */
  socialStrip: {
    backgroundColor: t.colors.surface.secondary,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm,
  },
  stackedFace: { marginLeft: -10 },
}));

interface CountSpec {
  readonly icon: IconName;
  readonly value: number;
}

export function PostCard({ post }: PostCardProps) {
  const styles = useStyles();
  const { author, timeAgo, visibility, title, body, hashtags, media, stats, likedBy } = post;

  const counts: readonly CountSpec[] = [
    { icon: 'thumbsUp', value: stats.likes },
    { icon: 'chat', value: stats.comments },
    { icon: 'share', value: stats.shares },
  ];

  return (
    <Stack style={styles.card}>
      <Stack direction="row" gap="sm" align="start" style={styles.main}>
        {/* ── Text column ── */}
        <Stack fill gap="sm">
          {/* Identity */}
          <Stack direction="row" gap="sm" align="start">
            <Stack style={styles.avatarWrap}>
              <Avatar size="lg" name={author.name} />
              {author.online ? <Stack style={styles.onlineDot}>{null}</Stack> : null}
            </Stack>

            <Stack fill gap="xxs">
              <Stack direction="row" align="center" gap="xs" style={styles.identityRow}>
                <Text variant="bodyStrong" tone="heading">
                  {author.name}
                </Text>
                <Text variant="caption" tone="secondary">
                  {author.headline}
                </Text>
                <Text variant="caption" tone={author.role.tone}>
                  {author.role.label}
                </Text>
              </Stack>

              <Stack direction="row" align="center" gap="xxs">
                <Text variant="caption" tone="tertiary">
                  {timeAgo}
                </Text>
                <Text variant="caption" tone="tertiary">
                  ·
                </Text>
                <Icon name="website" size="sm" tone="tertiary" />
                <Text variant="caption" tone="tertiary">
                  {visibility}
                </Text>
              </Stack>
            </Stack>
          </Stack>

          {/* Title, when the post is an article rather than a remark */}
          {title !== undefined ? (
            <Text variant="bodyStrong" tone="heading">
              {title}
            </Text>
          ) : null}

          {/* Body */}
          {body.map((paragraph) => (
            <Text key={paragraph} variant="body" tone="body">
              {paragraph}
            </Text>
          ))}

          {/* Hashtags */}
          {hashtags.length > 0 ? (
            <Stack direction="row" gap="xs" style={styles.tagRow}>
              {hashtags.map((tag) => (
                <Text key={tag} variant="footnote" tone="link">
                  {tag}
                </Text>
              ))}
            </Stack>
          ) : null}
        </Stack>

        {/* ── Media column ── */}
        {media !== undefined ? <PostMediaBlock media={media} /> : null}

        {/* ── Overflow ── */}
        <Icon name="moreHorizontal" size="md" tone="tertiary" accessibilityLabel="Post options" />
      </Stack>

      {/* ── Engagement ── */}
      <Stack direction="row" align="center" justify="between" style={styles.engagement}>
        <Stack direction="row" align="center" gap="lg">
          {counts.map((count) => (
            <Stack key={count.icon} direction="row" align="center" gap="xxs">
              <Icon name={count.icon} size="sm" tone="secondary" />
              <Text variant="caption" tone="secondary">
                {String(count.value)}
              </Text>
            </Stack>
          ))}
        </Stack>

        <Stack direction="row" align="center" gap="xxs">
          <Text variant="caption" tone="secondary">
            Save
          </Text>
          <Icon name="bookmark" size="sm" tone="secondary" />
        </Stack>
      </Stack>

      {/* ── Social proof ── */}
      {likedBy !== undefined ? (
        <>
          <Divider tone="subtle" />
          <Stack direction="row" align="center" gap="xs" style={styles.socialStrip}>
            <Stack direction="row" align="center">
              {likedBy.faces.map((name, index) => (
                <Avatar
                  key={name}
                  size="sm"
                  name={name}
                  style={index > 0 ? styles.stackedFace : undefined}
                />
              ))}
            </Stack>

            <Text variant="caption" tone="secondary" numberOfLines={1} style={styles.socialLabel}>
              {`${likedBy.names.join(', ')} and ${String(likedBy.totalOthers)} others liked this`}
            </Text>

            <Icon name="chevronRight" size="sm" tone="tertiary" />
          </Stack>
        </>
      ) : null}
    </Stack>
  );
}
