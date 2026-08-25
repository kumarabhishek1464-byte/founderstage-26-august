import { router } from 'expo-router';

import { LoginView } from '@/features/auth';
import { Screen, useTheme } from '@/core/design-system';

/**
 * Returning members. Scrolling, because a keyboard over a two-field form on a short device leaves roughly
 * 300pt of visible screen and the "Sign up" link has to stay reachable inside it.
 *
 * `router.replace` rather than `push`: a successful sign-in makes this screen a dead end, and leaving it on
 * the stack means the hardware back button walks out of the app and into the login form again.
 *
 * Log in lands in the tabs, sign up lands in onboarding — an existing member has already answered those
 * questions. Nothing here authenticates yet; see [`LoginView`](../features/auth/components/LoginView.tsx).
 */
export default function LoginScreen() {
  const theme = useTheme();

  return (
    <Screen
      scroll
      contentStyle={{ paddingTop: theme.spacing.xl2, paddingBottom: theme.spacing.xl2 }}
    >
      <LoginView
        onSubmit={() => {
          router.replace('/');
        }}
        onSignup={() => {
          router.replace('/signup');
        }}
      />
    </Screen>
  );
}
