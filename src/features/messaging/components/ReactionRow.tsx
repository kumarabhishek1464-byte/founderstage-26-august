/**
 * `ReactionRow` — the little pills under a bubble that show which emoji reactions landed on the
 * message, with counts and a "mine" state.
 *
 * ## Why the tap toggles here rather than routing through a menu
 *
 * The reactions the message already has are the ones most likely to be tapped again — either to add
 * a "me too" or to withdraw an earlier reaction. Requiring a long-press-and-menu for a re-tap would
 * mean every reaction interaction after the first is two steps. The long-press menu is still the
 * right surface for *choosing* a reaction that is not yet on the message; that lives on the bubble
 * itself.
 */
import { Bubble, Stack, Text, createStyles } from '@/core/design-system';

import type { ReactionDTO } from '../api/repository';

interface ReactionRowProps {
  readonly reactions: readonly ReactionDTO[];
  readonly onToggle: (emoji: string) => void;
  readonly alignEnd: boolean;
}

const useStyles = createStyles((t) => ({
  pill: {
    paddingHorizontal: t.spacing.xs,
    paddingVertical: t.spacing.xxs,
  },
  emoji: {
    fontSize: t.typography.footnote.fontSize,
    lineHeight: t.typography.footnote.lineHeight,
  },
  row: {
    marginTop: -t.spacing.xs,
  },
}));

export function ReactionRow({ reactions, onToggle, alignEnd }: ReactionRowProps) {
  const styles = useStyles();
  if (reactions.length === 0) return null;

  return (
    <Stack direction="row" gap="xxs" wrap justify={alignEnd ? 'end' : 'start'} style={styles.row}>
      {reactions.map((r) => (
        <Bubble
          key={r.emoji}
          background={r.mine ? 'accentSubtle' : 'primary'}
          radius="full"
          onPress={() => {
            onToggle(r.emoji);
          }}
          accessibilityLabel={`${r.emoji} reaction, ${String(r.count)}${r.mine ? ', yours' : ''}`}
          style={styles.pill}
        >
          <Stack direction="row" gap="xxs" align="center">
            <Text variant="footnote" tone="primary" style={styles.emoji}>
              {r.emoji}
            </Text>
            {r.count > 1 ? (
              <Text variant="caption" tone={r.mine ? 'accent' : 'secondary'}>
                {r.count.toString()}
              </Text>
            ) : null}
          </Stack>
        </Bubble>
      ))}
    </Stack>
  );
}
