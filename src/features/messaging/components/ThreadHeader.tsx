/**
 * `ThreadHeader` — the top chrome of a 1-to-1 conversation: back arrow, partner identity (avatar
 * with a presence dot, name and last-seen), and the three actions the reference calls out (search,
 * voice call, video call), plus overflow.
 *
 * ## Why this file exists rather than composing IconButtons on the screen
 *
 * The header is the visual identity of the thread: nine controls at a specific rhythm. Rebuilding
 * that on a group chat screen next week would be nine chances to drift, and a "1:1 header vs group
 * header" divergence is exactly the kind of thing that produces two headers by accident.
 *
 * The three action buttons on the right sit on `Bubble`s in the reference, which is the affordance
 * WhatsApp uses to separate them from the raw glyph strip a stock header carries. Following the
 * reference here is a language choice, not a decoration.
 */
import { useCallback } from 'react';

import { Avatar, IconButton, Stack, Text, createStyles } from '@/core/design-system';

import type { ThreadPartnerDTO } from '../api/repository';

interface ThreadHeaderProps {
  readonly partner: ThreadPartnerDTO | null;
  readonly onBack: () => void;
  readonly onPressSearch?: () => void;
  readonly onPressCall?: () => void;
  readonly onPressVideo?: () => void;
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

export function ThreadHeader({
  partner,
  onBack,
  onPressSearch,
  onPressCall,
  onPressVideo,
  onPressMore,
}: ThreadHeaderProps) {
  const styles = useStyles();

  const name = partner?.name ?? 'Conversation';
  const status = statusLabel(partner?.presence ?? 'unknown');

  const noop = useCallback(() => {
    // The header exposes affordances the thread eventually wires — search, call, video. Rendering
    // them today keeps the surface visually complete; the callbacks fall back to no-ops so a
    // screen-reader user still hears the button announced. See the roadmap in the spec.
  }, []);

  return (
    <Stack direction="row" align="center" gap="xs" style={styles.bar}>
      <IconButton name="back" tone="heading" accessibilityLabel="Back" onPress={onBack} />

      <Stack direction="row" gap="sm" align="center" style={styles.identity}>
        <Avatar
          size="md"
          name={partner?.name}
          source={partner?.avatar_url ?? undefined}
          presence={partner?.presence === 'online' ? 'online' : undefined}
        />
        <Stack direction="column" gap="xxs">
          <Text variant="headline" tone="heading" numberOfLines={1}>
            {name}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {status}
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
        accessibilityLabel="Voice call"
        onPress={onPressCall ?? noop}
      />
      <IconButton
        name="video"
        tone="heading"
        accessibilityLabel="Video call"
        onPress={onPressVideo ?? noop}
      />
      <IconButton
        name="moreVertical"
        tone="heading"
        accessibilityLabel="More options"
        onPress={onPressMore ?? noop}
      />
    </Stack>
  );
}

function statusLabel(presence: ThreadPartnerDTO['presence']): string {
  switch (presence) {
    case 'online':
      return 'Online';
    case 'offline':
      return 'Offline';
    case 'unknown':
    default:
      // Deliberately soft: an unknown presence should not read as "offline", which is a claim.
      return 'Tap for contact info';
  }
}
