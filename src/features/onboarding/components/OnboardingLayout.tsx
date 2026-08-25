/**
 * `OnboardingLayout` — the chrome every step of the flow shares: the way back, where you are, what this
 * step is asking, and the one button that leaves it.
 *
 * ## Why the four steps do not each build their own header
 *
 * [Rule 1](../../../../CLAUDE.md) at the scale where it matters most. Four screens hand-assembling a back
 * button, a progress bar, a title and a footer is four chances for the title to be `title1` on three of
 * them and `title2` on the fourth, and for the button to be 24pt from the bottom on one and 32 on the
 * rest. The steps supply content; the frame is decided once, here.
 *
 * ## Why the step counter is written out as well as drawn
 *
 * [`ProgressSteps`](../../../core/design-system/components/ProgressSteps.tsx) already announces "Step 2 of
 * 4" to a screen reader, and its segments already show the distance covered. The `caption` beside it is for
 * the sighted user who wants the number rather than the proportion — filled segments answer "how much
 * further" but not "how many more times am I doing this". It sits *in* the header row, next to the bar it
 * labels, rather than above the title, because as an eyebrow it would compete with the question.
 *
 * ## Why the button is not pinned to the bottom of the viewport
 *
 * `Screen` has no footer slot and this deliberately does not simulate one with `flex: 1`. A stack that
 * fills the scroll container also *shrinks* inside it, so on the long steps — thirty-six interest chips —
 * a pinned footer is bought by silently compressing the content above it. The button instead sits directly
 * under the last field, which is where the thumb already is once the form is answered, and the short steps
 * simply end a little higher up the screen.
 */
import {
  Button,
  createStyles,
  IconButton,
  ProgressSteps,
  Stack,
  Text,
} from '@/core/design-system';

import type { ReactNode } from 'react';

/** The four answering steps. The success screen is past the end of the bar, not the fifth segment of it. */
export const ONBOARDING_STEPS = 4;

interface OnboardingLayoutProps {
  /** 1-based, to match `ProgressSteps` and the sentence it prints. */
  readonly step: number;
  readonly title: string;
  readonly subtitle: string;
  readonly children: ReactNode;
  readonly onBack: () => void;
  readonly onContinue: () => void;
  /** Drives the CTA's disabled state. Each step decides what "answered" means for it. */
  readonly canContinue: boolean;
  /** Defaults to `Continue`. The last step says what it actually does instead. */
  readonly ctaLabel?: string;
  /** A reassurance under the button — that an answer is not final, that a field is not published. */
  readonly footnote?: string;
}

const useStyles = createStyles(() => ({
  /** Takes the space between the back button and the counter, so the bar spans whatever is left. */
  progress: { flex: 1 },
}));

export function OnboardingLayout({
  step,
  title,
  subtitle,
  children,
  onBack,
  onContinue,
  canContinue,
  ctaLabel = 'Continue',
  footnote,
}: OnboardingLayoutProps) {
  const styles = useStyles();

  return (
    <Stack gap="xl2">
      <Stack direction="row" align="center" gap="md">
        <IconButton name="back" accessibilityLabel="Go back" onPress={onBack} tone="heading" />
        <ProgressSteps total={ONBOARDING_STEPS} current={step} style={styles.progress} />
        <Text variant="caption" tone="tertiary">
          {`Step ${String(step)} of ${String(ONBOARDING_STEPS)}`}
        </Text>
      </Stack>

      <Stack gap="xxs">
        <Text variant="title1" tone="heading">
          {title}
        </Text>
        <Text variant="body" tone="secondary">
          {subtitle}
        </Text>
      </Stack>

      {children}

      <Stack gap="md">
        <Button
          label={ctaLabel}
          size="lg"
          fullWidth
          disabled={!canContinue}
          onPress={onContinue}
        />
        {footnote === undefined ? null : (
          <Text variant="caption" tone="tertiary" align="center">
            {footnote}
          </Text>
        )}
      </Stack>
    </Stack>
  );
}
