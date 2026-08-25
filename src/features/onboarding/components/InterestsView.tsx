/**
 * Step 3 — what the user wants out of the network, as thirty-six chips behind six group titles.
 *
 * ## Why three chips per group and a "See more"
 *
 * All thirty-six at once is a wall: six titles and six wrapped grids is roughly two and a half screens of
 * pills, and the CTA disappears below all of it. Three per group is enough to make the *category* legible —
 * "Investing: angel investing, venture capital, private equity" tells you what is behind the link — while
 * keeping the whole step to about one screen. The link counts what is hidden ("See 3 more") rather than
 * saying "See more", because a link that says how much more is behind it is a link people can decide about.
 *
 * Expansion is local state and it is per group, so opening one does not reflow the other five. It is
 * deliberately *not* in the draft store: which groups you had open is not an answer, and persisting it
 * across a back-navigation would restore a scroll position nobody asked for.
 *
 * ## Why the group titles are `headline`
 *
 * They are real headings — a screen-reader user navigating this step by heading should get six stops, not
 * one — so they use a role `Text` gives a heading rank to. `headline` is rank 4 under the step's rank-1
 * title, which skips two levels; the alternative was `title3` at 18/24 repeated six times above 14pt chip
 * labels, which inverts the hierarchy it is supposed to express. Heading-level skipping is a WCAG *should*
 * and an inverted visual hierarchy is a real one.
 *
 * ## Why a chip and not a checkbox
 *
 * `Chip` with `selected` supplied announces itself as a checkbox with its state
 * ([`Chip`](../../../core/design-system/components/Chip.tsx) derives the role from the props), so nothing is
 * lost to assistive tech — and thirty-six stacked checkbox rows would be six screens instead of one. The
 * chips also do not change size when selected, which on a wrapped grid is the difference between a tap that
 * selects one interest and a tap that reshuffles the row under the user's finger.
 */
import { useCallback, useState } from 'react';

import { Banner, Chip, Stack, Text, TextLink } from '@/core/design-system';

import { isInterestsStepComplete, useOnboardingStore } from '../model/draft-store';
import { INTEREST_CATEGORIES, INTEREST_PREVIEW_COUNT } from '../model/options';
import { OnboardingLayout } from './OnboardingLayout';

interface InterestsViewProps {
  readonly onBack: () => void;
  readonly onContinue: () => void;
}

export function InterestsView({ onBack, onContinue }: InterestsViewProps) {
  const interests = useOnboardingStore((state) => state.draft.interests);
  const toggleInterest = useOnboardingStore((state) => state.toggleInterest);

  const [expanded, setExpanded] = useState<readonly string[]>([]);

  const toggleGroup = useCallback((id: string) => {
    setExpanded((open) => (open.includes(id) ? open.filter((each) => each !== id) : [...open, id]));
  }, []);

  return (
    <OnboardingLayout
      step={3}
      title="What interests you?"
      subtitle="Choose all that apply. At least one to continue."
      onBack={onBack}
      onContinue={onContinue}
      canContinue={isInterestsStepComplete({ interests })}
    >
      <Stack gap="xl">
        {INTEREST_CATEGORIES.map((category) => {
          const isOpen = expanded.includes(category.id);
          const shown = isOpen ? category.options : category.options.slice(0, INTEREST_PREVIEW_COUNT);
          const hidden = category.options.length - INTEREST_PREVIEW_COUNT;

          return (
            <Stack key={category.id} gap="sm">
              <Text variant="headline" tone="heading">
                {category.title}
              </Text>

              <Stack direction="row" wrap gap="sm">
                {shown.map((option) => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    selected={interests.includes(option.value)}
                    onPress={() => {
                      toggleInterest(option.value);
                    }}
                  />
                ))}
              </Stack>

              {hidden > 0 ? (
                <TextLink
                  label={isOpen ? 'See less' : `See ${String(hidden)} more`}
                  variant="footnote"
                  tone="secondary"
                  onPress={() => {
                    toggleGroup(category.id);
                  }}
                  accessibilityHint={`${category.title} interests`}
                />
              ) : null}
            </Stack>
          );
        })}

        <Banner
          icon="info"
          message="Your interests shape your feed and the people we suggest. They are not shown on your profile."
        />
      </Stack>
    </OnboardingLayout>
  );
}
