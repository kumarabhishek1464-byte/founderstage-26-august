/**
 * `QuickActionCard` — one of the two square cards on the inbox that offer entering group-shaped
 * flows: "Create group" and "Discover groups". Rendered in a row of two above the conversation
 * list — visually a bridge between the filter chips and the pinned section.
 *
 * ## Why a bespoke component and not just a `Card`
 *
 * The reference language for these cards is not a list row — it is a *tile*. An icon square sits
 * top-left, a title sits below, and the whole card is a link. `Card` alone models the surface, but
 * the tile is a repeating composition that the chat surface uses twice today and the discovery
 * surface will use again. Keeping it in one component means the two tiles stay identical and a
 * later third tile inherits the same rhythm.
 *
 * The icon square is `spacing.xl4` (48) with a `radius.md` corner and a soft accent tint. Sized
 * with tokens; the tint uses `surface.accentSubtle`, the one sanctioned red-tinged background — see
 * `colors.ts` for why that is the correct fill for a *quiet* accent action.
 */
import { Card, Icon, Stack, Text, createStyles } from '@/core/design-system';

import type { IconName } from '@/core/design-system';

interface QuickActionCardProps {
  readonly icon: IconName;
  readonly title: string;
  readonly subtitle: string;
  readonly onPress: () => void;
}

const useStyles = createStyles((t) => ({
  /** The tile is a square-ish card that grows to fill its row cell. */
  card: { flex: 1 },
  /**
   * The 48pt icon plate. `radius.md` rather than `full` so it reads as a container for the glyph
   * (a tile within a tile), not as an avatar. `surface.accentSubtle` is the design language's
   * quiet-accent fill; the icon on top uses `tone="accent"` so the mark is red on a red-tinted
   * plate — one signal, two hues.
   */
  iconPlate: {
    width: t.spacing.xl4,
    height: t.spacing.xl4,
    borderRadius: t.radius.md,
    backgroundColor: t.colors.surface.accentSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

export function QuickActionCard({ icon, title, subtitle, onPress }: QuickActionCardProps) {
  const styles = useStyles();

  return (
    <Card
      padding="md"
      onPress={onPress}
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      style={styles.card}
    >
      <Stack direction="column" gap="sm">
        <Stack direction="row" style={styles.iconPlate}>
          <Icon name={icon} size="md" tone="accent" />
        </Stack>
        <Stack direction="column" gap="xxs">
          <Text variant="bodyStrong" tone="heading" numberOfLines={1}>
            {title}
          </Text>
          <Text variant="footnote" tone="secondary" numberOfLines={2}>
            {subtitle}
          </Text>
        </Stack>
      </Stack>
    </Card>
  );
}
