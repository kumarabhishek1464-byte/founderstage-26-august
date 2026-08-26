/**
 * `WelcomeView` — the signed-out hero matching reference screen 1.
 */
import { Button, createStyles, Icon, ShieldLogoIcon, Stack, Text } from '@/core/design-system';

import { LegalNote } from './LegalNote';
import { WelcomeHero } from './WelcomeHero';

interface WelcomeViewProps {
  readonly onJoin: () => void;
  readonly onLogin: () => void;
}

const useStyles = createStyles((t) => ({
  container: {
    paddingTop: t.spacing.xxs,
    paddingBottom: t.spacing.md,
  },
  content: {
    paddingHorizontal: t.spacing.xl,
    paddingBottom: t.spacing.xs,
  },
}));

export function WelcomeView({ onJoin }: WelcomeViewProps) {
  const styles = useStyles();

  return (
    <Stack gap="xs" style={styles.container}>
      <WelcomeHero />

      <Stack gap="md" style={styles.content}>
        {/* Left-aligned two-tone headline matching the reference: the leading phrase reads as an
            attribution in the muted grey, and the rest lands in near-black. */}
        <Text variant="title1" tone="heading" align="left">
          <Text variant="title1" tone="tertiary">
            {'The Operating System '}
          </Text>
          {'for a curated network of founders, investors, coaches and innovators.'}
        </Text>

        {/* Action Button */}
        <Stack gap="xs">
          <Button
            label="Join the Network"
            size="lg"
            variant="primary"
            fullWidth
            onPress={onJoin}
            iconLeft={<ShieldLogoIcon size={22} />}
            iconRight={<Icon name="forward" size="md" tone="inverse" />}
          />
        </Stack>

        <LegalNote action="proceeding" />
      </Stack>
    </Stack>
  );
}
