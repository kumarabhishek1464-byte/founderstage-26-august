/**
 * `CreatePostBar` — the composer prompt at the top of the feed.
 */
import { Card, Divider, Icon, Stack, Text } from '@/core/design-system';
import { createStyles } from '@/core/design-system/theme';

import type { IconName } from '@/core/design-system';

interface ComposerAction {
  readonly icon: IconName;
  readonly label: string;
}

const ACTIONS: readonly ComposerAction[] = [
  { icon: 'add', label: 'Post' },
  { icon: 'info', label: 'Question' },
  { icon: 'sparkles', label: 'Poll' },
];

const useStyles = createStyles((t) => ({
  shell: {
    paddingVertical: t.spacing.sm,
    paddingHorizontal: t.spacing.md,
  },
  prompt: {
    flexShrink: 1,
  },
  divider: {
    height: t.size.iconLg,
    marginHorizontal: t.spacing.sm,
  },
  action: { minWidth: t.size.avatarMd },
}));

export function CreatePostBar() {
  const styles = useStyles();

  return (
    <Card padding="none">
      <Stack direction="row" align="center" style={styles.shell}>
        <Stack fill direction="row" align="center" gap="xs" style={styles.prompt}>
          <Icon name="sparkles" size="md" tone="violet" />
          <Text variant="subhead" tone="tertiary" numberOfLines={1}>
            {"What's happening in your founder journey?"}
          </Text>
        </Stack>

        <Divider orientation="vertical" style={styles.divider} />

        <Stack direction="row" align="center" gap="sm">
          {ACTIONS.map((action) => (
            <Stack key={action.label} gap="xxs" align="center" style={styles.action}>
              <Icon name={action.icon} size="md" tone="heading" />
              <Text variant="caption" tone="secondary">
                {action.label}
              </Text>
            </Stack>
          ))}
        </Stack>
      </Stack>
    </Card>
  );
}
