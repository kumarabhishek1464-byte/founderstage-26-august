/**
 * `OnboardingLayout` — shared chrome for onboarding screens matching the reference designs.
 */
import { Button, Icon, PaginationDots, Stack, Text, Wordmark } from '@/core/design-system';

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
  return (
    <Stack gap="xl2">
      <Stack gap="xl">
        <Wordmark />

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
          variant="dark"
          fullWidth
          disabled={!canContinue}
          onPress={onContinue}
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
