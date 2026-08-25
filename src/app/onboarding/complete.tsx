import { router } from 'expo-router';

import { CompleteView } from '@/features/onboarding';
import { Screen, useTheme } from '@/core/design-system';

/**
 * The end of the flow. Not a step, so there is no back button and no progress bar — see
 * [`CompleteView`](../../features/onboarding/components/CompleteView.tsx).
 *
 * `dismissAll()` before `replace('/')` because a bare `replace` only swaps *this* screen: signup and steps
 * 1–3 would still be underneath, and the first hardware back press from the tab bar would land the user
 * inside an onboarding flow they have already submitted. Popping the stack first and then replacing its one
 * remaining entry leaves the tabs as the only thing in history, which is what "you're all set" claims.
 */
export default function CompleteScreen() {
  const theme = useTheme();

  return (
    <Screen scroll contentStyle={{ paddingTop: theme.spacing.xl3, paddingBottom: theme.spacing.xl2 }}>
      <CompleteView
        onExplore={() => {
          router.dismissAll();
          router.replace('/');
        }}
      />
    </Screen>
  );
}
