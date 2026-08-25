/**
 * `DiscoverySection` — the "Intelligent Discoveries" carousel.
 *
 * The section header is violet and the cards' CTAs are soft red, which is the whole colour argument on
 * this screen in miniature: violet says *the system chose this for you*, red says *press this*. If the
 * CTAs were filled `primary`, four of them in a row would out-shout every real action on the screen;
 * if the header were red, the suggestion would look like an advert.
 *
 * ## Two card shapes
 *
 * A `group` leads with a mark and a membership count — it is one place. `people` leads with faces and a
 * "+N" — it is a set of humans. Driving both from one template is what produces a group card with an
 * empty avatar row, so `kind` is data and the branch is explicit.
 *
 * The cards are a fixed width so the next one peeks past the right edge, which is what tells you the
 * row scrolls. `HorizontalScroll` gets the gutter through `contentStyle`, so the first card lines up
 * with the section header above it and the last one can still scroll clear of the edge.
 */
import { Avatar, Button, Card, HorizontalScroll, Icon, Stack, Text } from '@/core/design-system';
import { createStyles } from '@/core/design-system/theme';

import { DISCOVERY_CARDS } from '../model/feed-data';

import type { DiscoveryCard } from '../model/feed-data';

/** Fixed, so the fourth card is partly visible and the row reads as scrollable. */
const CARD_WIDTH = 128;

const useStyles = createStyles((t) => ({
  section: { gap: t.spacing.sm },
  header: { paddingHorizontal: t.spacing.md },
  content: {
    paddingHorizontal: t.spacing.md,
    gap: t.spacing.sm,
  },
  card: { width: CARD_WIDTH },
  /** The group's mark: a dark disc, sized to `avatarLg` so it sits on the avatar scale. */
  groupMark: {
    width: t.size.avatarLg,
    height: t.size.avatarLg,
    borderRadius: t.radius.full,
    backgroundColor: t.colors.surface.inverse,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackedFace: { marginLeft: -8 },
  /** The "+N" chip closing the face row. Same diameter as the faces, so the row stays one band. */
  extra: {
    width: t.size.avatarSm,
    height: t.size.avatarSm,
    borderRadius: t.radius.full,
    backgroundColor: t.colors.surface.tertiary,
    borderWidth: t.border.hairline,
    borderColor: t.colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
  },
  /** Pushes the CTA to the bottom edge so all four buttons align across cards of unequal text. */
  spacer: { flex: 1 },
}));

function DiscoveryFaces({ card }: { readonly card: DiscoveryCard }) {
  const styles = useStyles();

  return (
    <Stack direction="row" align="center">
      {card.faces.map((name, index) => (
        <Avatar
          key={name}
          size="sm"
          name={name}
          style={index > 0 ? styles.stackedFace : undefined}
        />
      ))}
      {card.extraCount > 0 ? (
        <Stack style={styles.extra}>
          <Text variant="overline" tone="secondary">
            {`+${String(card.extraCount)}`}
          </Text>
        </Stack>
      ) : null}
    </Stack>
  );
}

export function DiscoverySection() {
  const styles = useStyles();

  return (
    <Stack style={styles.section}>
      <Stack direction="row" align="center" justify="between" style={styles.header}>
        <Stack direction="row" align="center" gap="xs">
          <Icon name="sparkles" size="md" tone="violet" />
          <Text variant="bodyStrong" tone="heading">
            Intelligent Discoveries
          </Text>
        </Stack>
        <Text variant="subhead" tone="accent">
          See all
        </Text>
      </Stack>

      <HorizontalScroll contentStyle={styles.content}>
        {DISCOVERY_CARDS.map((card) => (
          <Card key={card.id} padding="md" style={styles.card}>
            <Stack gap="xs" fill>
              {card.kind === 'group' ? (
                <Stack style={styles.groupMark}>
                  <Icon name="sparkles" size="md" tone="inverse" />
                </Stack>
              ) : null}

              <Text variant="footnote" tone="heading" numberOfLines={2}>
                {card.title}
              </Text>

              {card.kind === 'people' ? <DiscoveryFaces card={card} /> : null}

              <Text variant="overline" tone="tertiary" numberOfLines={2}>
                {card.subtitle}
              </Text>

              <Stack style={styles.spacer}>{null}</Stack>

              <Button
                label={card.actionLabel}
                variant="accentSoft"
                size="sm"
                shape="rounded"
                fullWidth
                accessibilityHint={card.title}
                onPress={() => {
                  // No destination yet — the discovery routes do not exist. Wired when they do.
                }}
              />
            </Stack>
          </Card>
        ))}
      </HorizontalScroll>
    </Stack>
  );
}
