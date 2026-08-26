/**
 * `OnboardingLayout` — shared chrome for onboarding screens.
 *
 * Premium chrome: a "Step X of N" pill sits above the wordmark to give the user a durable
 * sense of place; the CTA is the scarce red primary and every step ends in it.
 */
import { Button, createStyles, Icon, PaginationDots, Stack, Text, Wordmark } from '@/core/design-system';

import type { IconName } from '@/core/design-system';
import type { ReactNode } from 'react';

export const ONBOARDING_STEPS = 4;

interface OnboardingLayoutProps {
  /** 1-based, to match `PaginationDots`. */
  readonly step: number;
  readonly title: string;
  readonly subtitle: string;
  readonly children: ReactNode;
  readonly onBack?: () => void;
  readonly onContinue: () => void;
  /** Drives the CTA's disabled state. */
  readonly canContinue: boolean;
  /** Defaults to `Continue`. */
  readonly ctaLabel?: string;
  /** Reassurance under the pagination dots. */
  readonly footnote?: string;
  readonly footnoteIcon?: IconName;
}

const useStyles = createStyles((t) => ({
  stepPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: t.spacing.sm,
    paddingVertical: t.spacing.xxs,
    borderRadius: t.radius.full,
    backgroundColor: t.colors.surface.accentSubtle,
  },
}));

export function OnboardingLayout({
  step,
  title,
  subtitle,
  children,
  onContinue,
  canContinue,
  ctaLabel = 'Continue',
  footnote,
  footnoteIcon,
}: OnboardingLayoutProps) {
  const styles = useStyles();

  return (
    <Stack gap="xl2">
      <Stack gap="xl">
        <Stack direction="row" align="center" justify="between">
          <Wordmark />
          <Stack style={styles.stepPill}>
            <Text variant="overline" tone="accent">
              {`Step ${String(step)} of ${String(ONBOARDING_STEPS)}`}
            </Text>
          </Stack>
        </Stack>

        <Stack gap="xxs">
          <Text variant="title1" tone="heading">
            {title}
          </Text>
          <Text variant="title2" tone="tertiary">
            {subtitle}
          </Text>
        </Stack>
      </Stack>

      {children}

      <Stack gap="md">
        <Button
          label={ctaLabel}
          size="lg"
          variant="primary"
          fullWidth
          disabled={!canContinue}
          onPress={onContinue}
          iconRight={<Icon name="forward" size="md" tone="inverse" />}
        />

        <PaginationDots total={ONBOARDING_STEPS} current={step} />

        {footnote !== undefined ? (
          <Stack direction="row" align="center" justify="center" gap="xxs">
            {footnoteIcon !== undefined ? (
              <Icon name={footnoteIcon} size="sm" tone="tertiary" />
            ) : null}
            <Text variant="footnote" tone="tertiary" align="center">
              {footnote}
            </Text>
          </Stack>
        ) : null}
      </Stack>
    </Stack>
  );
}
