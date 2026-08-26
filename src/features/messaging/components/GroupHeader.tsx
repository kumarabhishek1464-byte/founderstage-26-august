/**
 * `GroupHeader` — the top chrome of a group conversation.
 *
 * ## Differs from `ThreadHeader` in three places
 *
 * A group header carries a *member count and online count* under the title, uses the group's photo
 * (or the dark circular fallback the reference calls for) instead of a personal avatar, and drops
 * the video-call action — a video call is a 1-to-1 affordance in this app's language. Everything
 * else — back, identity, search, phone, more — matches the direct-thread header so tapping between
 * a direct and a group thread does not shift the eye.
 */
import { useCallback } from 'react';

import { Avatar, IconButton, Stack, Text, createStyles } from '@/core/design-system';

interface GroupHeaderProps {
  readonly title: string;
  readonly avatarUrl: string | null;
  readonly memberCount: number;
  readonly onlineCount: number;
  readonly onBack: () => void;
  readonly onPressIdentity?: () => void;
  readonly onPressSearch?: () => void;
  readonly onPressCall?: () => void;
  readonly onPressMore?: () => void;
}

const useStyles = createStyles((t) => ({
  bar: {
    paddingHorizontal: t.spacing.sm,
    paddingVertical: t.spacing.xs,
    borderBottomWidth: t.border.hairline,
    borderBottomColor: t.colors.border.faint,
    backgroundColor: t.colors.surface.primary,
  },
  identity: { flex: 1, minWidth: 0 },
}));

export function GroupHeader({
  title,
  avatarUrl,
  memberCount,
  onlineCount,
  onBack,
  onPressSearch,
  onPressCall,
  onPressMore,
}: GroupHeaderProps) {
  const styles = useStyles();

  // Header actions the group thread eventually wires. Rendered so the surface reads complete; the
  // callbacks fall back to no-ops so a screen-reader user still hears the button announced.
  const noop = useCallback(() => {}, []);

  const subtitle = formatSubtitle(memberCount, onlineCount);

  return (
    <Stack direction="row" align="center" gap="xs" style={styles.bar}>
      <IconButton name="back" tone="heading" accessibilityLabel="Back" onPress={onBack} />

      <Stack direction="row" gap="sm" align="center" style={styles.identity}>
        <Avatar size="md" name={title} source={avatarUrl ?? undefined} />
        <Stack direction="column" gap="xxs">
          <Text variant="headline" tone="heading" numberOfLines={1}>
            {title}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {subtitle}
          </Text>
        </Stack>
      </Stack>

      <IconButton
        name="search"
        tone="heading"
        accessibilityLabel="Search in conversation"
        onPress={onPressSearch ?? noop}
      />
      <IconButton
        name="phone"
        tone="heading"
        accessibilityLabel="Group voice call"
        onPress={onPressCall ?? noop}
      />
      <IconButton
        name="moreVertical"
        tone="heading"
        accessibilityLabel="Group options"
        onPress={onPressMore ?? noop}
      />
    </Stack>
  );
}

function formatSubtitle(members: number, online: number): string {
  const memberLabel = `${members.toString()} ${members === 1 ? 'member' : 'members'}`;
  if (online <= 0) return memberLabel;
  return `${memberLabel}, ${online.toString()} online`;
}
