import { router } from 'expo-router';

import { RoleView } from '@/features/onboarding';
import { Screen, useTheme } from '@/core/design-system';

/** Step 2 of 4. Navigation only — see [`about-you`](./about-you.tsx) for why back is `back()`. */
export default function YourRoleScreen() {
  const theme = useTheme();

  return (
    <Screen
      scroll
      contentStyle={{ paddingTop: theme.spacing.lg, paddingBottom: theme.spacing.xl2 }}
    >
      <RoleView
        onBack={() => {
          router.back();
        }}
        onContinue={() => {
          router.push('/onboarding/interests');
        }}
      />
    </Screen>
  );
}
