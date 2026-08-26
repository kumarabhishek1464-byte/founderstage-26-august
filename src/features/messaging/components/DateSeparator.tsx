/**
 * `DateSeparator` — the "Today" / "Yesterday" / "Mon, 12 Aug" divider between message groups.
 *
 * Centred small caps, faint on purpose: a scrolling reader should feel the day break rather than
 * read it.
 */
import { Stack, Text, createStyles } from '@/core/design-system';

interface DateSeparatorProps {
  readonly label: string;
}

const useStyles = createStyles((t) => ({
  wrapper: {
    paddingVertical: t.spacing.md,
  },
}));

export function DateSeparator({ label }: DateSeparatorProps) {
  const styles = useStyles();
  return (
    <Stack direction="row" justify="center" align="center" style={styles.wrapper}>
      <Text variant="caption" tone="tertiary">
        {label}
      </Text>
    </Stack>
  );
}
