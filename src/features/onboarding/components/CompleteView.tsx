/**
 * The end of the flow: submitted, under review, and what happens next.
 *
 * ## Why the success mark is black
 *
 * The obvious hero for a success screen is a green tick, and this design language has no green. The next
 * reflex is the accent — a 64pt red disc — and that is the exact thing the language forbids: "red is a
 * signal, never a background". So the mark is `surface.inverse` with a white check, the same luminance
 * inversion `Chip` uses for selection. It reads as *complete* rather than as *good*, which is also the more
 * honest statement: the profile is submitted, not yet approved.
 *
 * ## Why this screen does not use `OnboardingLayout`
 *
 * No back button and no progress bar. Going back would resubmit, and the bar is at four of four — a fifth
 * filled segment would say there was another step. The layout's chrome is all wrong here, so the screen
 * builds its own, which is the correct outcome for the one screen in the flow that is not a step of it.
 *
 * ## Why the draft is cleared on the way out
 *
 * The answers have been handed over; keeping a name, two phone numbers and a city in memory afterwards
 * serves nobody and is one more place they can leak from. `reset()` runs before navigation, so the tabs
 * never mount over a live draft — and if the user somehow re-enters onboarding, they start clean rather
 * than editing a submitted profile's ghost.
 */
import { useCallback } from 'react';

import { Button, Card, createStyles, Icon, Stack, Text } from '@/core/design-system';

import { useOnboardingStore } from '../model/draft-store';

import type { IconName } from '@/core/design-system';

interface CompleteViewProps {
  readonly onExplore: () => void;
}

interface NextStep {
  readonly icon: IconName;
  readonly title: string;
  readonly detail: string;
}

/**
 * Three facts, in the order the user wants them: how they find out, where else they find out, and when.
 * The last one is a range and not a promise — "usually" is doing real work in that sentence.
 */
const NEXT_STEPS: readonly NextStep[] = [
  {
    icon: 'email',
    title: 'By email',
    detail: 'We write to you as soon as a reviewer has looked at your profile.',
  },
  {
    icon: 'chat',
    title: 'On WhatsApp',
    detail: 'If you gave us a WhatsApp number, we send the update there too.',
  },
  {
    icon: 'time',
    title: 'Usually 1–2 business days',
    detail: 'Occasionally longer, if a reviewer needs to check something with you.',
  },
];

const useStyles = createStyles((t) => ({
  /**
   * 64 and 24 — a disc three times the glyph it holds. Both are plain numbers because neither is a spacing
   * or radius decision: this is one mark whose proportions are its own, and a token for a 64pt circle
   * would be a token with one caller.
   */
  mark: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: t.radius.full,
    backgroundColor: t.colors.surface.inverse,
  },
  /** Lets the icon column stay a fixed 20pt while the copy takes the rest of the card. */
  detail: { flex: 1 },
}));

export function CompleteView({ onExplore }: CompleteViewProps) {
  const styles = useStyles();
  const reset = useOnboardingStore((state) => state.reset);

  const handleExplore = useCallback(() => {
    reset();
    onExplore();
  }, [reset, onExplore]);

  return (
    <Stack gap="xl3">
      <Stack gap="lg" align="center">
        <Stack style={styles.mark}>
          <Icon name="check" size="lg" tone="inverse" />
        </Stack>

        <Stack gap="xs" align="center">
          <Text variant="overline" tone="tertiary">
            Onboarding complete
          </Text>
          <Text variant="display" tone="heading" align="center">
            You&apos;re all set
          </Text>
        </Stack>

        <Text variant="body" tone="secondary" align="center">
          Your profile is with our review team. You can look around in the meantime — a few things
          stay locked until you are verified.
        </Text>
      </Stack>

      <Stack gap="sm">
        {NEXT_STEPS.map((step) => (
          <Card key={step.icon} padding="md">
            <Stack direction="row" align="start" gap="md">
              <Icon name={step.icon} size="md" tone="tertiary" />
              <Stack gap="xxs" style={styles.detail}>
                <Text variant="bodyStrong" tone="heading">
                  {step.title}
                </Text>
                <Text variant="footnote" tone="secondary">
                  {step.detail}
                </Text>
              </Stack>
            </Stack>
          </Card>
        ))}
      </Stack>

      <Button
        label="Explore FounderStage"
        size="lg"
        fullWidth
        onPress={handleExplore}
        iconRight={<Icon name="forward" size="md" tone="inverse" />}
      />
    </Stack>
  );
}
