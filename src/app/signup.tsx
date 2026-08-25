import { router } from 'expo-router';

import { SignupView } from '@/features/auth';
import { Screen, useTheme } from '@/core/design-system';

/**
 * New members. Three fields and a checkbox, so it scrolls for the same reason [`login`](./login.tsx) does.
 *
 * Signing up goes forward into onboarding rather than into the tabs: an account with no name, role or sector
 * is not yet a member of a curated network, and step 1 is where that starts. `replace` in both directions,
 * so the stack never accumulates a login/signup ping-pong — from step 1, back lands on whichever of the two
 * the user came through, once.
 */
export default function SignupScreen() {
  const theme = useTheme();

  return (
    <Screen
      scroll
      contentStyle={{ paddingTop: theme.spacing.xl2, paddingBottom: theme.spacing.xl2 }}
    >
      <SignupView
        onSubmit={() => {
          router.replace('/onboarding/about-you');
        }}
        onLogin={() => {
          router.replace('/login');
        }}
      />
    </Screen>
  );
}
