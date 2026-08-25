/**
 * `RoleView` — Step 2 matching reference screen 5.
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
      subtitle="So we can personalize your experience"
      onBack={onBack}
      onContinue={onContinue}
      canContinue={canContinue}
      footnote="You can always update this later from your profile settings."
      footnoteIcon="password"
    >
      <Stack gap="lg">
        <Select
          label="Select your role"
          value={role}
          onChange={setRole}
          options={ROLE_OPTIONS}
          icon="profile"
          placeholder="Choose your role"
          helper="e.g., Founder, Investor, Angel Investor, Co-founder, Mentor, Advisor, Coach, Operator, Innovator, Other"
          sheetTitle="What best describes you?"
        />

        <Select
          label="Select your sector / industry"
          value={sector}
          onChange={setSector}
          options={SECTOR_OPTIONS}
          icon="role"
          placeholder="Choose your sector"
          helper="e.g., AI/ML, FinTech, HealthTech, SaaS, EdTech, E-commerce, DeepTech, Consumer, Other"
          sheetTitle="What sector do you work in?"
        />

        <Select
          label="Select your stage"
          value={stage}
          onChange={setStage}
          options={STAGE_OPTIONS}
          icon="growth"
          placeholder="Choose your stage"
          helper="e.g., Idea Stage, Pre-Seed, Seed, Series A, Growth Stage, Scale-up, Other"
          sheetTitle="What stage are you at?"
        />
      </Stack>
    </OnboardingLayout>
  );
}
