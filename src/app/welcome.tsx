import { router } from 'expo-router';

import { WelcomeView } from '@/features/auth';
import { Screen } from '@/core/design-system';

/**
 * The signed-out entry point. Not `index` — `/` is the tab bar, and this screen has to be reachable by
 * name until `src/core/auth` exists to decide which of the two a cold start lands on.
 *
 * Not scrolling, and unpadded. The hero's marquee lanes run edge to edge, so the screen cannot own the
 * horizontal margin; `WelcomeView` re-applies it per block. `Stack fill justify="between"` inside a
 * non-scrolling `Screen` is what pins the wordmark to the top and the legal line to the bottom on any
 * device height — inside a `ScrollView` the same `flex: 1` would let the content compress instead.
 */
export default function WelcomeScreen() {
  return (
    <Screen padded={false} surface="primary">
      <WelcomeView
        onJoin={() => {
          router.push('/signup');
        }}
        onLogin={() => {
          router.push('/login');
        }}
      />
    </Screen>
  );
}
