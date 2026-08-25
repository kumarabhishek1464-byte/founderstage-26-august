import { router } from 'expo-router';

import { VerificationView } from '@/features/onboarding';
import { Screen, useTheme } from '@/core/design-system';

/**
 * Step 4 of 4.
 *
 * Submitting `replace`s rather than `push`es: the success screen is terminal, and back from it should not
 * offer to submit the same profile a second time. That also strands steps 1–3 below it, which is why
 * [`complete`](./complete.tsx) leaves the flow with `dismissTo` rather than `back`.
 */
export default function VerificationScreen() {
  const theme = useTheme();

  return (
    <Screen
      scroll
      contentStyle={{ paddingTop: theme.spacing.lg, paddingBottom: theme.spacing.xl2 }}
    >
      <VerificationView
        onBack={() => {
          router.back();
        }}
        onSubmit={() => {
          router.replace('/onboarding/complete');
        }}
      />
    </Screen>
  );
}
