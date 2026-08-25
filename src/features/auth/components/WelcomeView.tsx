/**
 * `WelcomeView` — the signed-out hero. The first screen, and the only one whose job is persuasion.
 *
 * ## The headline is one heading, in two voices
 *
 * The reference sets a quiet line above a heavy one, and the obvious way to build that here — `title1`
 * above `display` — is wrong twice. Both roles are heading rank 1 (`Text`'s `HEADING_LEVEL` says so
 * explicitly), so the screen would emit two `<h1>`s on web; and a quiet *heading* still announces itself
 * as a heading, so a screen reader user hears two headings where a sighted user sees one sentence.
 *
 * `overline` carries no heading rank at all. An 11pt uppercase eyebrow above a 32pt statement is the
 * same two-voice effect, it leaves exactly one `<h1>` in the document, and it is a stronger editorial
 * shape than two stacked headings — the eyebrow labels the claim instead of competing with it.
 *
 * ## Why "Log in" is here at all
 *
 * It is not on the reference screen, and without it this is a dead end for every member who already has
 * an account: the only way forward would be "Join the Network", which is the wrong door. One line of
 * secondary text costs nothing and removes the one navigational trap a welcome screen can have.
 *
 * ## Deliberately not: a full-bleed hero image
 *
 * `padded={false}` on the `Screen` is for the drifting lanes, which have to run edge to edge or the clip
 * looks like a bug. Everything else re-applies the screen margin itself, so the copy column keeps the
 * design language's 24pt gutter while the band behind it does not.
 */
import { Button, createStyles, Icon, Stack, Text, TextLink, Wordmark } from '@/core/design-system';

import { LegalNote } from './LegalNote';
import { WelcomeHero } from './WelcomeHero';

interface WelcomeViewProps {
  readonly onJoin: () => void;
  readonly onLogin: () => void;
}

const useStyles = createStyles((t) => ({
  /**
   * The screen margin, re-applied per block, because the `Screen` is unpadded so the marquee can bleed.
   * `spacing.xl` is the same 24 `Screen` would have used — read from the token rather than restated, so
   * a change to the screen margin still reaches this screen.
   */
  gutter: { paddingHorizontal: t.spacing.xl },
}));

export function WelcomeView({ onJoin, onLogin }: WelcomeViewProps) {
  const styles = useStyles();

  return (
    <Stack fill justify="between" gap="xl2">
      <Stack style={styles.gutter}>
        <Wordmark />
      </Stack>

      <WelcomeHero />

      <Stack gap="xl" style={styles.gutter}>
        <Stack gap="xs">
          <Text variant="overline" tone="tertiary">
            The operating system
          </Text>
          <Text variant="display" tone="heading">
            For a curated network of founders, investors, coaches and innovators.
          </Text>
        </Stack>

        <Stack gap="md">
          <Button
            label="Join the Network"
            size="lg"
            fullWidth
            onPress={onJoin}
            iconRight={<Icon name="forward" size="md" tone="inverse" />}
          />
          <Stack direction="row" justify="center" align="baseline" gap="xxs">
            <Text variant="footnote" tone="secondary">
              Already a member?
            </Text>
            <TextLink label="Log in" onPress={onLogin} />
          </Stack>
        </Stack>

        <LegalNote action="proceeding" />
      </Stack>
    </Stack>
  );
}
