/**
 * `EncryptionNotice` — the accent-tinted card at the top of a first-open thread reading "Messages
 * and calls are end-to-end encrypted...". A signal of privacy that also breaks the surface between
 * the header and the first message.
 *
 * ## Why a `Bubble` and not a `Card`
 *
 * A card is the signature surface — white, bordered, radius 16, xs shadow. This is a *notice*: it
 * has to read as an aside, not as a piece of content. Bubble gives it a coloured fill without a
 * border or a shadow, which is what a WhatsApp-style privacy pill looks like.
 */
import { Bubble, Icon, Stack, Text, createStyles } from '@/core/design-system';

const useStyles = createStyles((t) => ({
  wrapper: {
    paddingVertical: t.spacing.sm,
    paddingHorizontal: t.spacing.lg,
  },
}));

export function EncryptionNotice() {
  const styles = useStyles();
  return (
    <Stack direction="row" justify="center" align="center" style={styles.wrapper}>
      <Bubble background="accentSubtle" radius="lg" padding="sm">
        <Stack direction="row" align="center" gap="xs">
          <Icon name="password" size="sm" tone="accent" />
          <Text variant="caption" tone="secondary" align="center">
            Messages and calls are end-to-end encrypted. Only the two of you can read them.
          </Text>
        </Stack>
      </Bubble>
    </Stack>
  );
}
