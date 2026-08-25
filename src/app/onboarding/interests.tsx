import { router } from 'expo-router';

import { InterestsView } from '@/features/onboarding';
import { Screen, useTheme } from '@/core/design-system';

/** Step 3 of 4. Navigation only — see [`about-you`](./about-you.tsx) for why back is `back()`. */
export default function InterestsScreen() {
  const theme = useTheme();

  return (
    <Screen scroll contentStyle={{ paddingTop: theme.spacing.lg, paddingBottom: theme.spacing.xl2 }}>
      <InterestsView
        onBack={() => {
          router.back();
        }}
        onContinue={() => {
          router.push('/onboarding/verification');
        }}
      />
    </Screen>
  );
}
