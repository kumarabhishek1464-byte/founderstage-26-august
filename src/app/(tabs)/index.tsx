import { Screen } from '@/core/design-system';
import { HomeFeedView } from '@/features/home';

export default function HomeScreen() {
  return (
    <Screen scroll surface="secondary" padded={false} safeTop={false} safeBottom={false}>
      <HomeFeedView />
    </Screen>
  );
}
