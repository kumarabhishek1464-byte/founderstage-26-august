import { router } from 'expo-router';

import { AboutYouView } from '@/features/onboarding';
import { Screen, useTheme } from '@/core/design-system';

/**
 * Step 1 of 4.
 *
 * `router.back()` and not `replace('/signup')`: the user arrived here from signup, and back should undo the
 * step they took rather than assert where they came from. `push` forward, so steps 1 → 4 form a stack the
 * back button walks in reverse — the one place in this flow where accumulating history is the point.
 *
 * The four step routes are otherwise identical and stay separate files anyway: expo-router derives the URL
 * from the filename, so a single `[step].tsx` would trade four self-describing paths for one that has to
 * validate its own parameter.
 */
export default function AboutYouScreen() {
  const theme = useTheme();

  return (
    <Screen scroll contentStyle={{ paddingTop: theme.spacing.lg, paddingBottom: theme.spacing.xl2 }}>
      <AboutYouView
        onBack={() => {
          router.back();
        }}
        onContinue={() => {
          router.push('/onboarding/your-role');
        }}
      />
    </Screen>
  );
}
