/**
 * Step 2 — what the user does, in what, and at what point.
 *
 * ## Why this step has no form
 *
 * Three `Select`s whose options are closed unions ([`options.ts`](../model/options.ts)). There is nothing a
 * user can enter that is not already valid, so there is nothing to validate — and running the answers
 * through `react-hook-form` + `zod` anyway would mean the same three values living in two places, with a
 * commit step between them where they can disagree. Each select writes straight to the draft, and
 * `isRoleStepComplete` is the only rule this screen has.
 *
 * That also gives the behaviour the user expects for free: the sheet closes, the answer is saved, and
 * walking back into the step shows it still chosen. A form would need `defaultValues` plumbing to fake the
 * same thing.
 *
 * ## Why all three are required
 *
 * A role on its own is a job title. A role plus a sector plus a stage is the thing the network can actually
 * match on — "seed-stage FinTech founder" is a room, "founder" is not. So none of them is optional, and the
 * disabled CTA is the honest statement that a partial answer does not help.
 */
import { Select, Stack } from '@/core/design-system';

import { isRoleStepComplete, useOnboardingStore } from '../model/draft-store';
import { ROLE_OPTIONS, SECTOR_OPTIONS, STAGE_OPTIONS } from '../model/options';
import { OnboardingLayout } from './OnboardingLayout';

interface RoleViewProps {
  readonly onBack: () => void;
  readonly onContinue: () => void;
}

export function RoleView({ onBack, onContinue }: RoleViewProps) {
  // Selected field by field rather than as one `draft` object: the store hands back a new draft on every
  // answer, and a component subscribed to the whole thing re-renders for changes it does not read.
  const role = useOnboardingStore((state) => state.draft.role);
  const sector = useOnboardingStore((state) => state.draft.sector);
  const stage = useOnboardingStore((state) => state.draft.stage);

  const setRole = useOnboardingStore((state) => state.setRole);
  const setSector = useOnboardingStore((state) => state.setSector);
  const setStage = useOnboardingStore((state) => state.setStage);

  const canContinue = isRoleStepComplete({ role, sector, stage });

  return (
    <OnboardingLayout
      step={2}
      title="Tell us who you are"
      subtitle="This is what we match you on, so it is worth getting right."
      onBack={onBack}
      onContinue={onContinue}
      canContinue={canContinue}
      footnote="Only your role and sector appear on your profile. Stage stays private."
    >
      <Stack gap="lg">
        <Select
          label="I am a"
          value={role}
          onChange={setRole}
          options={ROLE_OPTIONS}
          icon="role"
          placeholder="Select your role"
          sheetTitle="What best describes you?"
        />

        <Select
          label="Sector"
          value={sector}
          onChange={setSector}
          options={SECTOR_OPTIONS}
          icon="organization"
          placeholder="Select a sector"
          sheetTitle="What sector do you work in?"
        />

        <Select
          label="Stage"
          value={stage}
          onChange={setStage}
          options={STAGE_OPTIONS}
          icon="growth"
          placeholder="Select a stage"
          helper="Where your company is today, or the stage you invest at."
          sheetTitle="What stage are you at?"
        />
      </Stack>
    </OnboardingLayout>
  );
}
