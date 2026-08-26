/**
 * `SystemMessage` — the centered pill used for non-participant events in a group thread: a member
 * joined, someone pinned a message, someone changed the title. Rendered flat in the timeline
 * between real messages, distinguished by its centered alignment and its soft-grey Bubble.
 *
 * The prefix icon is optional and picks its glyph from the event kind. When null the pill is text
 * only, which is the right register for events that do not fit a single glyph.
 */
import { Bubble, Icon, Stack, Text, createStyles } from '@/core/design-system';

import type { IconName } from '@/core/design-system';

interface SystemMessageProps {
  readonly body: string;
  readonly icon?: IconName | null;
}

const useStyles = createStyles((t) => ({
  wrap: {
    paddingVertical: t.spacing.sm,
  },
  pill: {
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.xs,
    maxWidth: '86%',
  },
}));

export function SystemMessage({ body, icon = null }: SystemMessageProps) {
  const styles = useStyles();

  return (
    <Stack direction="row" justify="center" align="center" style={styles.wrap}>
      <Bubble background="secondary" radius="full" style={styles.pill}>
        <Stack direction="row" gap="xs" align="center">
          {icon !== null ? <Icon name={icon} tone="secondary" size="sm" /> : null}
          <Text variant="caption" tone="secondary" align="center">
            {body}
          </Text>
        </Stack>
      </Bubble>
    </Stack>
  );
}
